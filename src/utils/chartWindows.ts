export interface ChartWindow {
  key: string
  label: string
  hours: number
  realtime?: boolean
}

export function chartWindowLabel(hours: number): string {
  if (hours < 24) return `${hours}H`
  return `${hours / 24}D`
}

export function chartAxisLabels(hours: number): string[] {
  return Array.from({ length: 7 }, (_, index) => {
    if (index === 6) return 'now'
    const remaining = hours * (1 - index / 6)
    return remaining < 24 ? `-${Math.round(remaining)}h` : `-${Math.round(remaining / 24)}d`
  })
}

export function buildChartWindows(retentionHours: number): ChartWindow[] {
  const limit = Number.isFinite(retentionHours) && retentionHours > 0 ? retentionHours : 24
  const history = [1, 6, 12, 24, 24 * 7]
  for (let hours = 24 * 15; hours <= limit; hours += 24 * 15) history.push(hours)
  const unique = [...new Set(history)].filter((hours) => hours <= limit)
  const windows: ChartWindow[] = [{ key: 'live', label: '实时', hours: 1, realtime: true }]
  windows.push(...unique.map((hours) => ({ key: `${hours}h`, label: chartWindowLabel(hours), hours })))
  return windows
}
