import { createClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { timestampDate, timestampFromDate } from '@bufbuild/protobuf/wkt'
import { BrowserService } from '@komari/proto/komari/browser/v1/browser_pb'
import { MetricsService } from '@komari/proto/komari/metrics/v1/metrics_pb'
import type { AgentReport } from '@komari/proto/komari/report/v1/report_pb'
import type { KomariMe, KomariNode, KomariPublicConfig, KomariRecord } from '@/types/komari'

export interface PingTask {
  id: number
  name: string
  interval: number
  loss: number
  avg?: number
  min?: number
  max?: number
  total?: number
  type?: string
}

export interface PingRecord { task_id: number; time: string; value: number; client?: string }
export interface PingHistory { count: number; tasks: PingTask[]; records: PingRecord[] }
export interface LoadRecord {
  time: string; cpu?: number; ram?: number; ram_total?: number; disk?: number; disk_total?: number
  swap?: number; swap_total?: number; load?: number; net_in?: number; net_out?: number
  net_total_up?: number; net_total_down?: number; process?: number; connections?: number; connections_udp?: number
}
export interface LoadHistory { count: number; records: LoadRecord[] }

const baseUrl = () => (import.meta.env.VITE_KOMARI_BASE || window.location.origin).replace(/\/+$/, '')
const transport = createConnectTransport({
  baseUrl: baseUrl(), useBinaryFormat: true, defaultTimeoutMs: 20_000,
  fetch: (input, init) => fetch(input, { ...init, credentials: 'same-origin' }),
})
export const browser = createClient(BrowserService, transport)
export const metrics = createClient(MetricsService, transport)
const signalOptions = (signal?: AbortSignal, timeoutMs = 20_000) => ({ signal, timeoutMs })

const asNumber = (value: bigint | undefined) => Number(value ?? 0n)
const latestNetwork = (report?: AgentReport) => report?.networkInterfaces.find((item) => item.name === 'aggregate') ?? report?.networkInterfaces[0]
const latestDisk = (report?: AgentReport) => report?.disks.find((item) => item.mountPoint === 'aggregate') ?? report?.disks[0]

export function nodeFromSummary(summary: Awaited<ReturnType<typeof browser.listAgents>>['agents'][number]): KomariNode {
  const basic = summary.basicInfo
  return {
    uuid: summary.agentId, name: summary.name, os: basic?.os, cpu_name: basic?.cpuName,
    cpu_cores: basic?.cpuCores, arch: basic?.architecture, region: basic?.region, group: basic?.group,
    tags: basic?.tags, expired_at: basic?.expiresAt ? timestampDate(basic.expiresAt).toISOString() : undefined,
    price: basic?.price, billing_cycle: basic?.billingCycleDays, currency: basic?.currency,
    traffic_limit: asNumber(basic?.trafficLimitBytes), traffic_limit_type: basic?.trafficLimitType,
    weight: basic?.weight,
  }
}

export function recordFromReport(uuid: string, online: boolean, report?: AgentReport): KomariRecord {
  const resources = report?.resources
  const network = latestNetwork(report)
  const disk = latestDisk(report)
  return {
    uuid, online, cpu: resources?.cpuPercent, memory_used: asNumber(resources?.memoryUsedBytes),
    memory_total: asNumber(report?.system?.memoryTotalBytes), swap_used: asNumber(resources?.swapUsedBytes),
    swap_total: asNumber(resources?.swapTotalBytes), disk_used: asNumber(disk?.usedBytes), disk_total: asNumber(disk?.totalBytes),
    network_tx: asNumber(network?.bytesSentPerSecond), network_rx: asNumber(network?.bytesReceivedPerSecond),
    network_total_up: asNumber(network?.bytesSent), network_total_down: asNumber(network?.bytesReceived),
    tcp: asNumber(resources?.tcpConnectionCount), udp: asNumber(resources?.udpConnectionCount),
    load1: resources?.loadAverage[0], load5: resources?.loadAverage[1], load15: resources?.loadAverage[2],
    uptime: report?.system?.uptime ? Number(report.system.uptime.seconds) : undefined,
    process: asNumber(resources?.processCount), os: report?.system?.os, cpu_model: report?.system?.hostname,
    message: report?.diagnosticMessage, updated_at: report?.observedAt ? timestampDate(report.observedAt).toISOString() : undefined,
  }
}

export async function fetchNodes(signal?: AbortSignal): Promise<KomariNode[]> {
  const response = await browser.listAgents({}, signalOptions(signal))
  return response.agents.map(nodeFromSummary)
}

export async function fetchPublic(signal?: AbortSignal): Promise<KomariPublicConfig> {
  const info = await browser.getPublicInfo({}, signalOptions(signal))
  const themeSettings = info.themeSettings ?? {}
  return { sitename: info.siteName, description: info.siteDescription, record_preserve_time: info.metricRetentionDays * 24, theme: info.defaultTheme, theme_settings: themeSettings, custom_head: info.customHead, custom_body: info.customBody }
}

// Visibility is already enforced by BrowserService; themes never receive hidden nodes anonymously.
export async function fetchMe(): Promise<KomariMe> { return { logged_in: false } }

export function watchLiveStatus(opts: { onRecord: (uuid: string, record: KomariRecord) => void; onStatus?: (status: 'connecting' | 'open' | 'closed' | 'error') => void }) {
  const controller = new AbortController()
  opts.onStatus?.('connecting')
  void (async () => {
    let afterEventId = ''
    while (!controller.signal.aborted) {
      try {
        for await (const event of browser.watchAgentStatus({ afterEventId }, signalOptions(controller.signal, 0))) {
          if (!event.agent) continue
          afterEventId = event.agent.eventId || afterEventId
          opts.onStatus?.('open')
          opts.onRecord(event.agent.agentId, recordFromReport(event.agent.agentId, event.agent.status === 1, event.latestReport))
        }
      } catch (error) {
        if (!controller.signal.aborted) { console.warn('[ran] Connect status stream failed', error); opts.onStatus?.('error') }
      }
      if (!controller.signal.aborted) await new Promise((resolve) => window.setTimeout(resolve, 2_000))
    }
  })()
  return { close: () => controller.abort(new DOMException('Theme unmounted', 'AbortError')) }
}

export async function fetchNodeLoadHistory(uuid: string, hours = 1, signal?: AbortSignal): Promise<LoadHistory> {
  const end = new Date(); const start = new Date(end.getTime() - hours * 3_600_000)
  const response = await metrics.queryMetrics({ agentIds: [uuid], metrics: ['cpu.usage', 'memory.used', 'memory.total', 'disk.used', 'disk.total', 'net.in.rate', 'net.out.rate', 'net.total.up', 'net.total.down', 'load.average', 'process.count', 'connections.tcp', 'connections.udp'], startTime: timestampFromDate(start), endTime: timestampFromDate(end), maxPoints: 500, fillEmpty: false }, signalOptions(signal, 30_000))
  const byTime = new Map<string, LoadRecord>()
  for (const series of response.series) for (const point of series.queryPoints) {
    if (point.value == null || !point.observedAt) continue
    const time = timestampDate(point.observedAt).toISOString(); const row = byTime.get(time) ?? { time }; byTime.set(time, row)
    if (series.metric === 'cpu.usage') row.cpu = point.value
    if (series.metric === 'memory.used') row.ram = point.value
    if (series.metric === 'memory.total') row.ram_total = point.value
    if (series.metric === 'disk.used') row.disk = point.value
    if (series.metric === 'disk.total') row.disk_total = point.value
    if (series.metric === 'net.in.rate') row.net_in = point.value
    if (series.metric === 'net.out.rate') row.net_out = point.value
    if (series.metric === 'net.total.up') row.net_total_up = point.value
    if (series.metric === 'net.total.down') row.net_total_down = point.value
    if (series.metric === 'load.average') row.load = point.value
    if (series.metric === 'process.count') row.process = point.value
    if (series.metric === 'connections.tcp') row.connections = point.value
    if (series.metric === 'connections.udp') row.connections_udp = point.value
  }
  const records = [...byTime.values()].sort((left, right) => left.time.localeCompare(right.time))
  return { count: records.length, records }
}
