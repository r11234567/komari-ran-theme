import { timestampDate, timestampFromDate, type Duration } from '@bufbuild/protobuf/wkt'
import { metrics, type PingHistory, type PingRecord, type PingTask } from '@/api/client'

export interface LossPoint { time: string; loss: number | null }
export interface PingHistoryPlus extends PingHistory {
  lossByTask: Record<number, LossPoint[]>; liveRecords: PingHistory['records']; liveLossByTask: Record<number, LossPoint[]>; fromMetricStore: boolean
}

export const EMPTY_PING_PLUS: PingHistoryPlus = { count: 0, tasks: [], records: [], lossByTask: {}, liveRecords: [], liveLossByTask: {}, fromMetricStore: true }
const options = (signal?: AbortSignal, timeoutMs = 30_000) => ({ signal, timeoutMs })
const durationSeconds = (duration?: Duration) => duration
  ? Number(duration.seconds) + duration.nanos / 1_000_000_000
  : 0

export async function fetchNodePing(uuid: string, hours = 1, maxPoints = 500, opts?: { rawWindowMinutes?: number; liveOnly?: boolean; signal?: AbortSignal }): Promise<PingHistoryPlus> {
  const end = new Date(); const start = new Date(end.getTime() - hours * 3_600_000)
  const [charted, raw, tasksResponse, statsResponse] = await Promise.all([
    opts?.liveOnly ? Promise.resolve({ series: [] }) : metrics.queryMetrics({ agentIds: [uuid], metrics: ['ping.latency_ms', 'ping.loss'], startTime: timestampFromDate(start), endTime: timestampFromDate(end), maxPoints, fillEmpty: true }, options(opts?.signal)),
    opts?.rawWindowMinutes ? metrics.queryMetrics({ agentIds: [uuid], metrics: ['ping.latency_ms', 'ping.loss'], startTime: timestampFromDate(new Date(end.getTime() - opts.rawWindowMinutes * 60_000)), endTime: timestampFromDate(end), maxPoints: 500, downsample: false, fillEmpty: true }, options(opts?.signal)) : Promise.resolve({ series: [] }),
    metrics.listPingTasks({}, options(opts?.signal)),
    metrics.getPingStats({ agentIds: [uuid], startTime: timestampFromDate(start), endTime: timestampFromDate(end), maxPoints }, options(opts?.signal)),
  ])
  const records = (series: Awaited<ReturnType<typeof metrics.queryMetrics>>['series']) => {
    const latency: PingRecord[] = []; const loss: Record<number, LossPoint[]> = {}; const seen = new Set<number>()
    for (const item of series) {
      const taskID = Number(item.labels.task_id); if (!Number.isFinite(taskID)) continue; seen.add(taskID)
      for (const point of item.queryPoints) {
        if (!point.observedAt) continue
        const time = timestampDate(point.observedAt).toISOString()
        if (item.metric === 'ping.latency_ms' && point.value != null) latency.push({ task_id: taskID, time, value: point.value, client: uuid })
        if (item.metric === 'ping.loss') (loss[taskID] ??= []).push({ time, loss: point.value == null ? null : point.value * 100 })
      }
    }
    latency.sort((left, right) => left.time.localeCompare(right.time)); return { latency, loss, seen }
  }
  const chart = records(charted.series); const live = records(raw.series); const allTaskIDs = new Set([...chart.seen, ...live.seen])
  const taskByID = new Map(tasksResponse.tasks.map((task) => [Number(task.taskId), task]))
  const statByID = new Map(statsResponse.stats.map((stat) => [Number(stat.taskId), stat]))
  const tasks: PingTask[] = [...allTaskIDs].map((id) => {
    const task = taskByID.get(id); const stat = statByID.get(id)
    return { id, name: task?.name ?? `Task ${id}`, type: task?.type, interval: durationSeconds(task?.interval), loss: stat?.lossPercent ?? 0, avg: stat?.average, min: stat?.minimum, max: stat?.maximum, total: stat?.total }
  })
  return { count: chart.latency.length, tasks, records: chart.latency, lossByTask: chart.loss, liveRecords: live.latency, liveLossByTask: live.loss, fromMetricStore: true }
}
