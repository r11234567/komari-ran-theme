import { memo } from 'react'
import { formatBytes } from '@/utils/format'
import { formatTrafficPercent, trafficColor, type TrafficQuota } from '@/utils/traffic'
import { useI18n } from '@/i18n'

/**
 * TrafficBar — usage against Komari's per-node traffic threshold.
 *
 * Rendered only when a threshold is configured; the caller passes undefined
 * otherwise and nothing appears (matching Komari's "0 = disabled" contract).
 *
 * Displays the cycle limit, current consumption, accounting mode (sum / max),
 * and the authoritative monthly reset schedule + remaining countdown.
 */
type Variant = 'grid' | 'compact'

function TrafficBar_({ quota, variant = 'grid' }: { quota: TrafficQuota; variant?: Variant }) {
  const { t } = useI18n()
  const compact = variant === 'compact'
  const color = trafficColor(quota.level)
  const pctText = formatTrafficPercent(quota.percent)
  const usedText = formatBytes(quota.used)
  const limitText = formatBytes(quota.limit)

  // Once the fill covers the centred label, invert it for contrast.
  const knockout = quota.ratio > 0.55
  const labelColor = knockout ? 'var(--bg-0)' : 'var(--fg-2)'

  const height = compact ? 11 : 13
  const fontSize = compact ? 8 : 9

  const tooltipText = quota.reset?.tooltip || `${t('traffic.threshold')}: ${usedText} / ${limitText}`

  return (
    <div title={tooltipText}>
      {compact ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 3,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                fontSize: 9,
                color: 'var(--fg-3)',
                letterSpacing: '0.08em',
                fontFamily: 'var(--font-mono)',
              }}
            >
              TRAFFIC
            </span>
            <span
              style={{
                fontSize: 8,
                color: 'var(--fg-3)',
                border: '0.5px solid var(--bg-4)',
                borderRadius: 2,
                padding: '0 3px',
              }}
            >
              {quota.mode === 'sum' ? t('traffic.sum') : t('traffic.max')}
            </span>
            {quota.reset?.badgeText && (
              <span
                style={{
                  fontSize: 8,
                  color: 'var(--accent-bright)',
                  border: '0.5px solid var(--bg-4)',
                  borderRadius: 2,
                  padding: '0 3px',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                ⟳ {quota.reset.badgeText}
              </span>
            )}
          </div>
          <span
            style={{
              fontSize: 9.5,
              color: 'var(--fg-2)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {usedText}
            <span style={{ color: 'var(--fg-3)' }}> / </span>
            {limitText}
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: 'var(--fg-3)', letterSpacing: '0.1em' }}>
            {t('traffic.threshold')}
          </span>
          <span
            style={{
              fontSize: 8,
              color: 'var(--fg-3)',
              marginLeft: 5,
              border: '0.5px solid var(--bg-4)',
              borderRadius: 2,
              padding: '0 3px',
            }}
          >
            {quota.mode === 'sum' ? t('traffic.sum') : t('traffic.max')}
          </span>
          {quota.reset?.badgeText && (
            <span
              style={{
                fontSize: 8,
                color: 'var(--accent-bright)',
                marginLeft: 5,
                border: '0.5px solid var(--bg-4)',
                borderRadius: 2,
                padding: '0 3px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              ⟳ {quota.reset.badgeText}
            </span>
          )}
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 10,
              color: 'var(--fg-2)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {usedText}
            <span style={{ color: 'var(--fg-3)' }}> / </span>
            {limitText}
          </span>
        </div>
      )}

      <div
        className="precision-inset"
        style={{
          position: 'relative',
          height,
          borderColor: quota.level === 'crit' ? color : undefined,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${quota.ratio * 100}%`,
            minWidth: quota.used > 0 ? 2 : 0,
            background: color,
            boxShadow: 'inset 0 1px 0 var(--edge-bright)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize,
            letterSpacing: '0.08em',
            color: labelColor,
            fontWeight: knockout ? 600 : 400,
            whiteSpace: 'nowrap',
          }}
        >
          {compact ? `${pctText} · ${usedText} / ${limitText}` : `${pctText} USED`}
        </div>
      </div>

      {!compact && quota.reset && (quota.reset.scheduleText || quota.reset.remainingText) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 4,
            fontSize: 8.5,
            fontFamily: 'var(--font-mono)',
            color: 'var(--fg-3)',
          }}
        >
          <span>
            {quota.reset.scheduleText
              ? `${t('traffic.reset_cycle')}: ${quota.reset.scheduleText}`
              : t('traffic.threshold')}
          </span>
          {quota.reset.remainingText && (
            <span style={{ color: 'var(--accent-bright)' }}>
              {t('traffic.remaining', { t: quota.reset.remainingText })}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export const TrafficBar = memo(TrafficBar_)
