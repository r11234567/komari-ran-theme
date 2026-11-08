/**
 * useRecentEvents — derive "RECENT EVENTS" from node status transitions.
 *
 * Tracks node transitions:
 *   - online → offline    = '节点离线' / 'Node Offline'
 *   - offline → online    = '节点恢复在线' / 'Node Recovered'
 *   - good → degraded     = '节点进入降级' / 'Node Degraded'
 *   - degraded → good     = '节点恢复正常' / 'Node Normalized'
 *
 * Events are kept in localStorage (so they survive page reload) and capped
 * at `maxEvents` per session.
 *
 * Anti-flapping & initialization guards:
 *   - Hydration guard: suppresses false "Node Recovered" storm on page load.
 *   - Hysteresis: debounces momentary 1-second metric spikes.
 */

import { useEffect, useRef, useState } from 'react'
import type { KomariNode, KomariRecord } from '@/types/komari'
import { isRecordDegraded } from './useAggregateStats'
import { useI18n } from '@/i18n'

export type EventKind = 'down' | 'up' | 'degraded' | 'recovered'

export interface NodeEvent {
  t: number          // epoch ms
  uuid: string
  name: string
  kind: EventKind
  message: string    // human-readable, localized
}

const STORAGE_KEY = 'ran.v2.recentEvents'
const DEFAULT_MAX_EVENTS = 50
const DEFAULT_RETENTION_MS = 24 * 60 * 60 * 1000  // 24h
const FLAP_THRESHOLD_MS = 15_000                  // 15s debounce for degraded flapping

interface PerNodeState {
  online: boolean
  degraded: boolean
  lastTransition: number
}

function loadEvents(): NodeEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.filter(
      (e) =>
        e &&
        typeof e.t === 'number' &&
        typeof e.uuid === 'string' &&
        typeof e.kind === 'string' &&
        typeof e.message === 'string',
    )
  } catch {
    return []
  }
}

export function saveEvents(events: NodeEvent[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  } catch {
    // ignore
  }
}

export function clearEvents(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    window.dispatchEvent(new Event('ran.clearEvents'))
  } catch {
    // ignore
  }
}

function describe(
  kind: EventKind,
  t: (k: string, p?: Record<string, string | number>) => string,
): string {
  switch (kind) {
    case 'down': return t('alert.node_offline')
    case 'up': return t('alert.node_recovered')
    case 'degraded': return t('alert.enter_degraded')
    case 'recovered': return t('alert.recover_normal')
  }
}

export interface UseRecentEventsOptions {
  maxEvents?: number
  retentionMs?: number
}

export function useRecentEvents(
  nodes: KomariNode[],
  records: Record<string, KomariRecord>,
  options: UseRecentEventsOptions = {},
): NodeEvent[] {
  const { t } = useI18n()
  const maxEvents = options.maxEvents ?? DEFAULT_MAX_EVENTS
  const retentionMs = options.retentionMs ?? DEFAULT_RETENTION_MS
  const [events, setEvents] = useState<NodeEvent[]>(() => loadEvents())

  useEffect(() => {
    const handleClear = () => setEvents([])
    window.addEventListener('ran.clearEvents', handleClear)
    return () => window.removeEventListener('ran.clearEvents', handleClear)
  }, [])

  // Per-node prior state, retained across renders
  const priorState = useRef<Record<string, PerNodeState>>({})
  // Hydration ref: ignore the very first batch of records to avoid false "recovered online" events
  const isHydrated = useRef(false)

  useEffect(() => {
    // If no nodes or records map is still empty, do not run transition detection yet
    if (nodes.length === 0 || Object.keys(records).length === 0) {
      return
    }

    const now = Date.now()
    const cutoff = now - retentionMs

    // Baseline establishment: first time we see populated records
    if (!isHydrated.current) {
      for (const node of nodes) {
        const r = records[node.uuid]
        const isOnline = !!r?.online
        const isDegraded = isOnline && isRecordDegraded(r)
        priorState.current[node.uuid] = {
          online: isOnline,
          degraded: isDegraded,
          lastTransition: now,
        }
      }
      isHydrated.current = true
      return
    }

    const newEvents: NodeEvent[] = []

    for (const node of nodes) {
      const r = records[node.uuid]
      const isOnline = !!r?.online
      const isDegraded = isOnline && isRecordDegraded(r)
      const prior = priorState.current[node.uuid]
      const name = node.name ?? node.uuid.slice(0, 8)

      // Brand new node registered while running
      if (!prior) {
        priorState.current[node.uuid] = {
          online: isOnline,
          degraded: isDegraded,
          lastTransition: now,
        }
        continue
      }

      // Online state transition
      if (prior.online !== isOnline) {
        const kind: EventKind = isOnline ? 'up' : 'down'
        newEvents.push({
          t: now,
          uuid: node.uuid,
          name,
          kind,
          message: describe(kind, t),
        })
        priorState.current[node.uuid] = {
          online: isOnline,
          degraded: isDegraded,
          lastTransition: now,
        }
      } else if (isOnline) {
        // Online both before and after — check degraded transition with anti-flapping debounce
        if (prior.degraded !== isDegraded) {
          if (now - prior.lastTransition >= FLAP_THRESHOLD_MS) {
            const kind: EventKind = isDegraded ? 'degraded' : 'recovered'
            newEvents.push({
              t: now,
              uuid: node.uuid,
              name,
              kind,
              message: describe(kind, t),
            })
            priorState.current[node.uuid] = {
              online: isOnline,
              degraded: isDegraded,
              lastTransition: now,
            }
          }
        }
      }
    }

    if (newEvents.length === 0) {
      // Evict expired from storage occasionally
      const filtered = events.filter((e) => e.t >= cutoff)
      if (filtered.length !== events.length) {
        setEvents(filtered)
        saveEvents(filtered)
      }
      return
    }

    // Merge new events (newest first) and trim
    const merged = [...newEvents, ...events]
      .filter((e) => e.t >= cutoff)
      .sort((a, b) => b.t - a.t)
      .slice(0, maxEvents)

    setEvents(merged)
    saveEvents(merged)
  }, [nodes, records, maxEvents, retentionMs, t, events])

  return events
}
