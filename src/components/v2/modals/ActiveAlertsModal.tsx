import { useState, useMemo } from 'react'
import type { AlertSummary, AlertLevel } from '@/hooks/v2'
import { ModalFrame } from './ModalFrame'
import { useI18n } from '@/i18n'
import { contentFs } from '@/utils/fontScale'

interface Props {
  open: boolean
  onClose: () => void
  summary: AlertSummary
  onSelectNode?: (uuid: string) => void
}

const LEVEL_STYLE = {
  critical: {
    color: 'var(--signal-bad)',
    bg: 'rgba(235, 77, 75, 0.1)',
    border: 'rgba(235, 77, 75, 0.35)',
  },
  warning: {
    color: 'var(--signal-warn)',
    bg: 'rgba(240, 160, 48, 0.1)',
    border: 'rgba(240, 160, 48, 0.35)',
  },
  info: {
    color: 'var(--accent)',
    bg: 'rgba(212, 140, 60, 0.1)',
    border: 'rgba(212, 140, 60, 0.35)',
  },
} as const

function fmtAgo(iso?: string, t?: (k: string, p?: Record<string, string | number>) => string): string {
  if (!iso) return '—'
  const ts = new Date(iso).getTime()
  if (Number.isNaN(ts)) return '—'
  const dt = Date.now() - ts
  if (dt < 60_000) return t ? t('time.just_now') : 'just now'
  const m = Math.floor(dt / 60_000)
  if (m < 60) return t ? t('time.minutes_ago', { m }) : `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return t ? t('time.hours_ago', { h }) : `${h}h ago`
  const d = Math.floor(h / 24)
  return t ? t('time.days_ago', { d }) : `${d}d ago`
}

export function ActiveAlertsModal({ open, onClose, summary, onSelectNode }: Props) {
  const { t } = useI18n()
  const [activeFilter, setActiveFilter] = useState<'all' | AlertLevel>('all')
  const [search, setSearch] = useState('')

  const filteredAlerts = useMemo(() => {
    const list = summary.allAlerts ?? summary.alerts
    return list.filter((alert) => {
      if (activeFilter !== 'all' && alert.level !== activeFilter) {
        return false
      }
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchName = alert.name.toLowerCase().includes(q)
        const matchTitle = alert.title.toLowerCase().includes(q)
        const matchDetail = alert.detail?.toLowerCase().includes(q) ?? false
        if (!matchName && !matchTitle && !matchDetail) return false
      }
      return true
    })
  }, [summary.allAlerts, summary.alerts, activeFilter, search])

  const filterTabs: Array<{ id: 'all' | AlertLevel; label: string; count: number; color?: string }> = [
    { id: 'all', label: t('level.all'), count: summary.counts.total },
    { id: 'critical', label: t('level.critical'), count: summary.counts.critical, color: 'var(--signal-bad)' },
    { id: 'warning', label: t('level.warning'), count: summary.counts.warning, color: 'var(--signal-warn)' },
    { id: 'info', label: t('level.info'), count: summary.counts.info, color: 'var(--accent)' },
  ]

  return (
    <ModalFrame
      open={open}
      onClose={onClose}
      serial="A01"
      title={t('modal.alerts.title')}
      subtitle={t('modal.alerts.subtitle')}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: contentFs(11),
              color: 'var(--fg-3)',
            }}
          >
            {filteredAlerts.length} / {summary.counts.total} ACTIVE · {summary.counts.affectedNodes} AFFECTED NODES
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '5px 16px',
              background: 'var(--bg-1)',
              border: '1px solid var(--edge-engrave)',
              borderRadius: 3,
              fontFamily: 'var(--font-mono)',
              fontSize: contentFs(11),
              color: 'var(--fg-1)',
              cursor: 'pointer',
              letterSpacing: '0.04em',
            }}
          >
            {t('btn.close')}
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Filter row: Severity Tabs + Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4 }}>
            {filterTabs.map((tab) => {
              const active = activeFilter === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id)}
                  style={{
                    padding: '4px 10px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: contentFs(11),
                    borderRadius: 3,
                    border: active ? '1px solid var(--accent)' : '1px solid var(--edge-engrave)',
                    background: active ? 'var(--bg-2)' : 'var(--bg-0)',
                    color: active ? 'var(--accent-bright)' : 'var(--fg-2)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    transition: 'all 0.1s ease',
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    style={{
                      fontSize: contentFs(10),
                      padding: '1px 5px',
                      borderRadius: 10,
                      background: active ? 'var(--bg-1)' : 'var(--bg-1)',
                      color: tab.color ?? 'inherit',
                      fontWeight: 600,
                    }}
                  >
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Quick search input */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search.placeholder') || 'Filter alerts...'}
            style={{
              minWidth: 160,
              padding: '4px 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: contentFs(11),
              background: 'var(--bg-0)',
              border: '1px solid var(--edge-engrave)',
              borderRadius: 3,
              color: 'var(--fg-0)',
              outline: 'none',
            }}
          />
        </div>

        {/* Alerts list */}
        {filteredAlerts.length === 0 ? (
          <div
            style={{
              padding: '36px 16px',
              textAlign: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: contentFs(12),
              color: 'var(--fg-3)',
              background: 'var(--bg-0)',
              border: '1px dashed var(--edge-engrave)',
              borderRadius: 3,
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.6 }}>✓</div>
            <div>{t('modal.alerts.empty')}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filteredAlerts.map((alert, idx) => {
              const style = LEVEL_STYLE[alert.level]
              return (
                <div
                  key={`${alert.uuid}-${alert.level}-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '9px 12px',
                    background: 'var(--bg-0)',
                    border: '1px solid var(--edge-engrave)',
                    borderLeft: `3px solid ${style.color}`,
                    borderRadius: 3,
                    transition: 'background 0.12s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 2,
                        background: style.bg,
                        border: `1px solid ${style.border}`,
                        color: style.color,
                        fontFamily: 'var(--font-mono)',
                        fontSize: contentFs(9),
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        flexShrink: 0,
                      }}
                    >
                      {alert.level}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectNode) {
                          onSelectNode(alert.uuid)
                          onClose()
                        }
                      }}
                      title="Inspect node"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        fontFamily: 'var(--font-mono)',
                        fontSize: contentFs(12),
                        fontWeight: 600,
                        color: 'var(--fg-0)',
                        cursor: onSelectNode ? 'pointer' : 'default',
                        textDecoration: onSelectNode ? 'underline' : 'none',
                        textUnderlineOffset: 3,
                        textDecorationColor: 'var(--edge-engrave)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 180,
                        textAlign: 'left',
                      }}
                    >
                      {alert.name}
                    </button>

                    <span
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: contentFs(11),
                        color: 'var(--fg-1)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {alert.title}
                    </span>

                    {alert.detail && (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: contentFs(10),
                          color: 'var(--fg-3)',
                          padding: '1px 5px',
                          borderRadius: 2,
                          background: 'var(--bg-1)',
                          flexShrink: 0,
                        }}
                      >
                        {alert.detail}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: contentFs(10),
                      color: 'var(--fg-3)',
                      flexShrink: 0,
                      letterSpacing: '0.02em',
                    }}
                  >
                    {fmtAgo(alert.timestampISO, t)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </ModalFrame>
  )
}
