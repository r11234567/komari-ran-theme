import { useEffect, useState } from 'react'
import type { LoadHistory, LoadRecord } from '@/api/client'
import type { KomariRecord } from '@/types/komari'

const EMPTY: LoadHistory = { count: 0, records: [] }

interface LiveLoadState {
  uuid: string
  history: LoadHistory
}

/** Keep a browser-side rolling load series from Komari's one-second WS feed. */
export function useLiveLoadHistory(
  uuid: string,
  record: KomariRecord | undefined,
  lastUpdate: number | null | undefined,
  windowMinutes = 10,
): LoadHistory {
  const [state, setState] = useState<LiveLoadState>({ uuid, history: EMPTY })

  useEffect(() => {
    if (!uuid || !record?.online || !lastUpdate) return
    const point: LoadRecord = {
      time: new Date(lastUpdate).toISOString(),
      cpu: record.cpu,
      ram: record.memory_used,
      ram_total: record.memory_total,
      disk: record.disk_used,
      disk_total: record.disk_total,
      load: record.load1,
      net_in: record.network_rx,
      net_out: record.network_tx,
      process: record.process,
      connections: (record.tcp ?? 0) + (record.udp ?? 0),
      connections_udp: record.udp,
    }
    const cutoff = lastUpdate - windowMinutes * 60_000
    setState((previous) => {
      const previousRecords = previous.uuid === uuid ? previous.history.records : []
      const records = previousRecords.filter((item) => new Date(item.time).getTime() >= cutoff)
      if (records[records.length - 1]?.time === point.time) return previous
      records.push(point)
      return { uuid, history: { count: records.length, records } }
    })
  }, [uuid, record, lastUpdate, windowMinutes])

  return state.uuid === uuid ? state.history : EMPTY
}
