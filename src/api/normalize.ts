import type { KomariNode, KomariRecord } from '@/types/komari'

/**
 * Normalize the typed browser node into the internal theme model.
 * Fills `flag` from region if missing.
 */
export function normalizeNode(raw: KomariNode): KomariNode {
  return {
    ...raw,
    flag: raw.flag ?? deriveFlag(raw.region),
  }
}

/**
 * Display-significant fields for referential reuse. We deliberately EXCLUDE
 * `updated_at` (pure timestamp, ticks every poll) and `uptime` (increments
 * every second but is rendered at day/hour granularity). Two live records
 * equal on these fields render identically, so the stream reducer can reuse the
 * previous object reference and let React.memo skip the card. Idle/offline
 * nodes become fully stable; active nodes (fluctuating cpu/net) still update.
 */
const STREAM_SIGNIFICANT_FIELDS: (keyof KomariRecord)[] = [
  'online',
  'cpu',
  'memory_used',
  'memory_total',
  'swap_used',
  'swap_total',
  'disk_used',
  'disk_total',
  'network_tx',
  'network_rx',
  'network_total_up',
  'network_total_down',
  'tcp',
  'udp',
  'load1',
  'load5',
  'load15',
  'process',
  'os',
  'cpu_model',
  'message',
]

function isSameGpu(a?: KomariRecord['gpu'], b?: KomariRecord['gpu']): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  if (a.count !== b.count || a.average_usage !== b.average_usage) return false
  const aList = a.detailed_info ?? []
  const bList = b.detailed_info ?? []
  if (aList.length !== bList.length) return false
  for (let i = 0; i < aList.length; i++) {
    if (
      aList[i].name !== bList[i].name ||
      aList[i].utilization !== bList[i].utilization ||
      aList[i].memory_used !== bList[i].memory_used ||
      aList[i].memory_total !== bList[i].memory_total
    ) {
      return false
    }
  }
  return true
}

/** True when two records are visually identical (ignoring updated_at/uptime). */
export function wsRecordEqual(a: KomariRecord, b: KomariRecord): boolean {
  for (const k of STREAM_SIGNIFICANT_FIELDS) {
    if (a[k] !== b[k]) return false
  }
  return isSameGpu(a.gpu, b.gpu)
}

/** "JP-TYO" → "JP". Returns the 2-letter prefix or undefined. */
function deriveFlag(region?: string): string | undefined {
  if (!region) return undefined
  const code = region.split('-')[0]?.toUpperCase()
  if (!code || code.length !== 2) return undefined
  return code
}
