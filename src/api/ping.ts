import { timestampDate, timestampFromDate, type Duration } from '@bufbuild/protobuf/wkt'
import { metrics, type PingHistory, type PingRecord, type PingTask } from '@/api/client'
import { dedupe, idsKey, quantizedWindow, withAbort } from '@/api/dedupe'

export interface LossPoint { time: string; loss: number | null }
export interface PingHistoryPlus extends PingHistory {
  lossByTask: Record<number, LossPoint[]>; liveRecords: PingHistory['records']; liveLossByTask: Record<number, LossPoint[]>; fromMetricStore: boolean
}

export const EMPTY_PING_PLUS: PingHistoryPlus = { count: 0, tasks: [], records: [], lossByTask: {}, liveRecords: [], liveLossByTask: {}, fromMetricStore: true }
const options = (signal?: AbortSignal, timeoutMs = 30_000) => ({ signal, timeoutMs })
const durationSeconds = (duration?: Duration) => duration
  ? Number(duration.seconds) + duration.nanos / 1_000_000_000
  : 0

const WINDOW_STEP_MS = 30_000
const PING_TTL_MS = 60_000
const TASK_LIST_TTL_MS = 60_000

/** 探测目标列表是全局的(请求体为空),取一次全页共享,而不是每节点一次。 */
const fetchPingTasks = () => dedupe(
  'metrics.listPingTasks',
  TASK_LIST_TTL_MS,
  async () => (await metrics.listPingTasks({}, options())).tasks,
)

export interface FleetPingOptions { rawWindowMinutes?: number; liveOnly?: boolean; signal?: AbortSignal }

type Series = Awaited<ReturnType<typeof metrics.queryMetrics>>['series']
interface AgentSplit { latency: PingRecord[]; loss: Record<number, LossPoint[]>; seen: Set<number> }

const emptySplit = (): AgentSplit => ({ latency: [], loss: {}, seen: new Set() })

/** 按 agent 拆开序列 —— 批量查询回来的 series 混着所有节点。 */
function splitByAgent(series: Series): Map<string, AgentSplit> {
  const byAgent = new Map<string, AgentSplit>()
  for (const item of series) {
    const taskID = Number(item.labels.task_id); if (!Number.isFinite(taskID)) continue
    let slot = byAgent.get(item.agentId)
    if (!slot) { slot = emptySplit(); byAgent.set(item.agentId, slot) }
    slot.seen.add(taskID)
    for (const point of item.queryPoints) {
      if (!point.observedAt) continue
      const time = timestampDate(point.observedAt).toISOString()
      if (item.metric === 'ping.latency_ms' && point.value != null) slot.latency.push({ task_id: taskID, time, value: point.value, client: item.agentId })
      if (item.metric === 'ping.loss') (slot.loss[taskID] ??= []).push({ time, loss: point.value == null ? null : point.value * 100 })
    }
  }
  for (const slot of byAgent.values()) slot.latency.sort((left, right) => left.time.localeCompare(right.time))
  return byAgent
}

/**
 * 整个机队的 ping 历史,一次查完。
 *
 * QueryMetrics / GetPingStats 都收 agent 列表,而服务端的分桶间隔由
 * (end - start) / max_points 决定,与 agent 数量无关 —— 所以一次批量查询
 * 拿到的数据跟 N 次单节点查询完全一致,只是少了 N-1 次往返。
 */
export function fetchFleetPing(uuids: string[], hours = 1, maxPoints = 500, opts?: FleetPingOptions): Promise<Record<string, PingHistoryPlus>> {
  if (uuids.length === 0) return Promise.resolve({})
  const { start, end } = quantizedWindow(hours, WINDOW_STEP_MS)
  const key = `ping|${idsKey(uuids)}|${hours}|${maxPoints}|${end.getTime()}|${opts?.rawWindowMinutes ?? 0}|${opts?.liveOnly ? 1 : 0}`
  return withAbort(dedupe(key, PING_TTL_MS, () => queryFleetPing(uuids, start, end, maxPoints, opts)), opts?.signal)
}

async function queryFleetPing(
  uuids: string[],
  start: Date,
  end: Date,
  maxPoints: number,
  opts?: FleetPingOptions,
): Promise<Record<string, PingHistoryPlus>> {
  const [charted, raw, taskList, statsResponse] = await Promise.all([
    opts?.liveOnly ? Promise.resolve({ series: [] as Series }) : metrics.queryMetrics({ agentIds: uuids, metrics: ['ping.latency_ms', 'ping.loss'], startTime: timestampFromDate(start), endTime: timestampFromDate(end), maxPoints, fillEmpty: true }, options()),
    opts?.rawWindowMinutes ? metrics.queryMetrics({ agentIds: uuids, metrics: ['ping.latency_ms', 'ping.loss'], startTime: timestampFromDate(new Date(end.getTime() - opts.rawWindowMinutes * 60_000)), endTime: timestampFromDate(end), maxPoints: 500, downsample: false, fillEmpty: true }, options()) : Promise.resolve({ series: [] as Series }),
    fetchPingTasks(),
    metrics.getPingStats({ agentIds: uuids, startTime: timestampFromDate(start), endTime: timestampFromDate(end), maxPoints }, options()),
  ])

  const chartByAgent = splitByAgent(charted.series)
  const liveByAgent = splitByAgent(raw.series)
  const taskByID = new Map(taskList.map((task) => [Number(task.taskId), task]))
  // 每个节点读自己的统计 —— 批量返回里同一个 task 会有多个节点的条目。
  const statByAgentTask = new Map(statsResponse.stats.map((stat) => [`${stat.agentId}:${Number(stat.taskId)}`, stat]))

  const byUuid: Record<string, PingHistoryPlus> = {}
  for (const uuid of uuids) {
    const chart = chartByAgent.get(uuid) ?? emptySplit()
    const live = liveByAgent.get(uuid) ?? emptySplit()
    const tasks: PingTask[] = [...new Set([...chart.seen, ...live.seen])].map((id) => {
      const task = taskByID.get(id); const stat = statByAgentTask.get(`${uuid}:${id}`)
      return { id, name: task?.name ?? `Task ${id}`, type: task?.type, interval: durationSeconds(task?.interval), loss: stat?.lossPercent ?? 0, avg: stat?.average, min: stat?.minimum, max: stat?.maximum, total: stat?.total }
    })
    byUuid[uuid] = { count: chart.latency.length, tasks, records: chart.latency, lossByTask: chart.loss, liveRecords: live.latency, liveLossByTask: live.loss, fromMetricStore: true }
  }
  return byUuid
}

export async function fetchNodePing(uuid: string, hours = 1, maxPoints = 500, opts?: FleetPingOptions): Promise<PingHistoryPlus> {
  const fleet = await fetchFleetPing([uuid], hours, maxPoints, opts)
  return fleet[uuid] ?? EMPTY_PING_PLUS
}
