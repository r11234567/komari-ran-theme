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

/** True when two records are visually identical (ignoring updated_at/uptime). */
export function wsRecordEqual(a: KomariRecord, b: KomariRecord): boolean {
  for (const k of STREAM_SIGNIFICANT_FIELDS) {
    if (a[k] !== b[k]) return false
  }
  return true
}

/** "JP-TYO" → "JP". Returns the 2-letter prefix or undefined. */
function deriveFlag(region?: string): string | undefined {
  if (!region) return undefined
  const code = region.split('-')[0]?.toUpperCase()
  if (!code || code.length !== 2) return undefined
  return code
}
