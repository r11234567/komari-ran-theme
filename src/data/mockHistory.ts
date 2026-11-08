import type { LoadHistory, LoadRecord } from '@/api/client'
import type { LoadSeries } from '@/utils/load'
import { MOCK_RECORDS } from './mock'

/**
 * Generate synthetic realistic load history for dev/preview and offline demo.
 * Ensures charts and sparklines always render vibrant continuous waveforms.
 */
export function generateMockLoadHistory(uuid: string, hours = 1, buckets = 60): {
  history: LoadHistory
  series: LoadSeries
} {
  const rec = MOCK_RECORDS[uuid]
  const baseCpu = rec?.cpu ?? 45
  const baseMem = rec?.memory_used && rec?.memory_total ? (rec.memory_used / rec.memory_total) * 100 : 50
  const baseDisk = rec?.disk_used && rec?.disk_total ? (rec.disk_used / rec.disk_total) * 100 : 40
  const baseNetRx = rec?.network_rx ?? 35_000_000
  const baseNetTx = rec?.network_tx ?? 28_000_000
  const baseLoad = rec?.load1 ?? 1.2

  const primaryGpu = rec?.gpu?.detailed_info?.[0]
  const hasGpu = Boolean(rec?.gpu && (rec.gpu.average_usage != null || primaryGpu != null))
  const baseGpu = rec?.gpu?.average_usage ?? (primaryGpu?.utilization ?? 0)
  const memTotal = primaryGpu?.memory_total ?? 0
  const memUsed = primaryGpu?.memory_used ?? 0
  const baseVram = memTotal > 0 ? (memUsed / memTotal) * 100 : 0

  const now = Date.now()
  const stepMs = (hours * 3600 * 1000) / buckets

  const records: LoadRecord[] = []
  const cpu: number[] = []
  const ram: number[] = []
  const disk: number[] = []
  const netIn: number[] = []
  const netOut: number[] = []
  const load: number[] = []
  const gpu: number[] = []
  const vram: number[] = []

  for (let i = 0; i < buckets; i++) {
    const t = new Date(now - (buckets - 1 - i) * stepMs).toISOString()
    // Smooth sinusoidal wave with pseudo-random jitter
    const phase = (i / buckets) * Math.PI * 4
    const jitter = Math.sin(i * 1.7) * 0.5 + Math.cos(i * 0.9) * 0.5

    const c = Math.max(5, Math.min(99, Math.round(baseCpu + Math.sin(phase) * 12 + jitter * 6)))
    const m = Math.max(10, Math.min(99, Math.round(baseMem + Math.sin(phase * 0.5) * 4 + jitter * 2)))
    const d = Math.max(5, Math.min(99, Math.round(baseDisk + Math.sin(phase * 0.2) * 1)))
    const rx = Math.max(1000, Math.round(baseNetRx * (0.7 + Math.sin(phase * 1.2) * 0.25 + jitter * 0.1)))
    const tx = Math.max(1000, Math.round(baseNetTx * (0.7 + Math.cos(phase * 1.2) * 0.25 + jitter * 0.1)))
    const l = Math.max(0.1, Number((baseLoad * (0.8 + Math.sin(phase) * 0.2 + jitter * 0.1)).toFixed(2)))

    const g = hasGpu ? Math.max(10, Math.min(100, Math.round(baseGpu + Math.cos(phase * 1.4) * 8 + jitter * 5))) : 0
    const v = hasGpu ? Math.max(10, Math.min(100, Math.round(baseVram + Math.sin(phase * 0.3) * 3 + jitter * 1.5))) : 0

    cpu.push(c)
    ram.push(m)
    disk.push(d)
    netIn.push(rx)
    netOut.push(tx)
    load.push(l)
    gpu.push(g)
    vram.push(v)

    records.push({
      time: t,
      cpu: c,
      ram: m,
      disk: d,
      net_in: rx,
      net_out: tx,
      load: l,
      gpu: hasGpu ? g : undefined,
      vram: hasGpu ? v : undefined,
    })
  }

  return {
    history: {
      count: records.length,
      records,
    },
    series: {
      cpu,
      ram,
      disk,
      netIn,
      netOut,
      load,
      gpu,
      vram,
    },
  }
}
