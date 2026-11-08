import type { LoadHistory, LoadRecord } from '@/api/client'

/**
 * Bucket load records into evenly-spaced slots over the last `windowMs`.
 * Returns numeric arrays for each metric (already ordered chronologically),
 * with zero-fill for empty slots.
 */
export interface LoadSeries {
  cpu: number[]
  ram: number[]
  disk: number[]
  netIn: number[]
  netOut: number[]
  load: number[]
  gpu: number[]
  vram: number[]
}

export function bucketLoadHistory(
  history: LoadHistory,
  buckets = 60,
  windowMs = 60 * 60 * 1000,
): LoadSeries {
  const empty = (): number[] => new Array(buckets).fill(0)
  const counts = empty()
  const gpuCounts = empty()
  const vramCounts = empty()
  const series: LoadSeries = {
    cpu: empty(),
    ram: empty(),
    disk: empty(),
    netIn: empty(),
    netOut: empty(),
    load: empty(),
    gpu: empty(),
    vram: empty(),
  }

  if (!history?.records?.length) return series

  const now = Date.now()
  const start = now - windowMs
  const bucketMs = windowMs / buckets

  // Aggregate sums + counts
  const sums: LoadSeries = {
    cpu: empty(),
    ram: empty(),
    disk: empty(),
    netIn: empty(),
    netOut: empty(),
    load: empty(),
    gpu: empty(),
    vram: empty(),
  }

  for (const r of history.records) {
    const t = new Date(r.time).getTime()
    if (!Number.isFinite(t) || t < start) continue
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor((t - start) / bucketMs)))
    counts[idx] += 1
    if (r.cpu != null) sums.cpu[idx] += r.cpu
    // ram + disk: Komari historically stores absolute bytes here even though
    // some deployments emit percent. If value is bytes (>100 with a known
    // total), convert; if already a percent, pass through.
    if (r.ram != null) {
      const pct =
        r.ram <= 100
          ? r.ram
          : r.ram_total && r.ram_total > 0
            ? (r.ram / r.ram_total) * 100
            : 0
      sums.ram[idx] += pct
    }
    if (r.disk != null) {
      const pct =
        r.disk <= 100
          ? r.disk
          : r.disk_total && r.disk_total > 0
            ? (r.disk / r.disk_total) * 100
            : 0
      sums.disk[idx] += pct
    }
    if (r.net_in != null) sums.netIn[idx] += r.net_in
    if (r.net_out != null) sums.netOut[idx] += r.net_out
    if (r.load != null) sums.load[idx] += r.load
    if (r.gpu != null) {
      sums.gpu[idx] += r.gpu
      gpuCounts[idx] += 1
    }
    if (r.vram != null) {
      const pct =
        r.vram <= 100
          ? r.vram
          : r.vram_total && r.vram_total > 0
            ? (r.vram / r.vram_total) * 100
            : 0
      sums.vram[idx] += pct
      vramCounts[idx] += 1
    }
  }

  // Average each filled bucket; for empty buckets, forward-fill the previous
  // value so the curve stays continuous instead of dropping to 0. This fixes
  // the sawtooth seen on the 6H window, where bucket count exceeds the sample
  // count and >half the buckets would otherwise be zero-filled.
  const generalKeys: (keyof LoadSeries)[] = ['cpu', 'ram', 'disk', 'netIn', 'netOut', 'load']
  const last: Record<string, number | null> = {
    cpu: null, ram: null, disk: null, netIn: null, netOut: null, load: null, gpu: null, vram: null,
  }
  for (let i = 0; i < buckets; i++) {
    const n = counts[i]
    if (n > 0) {
      for (const k of generalKeys) {
        const v = sums[k][i] / n
        series[k][i] = v
        last[k] = v
      }
    } else {
      for (const k of generalKeys) {
        series[k][i] = last[k] ?? 0
      }
    }

    // GPU specific averaging and forward fill
    const nGpu = gpuCounts[i]
    if (nGpu > 0) {
      const v = sums.gpu[i] / nGpu
      series.gpu[i] = v
      last.gpu = v
    } else {
      series.gpu[i] = last.gpu ?? 0
    }

    // VRAM specific averaging and forward fill
    const nVram = vramCounts[i]
    if (nVram > 0) {
      const v = sums.vram[i] / nVram
      series.vram[i] = v
      last.vram = v
    } else {
      series.vram[i] = last.vram ?? 0
    }
  }

  return series
}

/** True if history has any records we can plot. */
export function hasLoadData(h: LoadHistory): boolean {
  return (h?.records?.length ?? 0) > 0
}

export type { LoadHistory, LoadRecord }
