/**
 * useAttentionNeeded — pick the top-N nodes that most need operator attention.
 *
 * Severity scoring (additive — higher = more urgent):
 *
 *   100  offline                                  (highest priority)
 *    95  expired (< 0d)
 *    60  ping > 500ms  | 30  ping > 200ms
 *    50  loss > 20%    | 25  loss > 5%
 *    40  cpu > 95%     | 20  cpu > 80%
 *    35  mem > 95%     | 18  mem > 85%
 *    35  traffic >= 100% | 20 traffic >= 85%
 *    30  normalized load > 2.0 | 15 normalized load > 1.2
 *    25  disk > 95%    | 12  disk > 85%
 *    20  expiring < 3d | 10  expiring < 7d  |  5  expiring < 14d
 *
 * Multi-core load is normalized by cpu_cores. Localized via useI18n.
 */

import { useMemo } from 'react'
import type { KomariNode, KomariRecord } from '@/types/komari'
import { daysUntil, resolveRamPercent } from '@/utils/format'
import { computeTrafficQuota } from '@/utils/traffic'
import { useI18n } from '@/i18n'

export type AttentionSeverity = 'critical' | 'warning' | 'info'

export interface AttentionItem {
  node: KomariNode
  record?: KomariRecord
  score: number
  severity: AttentionSeverity
  reasons: string[]
  /** ISO timestamp of the strongest issue's "last seen" — for the LAST SEEN column */
  lastSeenISO?: string
}

interface Hit {
  score: number
  reason: string
}

function severityFromScore(score: number): AttentionSeverity {
  if (score >= 70) return 'critical'
  if (score >= 25) return 'warning'
  return 'info'
}

function fmt(v: number, decimals = 1): string {
  if (Math.abs(v) >= 100) return Math.round(v).toString()
  return v.toFixed(decimals).replace(/\.?0+$/, '')
}

function scoreNode(
  node: KomariNode,
  record: KomariRecord | undefined,
  t: (k: string, p?: Record<string, string | number>) => string,
): {
  score: number
  reasons: string[]
} {
  const hits: Hit[] = []

  // Offline trumps everything else
  if (!record || !record.online) {
    return { score: 100, reasons: [t('alert.node_offline')] }
  }

  // CPU
  if (typeof record.cpu === 'number') {
    if (record.cpu > 95) hits.push({ score: 40, reason: `${t('alert.high_cpu')} (${fmt(record.cpu, 0)}%)` })
    else if (record.cpu > 80) hits.push({ score: 20, reason: `${t('alert.high_cpu')} (${fmt(record.cpu, 0)}%)` })
  }

  // Memory
  const memPct = resolveRamPercent(record.memory_used, record.memory_total)
  if (typeof memPct === 'number') {
    if (memPct > 95) hits.push({ score: 35, reason: `${t('alert.high_mem')} (${fmt(memPct, 0)}%)` })
    else if (memPct > 85) hits.push({ score: 18, reason: `${t('alert.high_mem')} (${fmt(memPct, 0)}%)` })
  }

  // Normalized System Load (by CPU core count)
  if (typeof record.load1 === 'number') {
    const cores = Math.max(1, node.cpu_cores || 1)
    const normLoad = record.load1 / cores
    if (normLoad > 2.0) {
      hits.push({ score: 30, reason: `${t('alert.high_load')} (${record.load1.toFixed(1)} / ${cores}c)` })
    } else if (normLoad > 1.2) {
      hits.push({ score: 15, reason: `${t('alert.high_load')} (${record.load1.toFixed(1)} / ${cores}c)` })
    }
  }

  // Disk
  if (record.disk_used && record.disk_total && record.disk_total > 0) {
    const diskPct = (record.disk_used / record.disk_total) * 100
    if (diskPct > 95) hits.push({ score: 25, reason: `${t('alert.high_disk')} (${fmt(diskPct, 0)}%)` })
    else if (diskPct > 85) hits.push({ score: 12, reason: `${t('alert.high_disk')} (${fmt(diskPct, 0)}%)` })
  }

  // Ping latency
  if (typeof record.ping === 'number' && record.ping > 0) {
    if (record.ping > 500) hits.push({ score: 60, reason: `${t('alert.high_ping')} (${fmt(record.ping, 0)}ms)` })
    else if (record.ping > 200) hits.push({ score: 30, reason: `${t('alert.mod_ping')} (${fmt(record.ping, 0)}ms)` })
  }

  // Packet loss
  if (typeof record.loss === 'number') {
    if (record.loss > 20) hits.push({ score: 50, reason: `${t('alert.high_loss')} (${fmt(record.loss)}%)` })
    else if (record.loss > 5) hits.push({ score: 25, reason: `${t('alert.mod_loss')} (${fmt(record.loss)}%)` })
  }

  // Traffic quota limit
  const quota = computeTrafficQuota(node, record)
  if (quota) {
    if (quota.percent >= 100) {
      hits.push({ score: 35, reason: `${t('alert.traffic_exhausted')} (${quota.percent.toFixed(0)}%)` })
    } else if (quota.percent >= 85) {
      hits.push({ score: 20, reason: `${t('alert.traffic_warning')} (${quota.percent.toFixed(0)}%)` })
    }
  }

  // Expiry / Billing lifecycle
  const days = daysUntil(node.expired_at)
  if (typeof days === 'number') {
    if (days < 0) {
      hits.push({ score: 45, reason: t('alert.days_ago_expired', { d: Math.abs(days) }) })
    } else if (days < 3) {
      hits.push({ score: 20, reason: `${t('alert.expiring_soon')} (${days} ${t('unit.days')})` })
    } else if (days < 7) {
      hits.push({ score: 10, reason: `${t('alert.expiring_soon')} (${days} ${t('unit.days')})` })
    } else if (days < 14) {
      hits.push({ score: 5, reason: `${t('alert.expiring_soon')} (${days} ${t('unit.days')})` })
    }
  }

  // Sort reasons by severity (most severe first)
  hits.sort((a, b) => b.score - a.score)

  return {
    score: hits.reduce((sum, h) => sum + h.score, 0),
    reasons: hits.map((h) => h.reason),
  }
}

export interface UseAttentionNeededOptions {
  /** Top N to return (default 5) */
  topN?: number
}

export function useAttentionNeeded(
  nodes: KomariNode[],
  records: Record<string, KomariRecord>,
  options: UseAttentionNeededOptions = {},
): AttentionItem[] {
  const { t } = useI18n()
  const topN = options.topN ?? 5

  return useMemo(() => {
    const items: AttentionItem[] = []

    for (const node of nodes) {
      const record = records[node.uuid]
      const { score, reasons } = scoreNode(node, record, t)
      if (score <= 0) continue

      items.push({
        node,
        record,
        score,
        severity: severityFromScore(score),
        reasons,
        lastSeenISO: record?.updated_at,
      })
    }

    items.sort((a, b) => b.score - a.score)
    return items.slice(0, topN)
  }, [nodes, records, topN, t])
}
