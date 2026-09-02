import { timestampDate, timestampFromDate } from '@bufbuild/protobuf/wkt'
import { metrics } from '@/api/client'
import { dedupe, idsKey, quantizedWindow, withAbort } from '@/api/dedupe'

export interface MetricPoint { time: string; value: number | null }
export interface MetricSeries { metric_key: string; entity_id: string; tags?: Record<string, string>; interval_seconds?: number; points: MetricPoint[] }
export interface PingQualityStat {
  task_id?: string | number; name?: string; tags?: Record<string, string>; total?: number; valid?: number; loss?: number
  min?: number; max?: number; avg?: number; latest?: number; p50?: number; p99?: number; stddev?: number; p99_p50_ratio?: number
}

export const FLEET_LOAD_METRICS = ['cpu.usage', 'memory.used', 'memory.total', 'disk.used', 'disk.total', 'net.in.rate', 'net.out.rate', 'load.average'] as const
export const FLEET_LOAD_METRICS_NO_DISK = ['cpu.usage', 'memory.used', 'memory.total', 'net.in.rate', 'net.out.rate'] as const

const options = (signal?: AbortSignal, timeoutMs = 30_000) => ({ signal, timeoutMs })
const WINDOW_STEP_MS = 30_000
const SERIES_TTL_MS = 60_000

const toLegacySeries = (series: Awaited<ReturnType<typeof metrics.queryMetrics>>['series'][number]): MetricSeries => ({
  metric_key: series.metric, entity_id: series.agentId, tags: series.labels,
  interval_seconds: series.interval ? Number(series.interval.seconds) : undefined,
  points: series.queryPoints.map((point) => ({ time: point.observedAt ? timestampDate(point.observedAt).toISOString() : '', value: point.value ?? null })),
})

/**
 * 同一份序列常被多处同时要(App 级和页面级的 useGlobalHistory 参数往往
 * 完全一样),所以按窗口对齐后共享一次往返。
 */
export function queryMetrics(input: { metricKeys: string[]; entityId?: string; entityIds?: string[]; hours?: number; start?: string; maxPoints?: number; downsample?: boolean; signal?: AbortSignal }): Promise<MetricSeries[]> {
  const { start: windowStart, end } = quantizedWindow(input.hours ?? 1, WINDOW_STEP_MS)
  const start = input.start ? new Date(input.start) : windowStart
  const agentIds = input.entityIds ?? (input.entityId ? [input.entityId] : [])
  const maxPoints = input.maxPoints ?? 500
  const key = `metrics|${idsKey(agentIds)}|${[...input.metricKeys].sort().join(',')}|${start.getTime()}|${end.getTime()}|${maxPoints}|${input.downsample ?? ''}`
  return withAbort(
    dedupe(key, SERIES_TTL_MS, () => runQuery(agentIds, input.metricKeys, start, end, maxPoints, input.downsample)),
    input.signal,
  )
}

async function runQuery(agentIds: string[], metricKeys: string[], start: Date, end: Date, maxPoints: number, downsample?: boolean): Promise<MetricSeries[]> {
  const response = await metrics.queryMetrics({
    agentIds, metrics: metricKeys,
    startTime: timestampFromDate(start), endTime: timestampFromDate(end), maxPoints,
    downsample, fillEmpty: true,
  }, options())
  return response.series.map(toLegacySeries)
}

export function fetchPingQuality(uuid: string, hours = 24, signal?: AbortSignal): Promise<PingQualityStat[]> {
  const { start, end } = quantizedWindow(hours, WINDOW_STEP_MS)
  return withAbort(
    dedupe(`pingQuality|${uuid}|${hours}|${end.getTime()}`, SERIES_TTL_MS, () => runPingQuality(uuid, start, end)),
    signal,
  )
}

async function runPingQuality(uuid: string, start: Date, end: Date): Promise<PingQualityStat[]> {
  const response = await metrics.getPingStats({ agentIds: [uuid], startTime: timestampFromDate(start), endTime: timestampFromDate(end), maxPoints: 500 }, options())
  return response.stats.map((stat) => ({
    task_id: stat.taskId.toString(), name: stat.name, tags: stat.tags, total: stat.total, valid: stat.valid,
    loss: stat.lossPercent, min: stat.minimum, max: stat.maximum, avg: stat.average, latest: stat.latest,
    p50: stat.p50, p99: stat.p99, stddev: stat.standardDeviation, p99_p50_ratio: stat.p99P50Ratio,
  }))
}

export async function queryFleetLoad(hours: number, maxPoints: number, metricKeys: readonly string[] = FLEET_LOAD_METRICS, signal?: AbortSignal): Promise<MetricSeries[]> {
  return queryMetrics({ metricKeys: [...metricKeys], hours, maxPoints, signal })
}
