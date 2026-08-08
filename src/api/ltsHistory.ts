import type { LoadHistory, PingHistory } from '@/api/client'

const HISTORY_ENDPOINT = '/api/v1/history/query'
const HISTORY_TIMEOUT_MS = 25_000
const UNAVAILABLE_STATUSES = new Set([404, 405, 501])

interface HistoryPoint {
  time: string
  avg?: number
  min?: number
  max?: number
  loss_count?: number
  total_count?: number
  metrics?: Record<string, number>
}

interface PingSummary {
  total_count?: number
  loss_count?: number
  valid_count?: number
  avg?: number
  min?: number
  max?: number
}

interface HistorySeries {
  kind: 'load' | 'ping' | string
  client?: string
  task_id?: number
  ping_summary?: PingSummary
  points?: HistoryPoint[]
}

interface HistoryResponse {
  series?: HistorySeries[]
}

interface PublicPingTask {
  id: number
  name: string
  interval?: number
  type?: string
  clients?: string[]
}

export function historyMaxPoints(hours: number): number {
  if (hours <= 6) return 1_500
  if (hours <= 24) return 2_000
  if (hours <= 7 * 24) return 3_000
  return 5_000
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  const payload = (await response.json()) as T | { data?: T }
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data?: T }).data as T
  }
  return payload as T
}

async function queryHistory(
  type: 'load' | 'ping',
  uuid: string,
  hours: number,
  maxPoints: number,
  base: string,
): Promise<HistoryResponse | null> {
  const controller = new AbortController()
  const timeout = window.setTimeout(
    () => controller.abort(new DOMException('History request timed out', 'TimeoutError')),
    HISTORY_TIMEOUT_MS,
  )
  try {
    const response = await fetch(`${base}${HISTORY_ENDPOINT}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ type, uuid, hours, max_points: maxPoints }),
      signal: controller.signal,
    })
    if (UNAVAILABLE_STATUSES.has(response.status)) return null
    if (!response.ok) throw new Error(`${HISTORY_ENDPOINT}: HTTP ${response.status}`)
    const payload = (await response.json()) as unknown
    const result =
      payload && typeof payload === 'object' && 'data' in payload
        ? (payload as { data?: HistoryResponse }).data
        : (payload as HistoryResponse)
    return result && Array.isArray(result.series) ? result : null
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function fetchBoundedLoadHistory(
  uuid: string,
  hours: number,
  base = '',
): Promise<LoadHistory | null> {
  const result = await queryHistory('load', uuid, hours, historyMaxPoints(hours), base)
  if (!result) return null
  const series = result.series?.find((item) => item.kind === 'load')
  const records = (series?.points ?? []).map((point) => {
    const metrics = point.metrics ?? {}
    return {
      time: point.time,
      cpu: metrics.cpu ?? 0,
      ram: metrics.ram ?? 0,
      ram_total: metrics.ram_total ?? 0,
      disk: metrics.disk ?? 0,
      disk_total: metrics.disk_total ?? 0,
      swap: metrics.swap ?? 0,
      swap_total: metrics.swap_total ?? 0,
      load: metrics.load ?? 0,
      net_in: metrics.net_in ?? 0,
      net_out: metrics.net_out ?? 0,
      net_total_up: metrics.net_total_up ?? 0,
      net_total_down: metrics.net_total_down ?? 0,
      process: metrics.process ?? 0,
      connections: metrics.connections ?? 0,
      connections_udp: metrics.connections_udp ?? 0,
    }
  })
  return { records, count: records.length }
}

export async function fetchBoundedPingHistory(
  uuid: string,
  hours: number,
  base = '',
): Promise<PingHistory | null> {
  const result = await queryHistory('ping', uuid, hours, historyMaxPoints(hours), base)
  if (!result) return null

  const records: PingHistory['records'] = []
  const summaries = new Map<number, PingSummary>()
  for (const series of result.series ?? []) {
    if (series.kind !== 'ping') continue
    const taskId = Number(series.task_id)
    if (!Number.isFinite(taskId)) continue
    summaries.set(taskId, series.ping_summary ?? {})
    for (const point of series.points ?? []) {
      const total = Number(point.total_count) || 0
      const loss = Number(point.loss_count) || 0
      records.push({
        task_id: taskId,
        time: point.time,
        value: total > 0 && total === loss ? -1 : Math.round(Number(point.avg) || 0),
        client: series.client ?? uuid,
      })
    }
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(
    () => controller.abort(new DOMException('Ping task request timed out', 'TimeoutError')),
    HISTORY_TIMEOUT_MS,
  )
  let definitions: PublicPingTask[] = []
  try {
    const payload = await getJson<PublicPingTask[]>(`${base}/api/task/ping`, controller.signal)
    definitions = Array.isArray(payload) ? payload : []
  } catch {
    definitions = []
  } finally {
    window.clearTimeout(timeout)
  }

  const matchingDefinitions = definitions.filter(
    (task) => !Array.isArray(task.clients) || task.clients.includes(uuid),
  )
  const taskIds = new Set<number>([
    ...summaries.keys(),
    ...matchingDefinitions.map((task) => Number(task.id)).filter(Number.isFinite),
  ])
  const definitionsById = new Map(matchingDefinitions.map((task) => [Number(task.id), task]))
  const tasks = [...taskIds].map((taskId) => {
    const definition = definitionsById.get(taskId)
    const summary = summaries.get(taskId) ?? {}
    const total = Number(summary.total_count) || 0
    const loss = Number(summary.loss_count) || 0
    return {
      id: taskId,
      name: definition?.name ?? `Task ${taskId}`,
      interval: definition?.interval ?? 0,
      type: definition?.type,
      loss: total > 0 ? (loss / total) * 100 : 0,
      avg: Number(summary.avg) || 0,
      min: Number(summary.min) || 0,
      max: Number(summary.max) || 0,
      total,
    }
  })

  records.sort((left, right) => left.time.localeCompare(right.time))
  return { records, tasks, count: records.length }
}
