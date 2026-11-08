import type { GpuDevice, KomariRecord } from '@/types/komari'

export interface ExtractedGpu {
  hasGpu: boolean
  hasVram: boolean
  count: number
  avgUsage?: number
  averageUsage?: number
  vramPct?: number
  vramPercent?: number
  totalMemUsed?: number
  totalMemTotal?: number
  devices: GpuDevice[]
  primaryDevice?: GpuDevice
}

/**
 * Extract parsed GPU and VRAM metrics from a KomariRecord.
 * Returns null if the backend sent no GPU data, allowing callers to auto-hide GPU UI elements.
 */
export function getRecordGpu(record?: KomariRecord): ExtractedGpu | null {
  const gpu = record?.gpu
  if (!gpu || gpu.count <= 0) return null

  const devices = gpu.detailed_info ?? []
  let avgUsage = gpu.average_usage
  if (avgUsage === undefined && devices.length > 0) {
    let sum = 0
    let count = 0
    for (const d of devices) {
      if (typeof d.utilization === 'number' && Number.isFinite(d.utilization)) {
        sum += d.utilization
        count++
      }
    }
    if (count > 0) avgUsage = sum / count
  }

  let totalMemUsed = 0
  let totalMemTotal = 0
  let hasVram = false

  for (const d of devices) {
    if (d.memory_total && d.memory_total > 0) {
      hasVram = true
      totalMemTotal += d.memory_total
      totalMemUsed += d.memory_used ?? 0
    }
  }

  const vramPct =
    hasVram && totalMemTotal > 0 ? (totalMemUsed / totalMemTotal) * 100 : undefined

  // If there's neither utilization nor devices nor vram, don't show phantom GPU
  if (avgUsage === undefined && !hasVram && devices.length === 0) {
    return null
  }

  return {
    hasGpu: true,
    hasVram,
    count: gpu.count,
    avgUsage,
    averageUsage: avgUsage,
    vramPct,
    vramPercent: vramPct,
    totalMemUsed: hasVram ? totalMemUsed : undefined,
    totalMemTotal: hasVram ? totalMemTotal : undefined,
    devices,
    primaryDevice: devices[0],
  }
}

/**
 * Checks whether any node across the provided records has GPU data.
 * Used by tables to conditionally show/hide GPU and VRAM columns.
 */
export function hasAnyGpu(
  records: Record<string, KomariRecord> | KomariRecord[] | undefined,
): boolean {
  if (!records) return false
  const list = Array.isArray(records) ? records : Object.values(records)
  return list.some((r) => getRecordGpu(r) !== null)
}
