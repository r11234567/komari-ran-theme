/**
 * Traffic quota — derived purely from Komari's own fields.
 *
 * Komari owns the entire traffic pipeline; the theme only renders it:
 *   - the agent accumulates `network_total_up/down` and resets them on the
 *     day configured by its `--month-rotate` flag,
 *   - the admin sets a per-node threshold (`traffic_limit`, in bytes) and a
 *     comparison mode (`traffic_limit_type`).
 *
 * We invent nothing: no parsing of the free-text `tags` label (users may
 * write anything there — it is decoration, not data), no local accumulation,
 * no guessing at the reset day. A limit of 0 means unlimited, and Komari's
 * own admin UI says as much ("设置为 0 B 禁用"), so we hide the bar entirely.
 */
import type { KomariNode, KomariRecord } from '@/types/komari'

export interface TrafficResetInfo {
  resetDay?: number
  resetTime?: string
  resetTimezone?: string
  nextReset?: string
  /** Formatted schedule description: e.g. "每月 1 日 00:00 (Asia/Shanghai)" */
  scheduleText?: string
  /** Next reset instant formatted: e.g. "2026-12-01 00:00" */
  nextResetFormatted?: string
  /** Human-readable remaining countdown: e.g. "22 天 6 小时" */
  remainingText?: string
  /** Short badge text: e.g. "还有 22 天" / "1 日重置" */
  badgeText?: string
  /** Full tooltip description */
  tooltip?: string
}

export interface TrafficQuota {
  /** Bytes counted against the limit, per the node's comparison mode. */
  used: number
  /** Threshold in bytes (always > 0 here). */
  limit: number
  /** used / limit, clamped to [0, 1] for bar geometry. */
  ratio: number
  /** Uncapped percentage — may exceed 100 when over quota. */
  percent: number
  /** Comparison mode actually applied. */
  mode: 'max' | 'sum'
  /** Raw cumulative counters, shown alongside the bar. */
  up: number
  down: number
  /** Severity band, drives bar color. */
  level: 'ok' | 'warn' | 'crit'
  /** Authoritative traffic reset schedule and countdown info */
  reset?: TrafficResetInfo
}

/** Formats a monthly reset schedule string. */
export function formatTrafficResetSchedule(
  day?: number,
  time = '00:00:00',
  timezone = 'Asia/Shanghai',
): string {
  if (day == null) return ''
  if (day === 0) return '不设置月度重置'
  const clock =
    time.length === 8 && time.endsWith(':00') ? time.slice(0, 5) : time || '00:00'
  return `每月 ${day} 日 ${clock}${timezone ? ` (${timezone})` : ''}`
}

/** Formats a timestamp into YYYY-MM-DD HH:mm for display. */
export function formatTrafficResetInstant(
  instant?: string,
  timezone?: string,
): string {
  if (!instant) return ''
  try {
    const date = new Date(instant)
    if (isNaN(date.getTime())) return ''
    const fixed = /^UTC([+-])(\d{2}):(\d{2})$/.exec(timezone || '')
    if (fixed) {
      const minutes =
        (Number(fixed[2]) * 60 + Number(fixed[3])) * (fixed[1] === '-' ? -1 : 1)
      return new Date(date.getTime() + minutes * 60_000)
        .toISOString()
        .slice(0, 16)
        .replace('T', ' ')
    }
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date)
  } catch {
    return instant.slice(0, 16).replace('T', ' ')
  }
}

/** Calculates human-readable countdown to next reset. */
export function formatTrafficResetRemaining(
  instant?: string,
  now = new Date(),
): string {
  if (!instant) return ''
  const target = new Date(instant)
  const diffMs = target.getTime() - now.getTime()
  if (isNaN(diffMs) || diffMs <= 0) return '即将重置'

  const days = Math.floor(diffMs / (24 * 3600 * 1000))
  const hours = Math.floor((diffMs % (24 * 3600 * 1000)) / (3600 * 1000))
  const minutes = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000))

  if (days > 0) return `${days} 天 ${hours} 小时`
  if (hours > 0) return `${hours} 小时 ${minutes} 分钟`
  if (minutes > 0) return `${minutes} 分钟`
  return '即将重置'
}

/** Generates compact badge text for reset schedule. */
export function formatTrafficResetBadge(
  day?: number,
  instant?: string,
  now = new Date(),
): string {
  if (instant) {
    const target = new Date(instant)
    const diffMs = target.getTime() - now.getTime()
    if (!isNaN(diffMs) && diffMs > 0) {
      const days = Math.floor(diffMs / (24 * 3600 * 1000))
      const hours = Math.floor((diffMs % (24 * 3600 * 1000)) / (3600 * 1000))
      if (days > 0) return `还有 ${days} 天`
      if (hours > 0) return `还有 ${hours} 小时`
      const minutes = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000))
      if (minutes > 0) return `还有 ${minutes} 分钟`
      return '即将重置'
    }
  }
  if (day && day >= 1 && day <= 31) {
    return `${day} 日重置`
  }
  return ''
}

/** Computes next reset schedule and relative countdown info. */
export function computeTrafficResetInfo(
  node: KomariNode,
  now = new Date(),
): TrafficResetInfo | undefined {
  const day = node.traffic_reset_day
  const time = node.traffic_reset_time || '00:00:00'
  const timezone = node.traffic_reset_timezone || 'Asia/Shanghai'
  let nextReset = node.traffic_next_reset

  if (day == null && !nextReset) return undefined
  if (day === 0) {
    return {
      resetDay: 0,
      scheduleText: '不设置月度重置',
      badgeText: '',
      tooltip: '不设置月度重置',
    }
  }

  // Pure client fallback when next_reset is missing but reset_day is active (1-31)
  if (!nextReset && day && day >= 1 && day <= 31) {
    try {
      const parts = time.split(':').map((s) => Number(s) || 0)
      const hour = parts[0] ?? 0
      const minute = parts[1] ?? 0
      const second = parts[2] ?? 0
      const year = now.getUTCFullYear()
      const month = now.getUTCMonth()
      let candidate = new Date(Date.UTC(year, month, day, hour, minute, second))
      if (candidate.getTime() <= now.getTime()) {
        candidate = new Date(Date.UTC(year, month + 1, day, hour, minute, second))
      }
      nextReset = candidate.toISOString()
    } catch {
      // ignore
    }
  }

  const scheduleText = formatTrafficResetSchedule(day, time, timezone)
  const nextResetFormatted = formatTrafficResetInstant(nextReset, timezone)
  const remainingText = formatTrafficResetRemaining(nextReset, now)
  const badgeText = formatTrafficResetBadge(day, nextReset, now)

  const tooltipParts: string[] = []
  if (scheduleText) tooltipParts.push(`重置周期: ${scheduleText}`)
  if (nextResetFormatted) {
    tooltipParts.push(`下次重置: ${nextResetFormatted}${remainingText ? `（还有 ${remainingText}）` : ''}`)
  }
  const tooltip = tooltipParts.join(' · ') || undefined

  return {
    resetDay: day,
    resetTime: time,
    resetTimezone: timezone,
    nextReset,
    scheduleText,
    nextResetFormatted,
    remainingText,
    badgeText,
    tooltip,
  }
}

/**
 * Returns undefined when the node has no traffic threshold configured
 * (unlimited) or when the counters have not been reported yet — callers
 * render nothing in that case.
 */
export function computeTrafficQuota(
  node: KomariNode,
  record?: KomariRecord,
  now = new Date(),
): TrafficQuota | undefined {
  const limit = node.traffic_limit ?? 0
  if (!Number.isFinite(limit) || limit <= 0) return undefined

  const up = record?.network_total_up
  const down = record?.network_total_down
  if (up == null && down == null) return undefined

  const u = up ?? 0
  const d = down ?? 0
  const mode: 'max' | 'sum' = node.traffic_limit_type === 'sum' ? 'sum' : 'max'
  const used = mode === 'sum' ? u + d : Math.max(u, d)

  const percent = (used / limit) * 100
  const ratio = Math.min(1, Math.max(0, used / limit))
  const level: TrafficQuota['level'] = percent >= 85 ? 'crit' : percent >= 60 ? 'warn' : 'ok'
  const reset = computeTrafficResetInfo(node, now)

  return { used, limit, ratio, percent, mode, up: u, down: d, level, reset }
}

/** Bar fill color for a severity band. */
export function trafficColor(level: TrafficQuota['level']): string {
  if (level === 'crit') return 'var(--signal-bad)'
  if (level === 'warn') return 'var(--signal-warn)'
  return 'var(--signal-good)'
}

/**
 * Percent label, kept readable at both extremes: two decimals while the bar
 * is still a sliver (0.04% reads better than 0%), one below ten, none above.
 */
export function formatTrafficPercent(percent: number): string {
  if (percent > 0 && percent < 1) return `${percent.toFixed(2)}%`
  if (percent < 10) return `${percent.toFixed(1)}%`
  return `${percent.toFixed(0)}%`
}
