import type { KomariPublicConfig } from '@/types/komari'

/**
 * A time window option that can be filtered by retention.
 * Any object with an `hours` field works — keeps callers free to add fields.
 */
interface HasHours {
  hours: number
}

export interface HistoryWindow {
  key: string
  label: string
  hours: number
  buckets: number
  titleSuffix: string
  xLabels: string[]
}

/** Default retention assumption when /api/public doesn't expose one (24h). */
const DEFAULT_RETENTION_HOURS = 24

/** Read the metric retention window (in hours) from the public config. */
export function getRecordRetentionHours(config: KomariPublicConfig | undefined): number {
  const v = config?.record_preserve_time
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v
  return DEFAULT_RETENTION_HOURS
}

/** Read the ping retention window (in hours) from the public config. */
export function getPingRetentionHours(config: KomariPublicConfig | undefined): number {
  const v = config?.ping_record_preserve_time
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v
  // Komari falls back to record retention if ping isn't set explicitly.
  return getRecordRetentionHours(config)
}

/**
 * Filter time-window options against an upper retention bound.
 *
 * Always keeps at least the smallest window so the UI never collapses to zero
 * options on a misconfigured / unreachable backend. The 1H window is virtually
 * always within retention so this is safe.
 */
export function filterWindowsByRetention<T extends HasHours>(
  windows: T[],
  retentionHours: number,
): T[] {
  if (!Number.isFinite(retentionHours) || retentionHours <= 0) return windows
  const allowed = windows.filter((w) => w.hours <= retentionHours)
  return allowed.length > 0 ? allowed : windows.slice(0, 1)
}

function historyWindowLabel(hours: number): string {
  if (hours < 24) return `${hours}H`
  return `${Math.round(hours / 24)}D`
}

function historyWindowAxis(hours: number): string[] {
  return Array.from({ length: 7 }, (_, index) => {
    if (index === 6) return 'now'
    const remaining = hours * (1 - index / 6)
    if (remaining < 24) return `-${Math.round(remaining)}h`
    return `-${Math.round(remaining / 24)}d`
  })
}

/**
 * Build the common load/Ping history windows supported by the Ran UI.
 * After 15 days, long windows advance in exact 15-day steps; an arbitrary
 * retention value is only a storage boundary and must not become a UI window.
 */
export function buildHistoricalWindows(retentionHours: number): HistoryWindow[] {
  const limit =
    Number.isFinite(retentionHours) && retentionHours > 0
      ? Math.floor(retentionHours)
      : DEFAULT_RETENTION_HOURS
  const hours = [1, 6, 12, 24, 24 * 7]
  for (let value = 24 * 15; value <= limit; value += 24 * 15) hours.push(value)

  const available = hours.filter((value) => value <= limit)
  if (available.length === 0) available.push(1)
  return available.map((value) => {
    const label = historyWindowLabel(value)
    return {
      key: `${value}h`,
      label,
      hours: value,
      buckets: Math.min(120, Math.max(60, Math.round(value * 2))),
      titleSuffix: label,
      xLabels: historyWindowAxis(value),
    }
  })
}
