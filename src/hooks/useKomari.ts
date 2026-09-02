import { useEffect, useMemo, useState } from 'react'
import { fetchMe, fetchNodes, fetchPublic, watchLiveStatus } from '@/api/client'
import { fetchFleetPing } from '@/api/ping'
import type { PingHistory } from '@/api/client'
import { normalizeNode, wsRecordEqual } from '@/api/normalize'
import type {
  KomariMe,
  KomariNode,
  KomariPublicConfig,
  KomariRecord,
} from '@/types/komari'

export type ConnStatus = 'connecting' | 'open' | 'closed' | 'error' | 'idle'

interface KomariState {
  nodes: KomariNode[]
  records: Record<string, KomariRecord>
  config: KomariPublicConfig
  /** Current session — logged_in determines whether hidden nodes appear. */
  me: KomariMe
  conn: ConnStatus
  error: string | null
  ping: PingHistory
  /** Timestamp of the most recent successful Connect stream message (ms). */
  lastUpdate: number | null
}

const INITIAL: KomariState = {
  nodes: [],
  records: {},
  config: {},
  me: { logged_in: false },
  conn: 'idle',
  error: null,
  ping: { count: 0, tasks: [], records: [] },
  lastUpdate: null,
}

/**
 * mergePingIntoRecords — fold per-node ping latency + loss into the live
 * records map. Reads PingHistory.records (each carries `client = uuid`,
 * `value = latency ms`, `value <= 0` meaning a lost ping), groups by uuid,
 * computes the average latency and loss percentage over the recent window,
 * and writes them onto each record's `ping` / `loss` fields.
 *
 * Ping data is fetched separately on a 60s interval, so this folds in
 * lazily — first paint may show '—' for ping/loss for a beat. That's fine.
 */
function mergePingIntoRecords(
  records: Record<string, KomariRecord>,
  ping: PingHistory,
): Record<string, KomariRecord> {
  const pingRecords = Array.isArray(ping?.records) ? ping.records : []
  if (pingRecords.length === 0) return records

  // Group typed Ping samples by agent UUID.
  const byUuid = new Map<string, { values: number[]; lost: number; total: number }>()
  for (const r of pingRecords) {
    const uuid = r?.client
    if (!uuid) continue
    let slot = byUuid.get(uuid)
    if (!slot) {
      slot = { values: [], lost: 0, total: 0 }
      byUuid.set(uuid, slot)
    }
    slot.total += 1
    if (r.value > 0) slot.values.push(r.value)
    else slot.lost += 1
  }

  if (byUuid.size === 0) return records

  // Allocate a new map only when a value actually changes — and only replace
  // a node's record object when its ping/loss differs. This keeps referential
  // equality for unchanged nodes so memoized consumers skip re-rendering.
  let out: Record<string, KomariRecord> | null = null
  for (const [uuid, slot] of byUuid) {
    const existing = records[uuid]
    if (!existing) continue
    const avg =
      slot.values.length === 0
        ? undefined
        : slot.values.reduce((a, b) => a + b, 0) / slot.values.length
    const loss = slot.total > 0 ? (slot.lost / slot.total) * 100 : undefined
    if (existing.ping === avg && existing.loss === loss) continue
    if (!out) out = { ...records }
    out[uuid] = { ...existing, ping: avg, loss }
  }
  return out ?? records
}

/**
 * useKomari — wires typed browser reads + the Connect status stream.
 * - The stream is cancelled when the theme unmounts.
 * - Ping history refreshes every 60s; covers the last 1 hour of all targets.
 * - `records` returned from this hook has per-node ping/loss merged in
 *   from the typed metrics service.
 */
export function useKomari(): KomariState {
  const [state, setState] = useState<KomariState>(INITIAL)

  useEffect(() => {
    let cancelled = false
    let loadedNodes: KomariNode[] = []

    const controller = new AbortController()
    const refreshPing = (nodes = loadedNodes) => {
      // One query for the whole fleet: the metrics service takes an agent list
      // and its bucket interval depends on the window, not on the agent count.
      fetchFleetPing(nodes.map((node) => node.uuid), 1, 240, { signal: controller.signal })
        .then((byUuid) => Object.values(byUuid))
        .then((histories) => ({
          count: histories.reduce((total, item) => total + item.records.length, 0),
          tasks: [...new Map(histories.flatMap((item) => item.tasks).map((task) => [task.id, task])).values()],
          records: histories.flatMap((item) => item.records),
        }))
        .then((ping) => {
          if (!cancelled) setState((prev) => ({ ...prev, ping }))
        })
        .catch((error) => {
          if (!controller.signal.aborted) console.warn('[ran] Connect ping query failed', error)
        })
    }

    Promise.all([fetchNodes(controller.signal), fetchPublic(controller.signal), fetchMe()])
      .then(([rawNodes, config, me]) => {
        if (cancelled) return
        // Sort by `weight` ascending — Komari's admin drag-to-reorder writes
        // the resulting position into this field (weight 0 = top of list).
        // Nodes without a weight fall back to the end, then by name to keep
        // the order stable across renders.
        //
        // Hidden filter: nodes flagged hidden are visible only when the
        // viewer is logged in (i.e. an admin reviewing their fleet).
        // Anonymous visitors get only the public set.
        const isLoggedIn = me.logged_in === true
        const nodes = rawNodes
          .map(normalizeNode)
          .filter((n) => !n.hidden || isLoggedIn)
          .sort((a, b) => {
            const aw = a.weight ?? Number.POSITIVE_INFINITY
            const bw = b.weight ?? Number.POSITIVE_INFINITY
            if (aw !== bw) return aw - bw
            return (a.name ?? '').localeCompare(b.name ?? '')
          })
        loadedNodes = nodes
        setState((prev) => ({ ...prev, nodes, config, me }))
        refreshPing(nodes)
      })
      .catch((err) => {
        if (cancelled) return
        setState((prev) => ({ ...prev, error: String(err) }))
      })

    const pingTimer = setInterval(refreshPing, 60_000)

    const stream = watchLiveStatus({
      onStatus: (conn) => {
        if (cancelled) return
        setState((prev) => ({ ...prev, conn }))
      },
      onRecord: (uuid, next) => {
        if (cancelled) return
        setState((prev) => {
          const records: Record<string, KomariRecord> = { ...prev.records }
          const previous = prev.records[uuid]
          records[uuid] = previous && wsRecordEqual(previous, next) ? previous : next
          return { ...prev, records, lastUpdate: Date.now() }
        })
      },
    })

    return () => {
      cancelled = true
      controller.abort(new DOMException('Theme unmounted', 'AbortError'))
      clearInterval(pingTimer)
      stream.close()
    }
  }, [])

  // Fold per-node ping/loss into the records before exposing them. We do
  // this in a memo so a fresh ping query updates every consumer without
  // rebuilding the Connect stream state.
  const recordsWithPing = useMemo(
    () => mergePingIntoRecords(state.records, state.ping),
    [state.records, state.ping],
  )

  return { ...state, records: recordsWithPing }
}
