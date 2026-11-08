import { useState, useMemo } from 'react'
import type { NodeEvent, EventKind } from '@/hooks/v2'
import { ModalFrame } from './ModalFrame'
import { useI18n } from '@/i18n'
import { contentFs } from '@/utils/fontScale'

interface Props {
  open: boolean
  onClose: () => void
  events: NodeEvent[]
  onClearEvents: () => void
  onSelectNode?: (uuid: string) => void
}

const KIND_STYLE: Record<EventKind, { label: string; color: string; bg: string; border: string }> = {
  down: {
    label: 'OFFLINE',
    color: 'var(--signal-bad)',
    bg: 'rgba(235, 77, 75, 0.1)',
    border: 'rgba(235, 77, 75, 0.35)',
  },
  degraded: {
    label: 'DEGRADED',
    color: 'var(--signal-warn)',
    bg: 'rgba(240, 160, 48, 0.1)',
    border: 'rgba(240, 160, 48, 0.35)',
  },
  up: {
    label: 'ONLINE',
    color: 'var(--signal-good)',
    bg: 'rgba(46, 204, 113, 0.1)',
    border: 'rgba(46, 204, 113, 0.35)',
  },
  recovered: {
    label: 'RECOVERED',
    color: 'var(--accent-bright)',
    bg: 'rgba(212, 140, 60, 0.1)',
    border: 'rgba(212, 140, 60, 0.35)',
  },
}

function fmtAgo(ts: number, t?: (k: string, p?: Record<string, string | number>) => string): string {
  const dt = Date.now() - ts
  if (dt < 60_000) return t ? t('time.just_now') : 'just now'
  const m = Math.floor(dt / 60_000)
  if (m < 60) return t ? t('time.minutes_ago', { m }) : `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return t ? t('time.hours_ago', { h }) : `${h}h ago`
  const d = Math.floor(h / 24)
  return t ? t('time.days_ago', { d }) : `${d}d ago`
}

function fmtExactTime(ts: number): string {
  const d = new Date(ts)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export function IncidentsHistoryModal({
  open,
  onClose,
  events,
  onClearEvents,
  onSelectNode,
}: Props) {
  const { t } = useI18n()
  const [filter, setFilter] = useState<'all' | 'down' | 'degraded' | 'up_or_rec'>('all')
  const [search, setSearch] = useState('')

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filter === 'down' && e.kind !== 'down') return false
      if (filter === 'degraded' && e.kind !== 'degraded') return false
      if (filter === 'up_or_rec' && e.kind !== 'up' && e.kind !== 'recovered') return false

      if (search.trim()) {
        const q = search.toLowerCase()
        const matchName = e.name.toLowerCase().includes(q)
        const matchMsg = e.message.toLowerCase().includes(q)
        if (!matchName && !matchMsg) return false
      }
      return true
    })
  }, [events, filter, search])

  return (
    <ModalFrame
      open={open}
      onClose={onClose}
      serial="RE01"
      title={t('modal.incidents.title')}
      subtitle={t('modal.incidents.subtitle')}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <button
            type="button"
            onClick={onClearEvents}
            disabled={events.length === 0}
            style={{
              padding: '5px 12px',
              background: 'transparent',
              border: '1px solid var(--edge-engrave)',
              borderRadius: 3,
              fontFamily: 'var(--font-mono)',
              fontSize: contentFs(11),
              color: events.length > 0 ? 'var(--signal-warn)' : 'var(--fg-3)',
              cursor: events.length > 0 ? 'pointer' : 'not-allowed',
              opacity: events.length > 0 ? 1 : 0.5,
              transition: 'all 0.12s ease',
            }}
          >
            {t('btn.clear_history')}
          </button>

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
        {/* Filter bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          {/* Quick kind filters */}
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { id: 'all', label: t('level.all'), count: events.length },
              {
                id: 'down',
                label: 'OFFLINE',
                count: events.filter((e) => e.kind === 'down').length,
                color: 'var(--signal-bad)',
              },
              {
                id: 'degraded',
                label: 'DEGRADED',
                count: events.filter((e) => e.kind === 'degraded').length,
                color: 'var(--signal-warn)',
              },
              {
                id: 'up_or_rec',
                label: 'RECOVERED',
                count: events.filter((e) => e.kind === 'up' || e.kind === 'recovered').length,
                color: 'var(--signal-good)',
              },
            ].map((tab) => {
              const active = filter === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id as typeof filter)}
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
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    style={{
                      fontSize: contentFs(10),
                      padding: '1px 5px',
                      borderRadius: 10,
                      background: 'var(--bg-1)',
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

          {/* Search box */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search.placeholder') || 'Filter incidents...'}
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

        {/* Incidents timeline */}
        {filteredEvents.length === 0 ? (
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
            <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.6 }}>⏱</div>
            <div>{t('modal.incidents.empty')}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filteredEvents.map((e, idx) => {
              const meta = KIND_STYLE[e.kind] ?? KIND_STYLE.degraded
              return (
                <div
                  key={`${e.uuid}-${e.t}-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '8px 12px',
                    background: 'var(--bg-0)',
                    border: '1px solid var(--edge-engrave)',
                    borderLeft: `3px solid ${meta.color}`,
                    borderRadius: 3,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 2,
                        background: meta.bg,
                        border: `1px solid ${meta.border}`,
                        color: meta.color,
                        fontFamily: 'var(--font-mono)',
                        fontSize: contentFs(9),
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        flexShrink: 0,
                      }}
                    >
                      {meta.label}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectNode) {
                          onSelectNode(e.uuid)
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
                      {e.name}
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
                      {e.message}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontFamily: 'var(--font-mono)',
                      fontSize: contentFs(10),
                      color: 'var(--fg-3)',
                      flexShrink: 0,
                    }}
                  >
                    <span>{fmtExactTime(e.t)}</span>
                    <span style={{ opacity: 0.5 }}>·</span>
                    <span>{fmtAgo(e.t, t)}</span>
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
