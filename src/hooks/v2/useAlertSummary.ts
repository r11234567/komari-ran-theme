/**
 * useAlertSummary — multi-dimensional cluster alert evaluation engine.
 *
 * Evaluates operational conditions across all nodes independently per metric rule:
 *   - Offline: unreachable / agent disconnected
 *   - Resource:
 *       • CPU: Critical >= 98%, Warning >= 90%
 *       • Memory: Critical >= 98%, Warning >= 90%
 *       • Disk: Critical >= 95%, Warning >= 90%
 *       • Normalized Load: Critical (load1 / cores) >= 2.0, Warning >= 1.2
 *   - Latency & Packet Loss:
 *       • Packet Loss: Critical >= 20%, Warning >= 5%
 *       • Ping Latency: Critical >= 500ms, Warning >= 200ms
 *   - Traffic:
 *       • Exhausted: Used >= 100% of traffic_limit
 *       • High Utilization: Used >= 85% of traffic_limit
 *   - Lifecycle & Billing:
 *       • Expired: days < 0 (Critical)
 *       • Expiring Soon: days < 7 (Warning), days < 30 (Info)
 *   - Stale Telemetry:
 *       • Agent Heartbeat Freeze: online = true, but updated_at > 90s ago
 *
 * Fixes & enhancements:
 *   1. Eliminates single-alert shadowing: multiple active faults per node are accurately captured.
 *   2. Core normalization: load1 normalized by cpu_cores.
 *   3. Adds Disk Capacity and Traffic Quota monitoring.
 *   4. Properly flags expired servers (< 0d).
 *   5. Provides both `counts.total` (total alerts) and `counts.affectedNodes` (distinct nodes).
 *   6. Fully localized via useI18n.
 */

import { useMemo } from 'react'
import type { KomariNode, KomariRecord } from '@/types/komari'
import { daysUntil, resolveRamPercent } from '@/utils/format'
import { computeTrafficQuota } from '@/utils/traffic'
import { useI18n } from '@/i18n'

export type AlertLevel = 'critical' | 'warning' | 'info'
export type AlertMetric =
  | 'offline'
  | 'cpu'
  | 'ram'
  | 'disk'
  | 'load'
  | 'loss'
  | 'latency'
  | 'traffic'
  | 'billing'
  | 'stale'

export interface AlertItem {
  uuid: string
  name: string
  level: AlertLevel
  metric: AlertMetric
  /** Short title — e.g. "节点离线" */
  title: string
  /** Optional extra context — e.g. "96%" */
  detail?: string
  /** ISO timestamp of relevant data point */
  timestampISO?: string
  /** Internal severity score for sorting */
  score: number
}

export interface AlertSummary {
  /** Counts by level */
  counts: {
    critical: number
    warning: number
    info: number
    total: number
    affectedNodes: number
  }
  /** Top N alerts, severity-sorted (for compact overview panels) */
  alerts: AlertItem[]
  /** Complete list of alerts, severity-sorted (for detailed modals) */
  allAlerts: AlertItem[]
}

function evalNodeAlerts(
  node: KomariNode,
  record: KomariRecord | undefined,
  t: (k: string, p?: Record<string, string | number>) => string,
): AlertItem[] {
  const alerts: AlertItem[] = []
  const nodeName = node.name ?? node.uuid.slice(0, 8)
  const timestampISO = record?.updated_at

  // 1. Connectivity & Offline (Score 100)
  if (!record || !record.online) {
    alerts.push({
      uuid: node.uuid,
      name: nodeName,
      level: 'critical',
      metric: 'offline',
      title: t('alert.node_offline'),
      detail: undefined,
      timestampISO,
      score: 100,
    })
  }

  // 2. Billing & Lifecycle Expiration
  const days = daysUntil(node.expired_at)
  if (typeof days === 'number') {
    if (days < 0) {
      alerts.push({
        uuid: node.uuid,
        name: nodeName,
        level: 'critical',
        metric: 'billing',
        title: t('alert.expired'),
        detail: t('alert.days_ago_expired', { d: Math.abs(days) }),
        timestampISO,
        score: 95,
      })
    } else if (days < 7) {
      alerts.push({
        uuid: node.uuid,
        name: nodeName,
        level: 'warning',
        metric: 'billing',
        title: t('alert.expiring_soon'),
        detail: `${days} ${t('unit.days')}`,
        timestampISO,
        score: 45,
      })
    } else if (days < 30) {
      alerts.push({
        uuid: node.uuid,
        name: nodeName,
        level: 'info',
        metric: 'billing',
        title: t('alert.expiring_soon'),
        detail: `${days} ${t('unit.days')}`,
        timestampISO,
        score: 20,
      })
    }
  }

  // If node is offline, we do not evaluate live resource telemetries
  if (!record || !record.online) {
    return alerts
  }

  // 3. Stale Telemetry (Heartbeat freeze / silent drop)
  if (record.updated_at) {
    const ageMs = Date.now() - new Date(record.updated_at).getTime()
    if (ageMs > 90_000 && !Number.isNaN(ageMs)) {
      alerts.push({
        uuid: node.uuid,
        name: nodeName,
        level: 'warning',
        metric: 'stale',
        title: t('alert.stale_heartbeat'),
        detail: `> ${Math.round(ageMs / 60_000)}m`,
        timestampISO,
        score: 42,
      })
    }
  }

  // 4. Packet Loss
  if (typeof record.loss === 'number' && record.loss > 0) {
    if (record.loss >= 20) {
      alerts.push({
        uuid: node.uuid,
        name: nodeName,
        level: 'critical',
        metric: 'loss',
        title: t('alert.high_loss'),
        detail: `${record.loss.toFixed(1)}%`,
        timestampISO,
        score: 88,
      })
    } else if (record.loss >= 5) {
      alerts.push({
        uuid: node.uuid,
        name: nodeName,
        level: 'warning',
        metric: 'loss',
        title: t('alert.mod_loss'),
        detail: `${record.loss.toFixed(1)}%`,
        timestampISO,
        score: 58,
      })
    }
  }

  // 5. Ping Latency
  if (typeof record.ping === 'number' && record.ping > 0) {
    if (record.ping >= 500) {
      alerts.push({
        uuid: node.uuid,
        name: nodeName,
        level: 'critical',
        metric: 'latency',
        title: t('alert.high_ping'),
        detail: `${Math.round(record.ping)}ms`,
        timestampISO,
        score: 82,
      })
    } else if (record.ping >= 200) {
      alerts.push({
        uuid: node.uuid,
        name: nodeName,
        level: 'warning',
        metric: 'latency',
        title: t('alert.mod_ping'),
        detail: `${Math.round(record.ping)}ms`,
        timestampISO,
        score: 50,
      })
    }
  }

  // 6. CPU Saturation
  if (typeof record.cpu === 'number') {
    if (record.cpu >= 98) {
      alerts.push({
        uuid: node.uuid,
        name: nodeName,
        level: 'critical',
        metric: 'cpu',
        title: t('alert.high_cpu'),
        detail: `${Math.round(record.cpu)}%`,
        timestampISO,
        score: 80,
      })
    } else if (record.cpu >= 90) {
      alerts.push({
        uuid: node.uuid,
        name: nodeName,
        level: 'warning',
        metric: 'cpu',
        title: t('alert.high_cpu'),
        detail: `${Math.round(record.cpu)}%`,
        timestampISO,
        score: 55,
      })
    }
  }

  // 7. Memory / RAM Saturation
  const memPct = resolveRamPercent(record.memory_used, record.memory_total)
  if (typeof memPct === 'number') {
    if (memPct >= 98) {
      alerts.push({
        uuid: node.uuid,
        name: nodeName,
        level: 'critical',
        metric: 'ram',
        title: t('alert.high_mem'),
        detail: `${Math.round(memPct)}%`,
        timestampISO,
        score: 78,
      })
    } else if (memPct >= 90) {
      alerts.push({
        uuid: node.uuid,
        name: nodeName,
        level: 'warning',
        metric: 'ram',
        title: t('alert.high_mem'),
        detail: `${Math.round(memPct)}%`,
        timestampISO,
        score: 52,
      })
    }
  }

  // 8. Disk Capacity Full
  if (record.disk_used && record.disk_total && record.disk_total > 0) {
    const diskPct = (record.disk_used / record.disk_total) * 100
    if (diskPct >= 95) {
      alerts.push({
        uuid: node.uuid,
        name: nodeName,
        level: 'critical',
        metric: 'disk',
        title: t('alert.high_disk'),
        detail: `${Math.round(diskPct)}%`,
        timestampISO,
        score: 90,
      })
    } else if (diskPct >= 90) {
      alerts.push({
        uuid: node.uuid,
        name: nodeName,
        level: 'warning',
        metric: 'disk',
        title: t('alert.high_disk'),
        detail: `${Math.round(diskPct)}%`,
        timestampISO,
        score: 65,
      })
    }
  }

  // 9. Normalized System Load (by CPU core count)
  if (typeof record.load1 === 'number') {
    const cores = Math.max(1, node.cpu_cores || 1)
    const normLoad = record.load1 / cores
    if (normLoad >= 2.0) {
      alerts.push({
        uuid: node.uuid,
        name: nodeName,
        level: 'critical',
        metric: 'load',
        title: t('alert.high_load'),
        detail: `load ${record.load1.toFixed(1)} (${cores}c)`,
        timestampISO,
        score: 75,
      })
    } else if (normLoad >= 1.2) {
      alerts.push({
        uuid: node.uuid,
        name: nodeName,
        level: 'warning',
        metric: 'load',
        title: t('alert.high_load'),
        detail: `load ${record.load1.toFixed(1)} (${cores}c)`,
        timestampISO,
        score: 48,
      })
    }
  }

  // 10. Traffic Quota Limit
  const quota = computeTrafficQuota(node, record)
  if (quota) {
    if (quota.percent >= 100) {
      alerts.push({
        uuid: node.uuid,
        name: nodeName,
        level: 'critical',
        metric: 'traffic',
        title: t('alert.traffic_exhausted'),
        detail: `${quota.percent.toFixed(0)}%`,
        timestampISO,
        score: 85,
      })
    } else if (quota.percent >= 85) {
      alerts.push({
        uuid: node.uuid,
        name: nodeName,
        level: 'warning',
        metric: 'traffic',
        title: t('alert.traffic_warning'),
        detail: `${quota.percent.toFixed(0)}%`,
        timestampISO,
        score: 60,
      })
    }
  }

  return alerts
}

export interface UseAlertSummaryOptions {
  topN?: number
}

export function useAlertSummary(
  nodes: KomariNode[],
  records: Record<string, KomariRecord>,
  options: UseAlertSummaryOptions = {},
): AlertSummary {
  const { t } = useI18n()
  const topN = options.topN ?? 5

  return useMemo(() => {
    const counts = {
      critical: 0,
      warning: 0,
      info: 0,
      total: 0,
      affectedNodes: 0,
    }
    const affectedNodeSet = new Set<string>()
    const allAlerts: AlertItem[] = []

    for (const node of nodes) {
      const r = records[node.uuid]
      const nodeAlerts = evalNodeAlerts(node, r, t)
      if (nodeAlerts.length === 0) continue

      affectedNodeSet.add(node.uuid)
      for (const alert of nodeAlerts) {
        counts[alert.level] += 1
        counts.total += 1
        allAlerts.push(alert)
      }
    }

    counts.affectedNodes = affectedNodeSet.size

    // Sort descending by severity score
    allAlerts.sort((a, b) => b.score - a.score)

    // Slice topN for compact widget consumption
    const alerts = allAlerts.slice(0, topN)

    return { counts, alerts, allAlerts }
  }, [nodes, records, topN, t])
}
