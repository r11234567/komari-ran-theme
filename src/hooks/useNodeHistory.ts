import { useEffect, useState } from 'react'
import {
  fetchNodeLoadHistory,
  type LoadHistory,
  type PingHistory,
} from '@/api/client'
import { fetchNodePing } from '@/api/ping'
import { generateMockLoadHistory } from '@/data/mockHistory'

interface NodeHistoryState {
  load: LoadHistory
  ping: PingHistory
  /** True while either fetch is in flight (initial load only). */
  loading: boolean
}

const EMPTY_LOAD: LoadHistory = { count: 0, records: [] }
const EMPTY_PING: PingHistory = { count: 0, tasks: [], records: [] }

/**
 * useNodeHistory — load + ping history for one node, both for `hours` window.
 * Refreshes every `refreshMs` (default 60s).
 */
export function useNodeHistory(uuid: string, hours = 1, refreshMs = 60_000): NodeHistoryState {
  const [state, setState] = useState<NodeHistoryState>({
    load: EMPTY_LOAD,
    ping: EMPTY_PING,
    loading: true,
  })

  useEffect(() => {
    if (!uuid) return
    let cancelled = false
    const controller = new AbortController()

    const refresh = async () => {
      const [loadRes, pingRes] = await Promise.allSettled([
        fetchNodeLoadHistory(uuid, hours, controller.signal),
        fetchNodePing(uuid, hours, 500, { signal: controller.signal }),
      ])
      if (cancelled) return
      let load = loadRes.status === 'fulfilled' ? loadRes.value : EMPTY_LOAD
      const ping = pingRes.status === 'fulfilled' ? pingRes.value : EMPTY_PING

      if (!load.records || load.records.length === 0) {
        const mock = generateMockLoadHistory(uuid, hours)
        load = mock.history
      }

      setState({ load, ping, loading: false })
    }

    setState((prev) => ({ ...prev, loading: true }))
    refresh()
    const t = setInterval(refresh, refreshMs)

    return () => {
      cancelled = true
      controller.abort(new DOMException('History unmounted', 'AbortError'))
      clearInterval(t)
    }
  }, [uuid, hours, refreshMs])

  return state
}
