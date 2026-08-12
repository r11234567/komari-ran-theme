import { timestampDate, timestampFromDate } from '@bufbuild/protobuf/wkt'
import { metrics } from '@/api/client'

export interface MetricPoint { time: string; value: number | null }
export interface MetricSeries { metric_key: string; entity_id: string; tags?: Record<string, string>; interval_seconds?: number; points: MetricPoint[] }
export interface PingQualityStat {
  task_id?: string | number; name?: string; tags?: Record<string, string>; total?: number; valid?: number; loss?: number
  min?: number; max?: number; avg?: number; latest?: number; p50?: number; p99?: number; stddev?: number; p99_p50_ratio?: number
}

export const FLEET_LOAD_METRICS = ['cpu.usage', 'memory.used', 'memory.total', 'disk.used', 'disk.total', 'net.in.rate', 'net.out.rate', 'load.average'] as const
export const FLEET_LOAD_METRICS_NO_DISK = ['cpu.usage', 'memory.used', 'memory.total', 'net.in.rate', 'net.out.rate'] as const

const options = (signal?: AbortSignal, timeoutMs = 30_000) => ({ signal, timeoutMs })
const toLegacySeries = (series: Awaited<ReturnType<typeof metrics.queryMetrics>>['series'][number]): MetricSeries => ({
  metric_key: series.metric, entity_id: series.agentId, tags: series.labels,
  interval_seconds: series.interval ? Number(series.interval.seconds) : undefined,
  points: series.queryPoints.map((point) => ({ time: point.observedAt ? timestampDate(point.observedAt).toISOString() : '', value: point.value ?? null })),
})

export async function queryMetrics(input: { metricKeys: string[]; entityId?: string; entityIds?: string[]; hours?: number; start?: string; maxPoints?: number; downsample?: boolean; signal?: AbortSignal }): Promise<MetricSeries[]> {
  const end = new Date()
  const start = input.start ? new Date(input.start) : new Date(end.getTime() - (input.hours ?? 1) * 3_600_000)
  const response = await metrics.queryMetrics({
    agentIds: input.entityIds ?? (input.entityId ? [input.entityId] : []), metrics: input.metricKeys,
    startTime: timestampFromDate(start), endTime: timestampFromDate(end), maxPoints: input.maxPoints ?? 500,
    downsample: input.downsample, fillEmpty: true,
  }, options(input.signal))
  return response.series.map(toLegacySeries)
}

export async function fetchPingQuality(uuid: string, hours = 24, signal?: AbortSignal): Promise<PingQualityStat[]> {
  const end = new Date(); const start = new Date(end.getTime() - hours * 3_600_000)
  const response = await metrics.getPingStats({ agentIds: [uuid], startTime: timestampFromDate(start), endTime: timestampFromDate(end), maxPoints: 500 }, options(signal))
  return response.stats.map((stat) => ({
    task_id: stat.taskId.toString(), name: stat.name, tags: stat.tags, total: stat.total, valid: stat.valid,
    loss: stat.lossPercent, min: stat.minimum, max: stat.maximum, avg: stat.average, latest: stat.latest,
    p50: stat.p50, p99: stat.p99, stddev: stat.standardDeviation, p99_p50_ratio: stat.p99P50Ratio,
  }))
}

export async function queryFleetLoad(hours: number, maxPoints: number, metricKeys: readonly string[] = FLEET_LOAD_METRICS, signal?: AbortSignal): Promise<MetricSeries[]> {
  return queryMetrics({ metricKeys: [...metricKeys], hours, maxPoints, signal })
}
