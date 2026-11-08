import type { PingHistory } from '@/api/client'
import { ModalFrame } from './ModalFrame'
import { useI18n } from '@/i18n'
import { contentFs } from '@/utils/fontScale'

type Conn = 'connecting' | 'open' | 'closed' | 'error' | 'idle'

interface Props {
  open: boolean
  onClose: () => void
  conn?: Conn
  lastUpdate?: number | null
  recordCount: number
  totalNodes: number
  ping?: PingHistory | null
}

interface ServiceItem {
  id: string
  name: string
  type: string
  status: 'healthy' | 'degraded' | 'down' | 'standby'
  metrics: string
  description: string
}

const STATUS_COLOR = {
  healthy: 'var(--signal-good)',
  degraded: 'var(--signal-warn)',
  down: 'var(--signal-bad)',
  standby: 'var(--accent)',
}

const STATUS_LABEL = {
  healthy: 'HEALTHY',
  degraded: 'DEGRADED',
  down: 'DOWN',
  standby: 'STANDBY',
}

export function SystemServicesModal({
  open,
  onClose,
  conn,
  lastUpdate,
  recordCount,
  totalNodes,
  ping,
}: Props) {
  const { t } = useI18n()

  const connStatus =
    conn === 'open'
      ? 'healthy'
      : conn === 'connecting'
        ? 'standby'
        : 'down'

  const probeStatus =
    recordCount === totalNodes && totalNodes > 0
      ? 'healthy'
      : recordCount > 0
        ? 'degraded'
        : 'down'

  const pingCount = ping?.count ?? 0
  const pingStatus =
    pingCount > 0
      ? 'healthy'
      : conn === 'open'
        ? 'degraded'
        : 'standby'

  const services: ServiceItem[] = [
    {
      id: 'connect_stream',
      name: 'Connect gRPC Stream',
      type: 'gRPC-Web / HTTP/2',
      status: connStatus,
      metrics: conn === 'open' ? 'Streaming (200 OK)' : `State: ${conn ?? 'idle'}`,
      description: 'Persistent duplex channel for live agent heartbeats and load telemetries.',
    },
    {
      id: 'live_probes',
      name: 'Agent Probe Heartbeats',
      type: 'Distributed Probes',
      status: probeStatus,
      metrics: `${recordCount} / ${totalNodes} Reporting`,
      description: 'Collects real-time CPU, RAM, Disk, Load1/5/15, and Net TX/RX rates.',
    },
    {
      id: 'ping_engine',
      name: 'ICMP / TCP Ping Tasks',
      type: 'MetricsService',
      status: pingStatus,
      metrics: pingCount > 0 ? `${pingCount.toLocaleString()} Samples Captured` : 'Pending Metrics',
      description: 'Multi-region synthetic ping tasks monitoring latency matrix and packet loss.',
    },
    {
      id: 'theme_engine',
      name: 'Ran Tactical UI Core',
      type: 'React 18 / Vite Engine',
      status: 'healthy',
      metrics: 'v2.1.2 · 60fps Target',
      description: 'Tactical command dashboard with dual layout architecture and dynamic themes.',
    },
    {
      id: 'browser_storage',
      name: 'Local State Persistence',
      type: 'Web Storage API',
      status: 'healthy',
      metrics: 'Read / Write Active',
      description: 'Persists user language preference, view mode, custom themes, and incident history.',
    },
    {
      id: 'geo_engine',
      name: 'Vector Geo Map Engine',
      type: 'Canvas / GeoJSON Proj',
      status: 'healthy',
      metrics: 'Ready · Realtime Ping Rings',
      description: 'Renders low-overhead global network topology with interactive node anchors.',
    },
  ]

  const lastSyncStr = lastUpdate
    ? `${Math.max(0, Math.floor((Date.now() - lastUpdate) / 1000))}s ago`
    : '—'

  return (
    <ModalFrame
      open={open}
      onClose={onClose}
      serial="SH01"
      title={t('modal.services.title')}
      subtitle={t('modal.services.subtitle')}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: contentFs(11),
              color: 'var(--fg-3)',
            }}
          >
            SYS · ALL SUBSYSTEMS NOMINAL
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
        {/* Services Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {services.map((srv) => {
            const color = STATUS_COLOR[srv.status]
            const label = STATUS_LABEL[srv.status]

            return (
              <div
                key={srv.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '10px 14px',
                  background: 'var(--bg-0)',
                  border: '1px solid var(--edge-engrave)',
                  borderLeft: `3px solid ${color}`,
                  borderRadius: 3,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: contentFs(12),
                        fontWeight: 600,
                        color: 'var(--fg-0)',
                      }}
                    >
                      {srv.name}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: contentFs(10),
                        color: 'var(--fg-3)',
                        padding: '1px 5px',
                        background: 'var(--bg-1)',
                        borderRadius: 2,
                      }}
                    >
                      {srv.type}
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: contentFs(11),
                      color: 'var(--fg-2)',
                      letterSpacing: '0.01em',
                    }}
                  >
                    {srv.description}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: 3,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      padding: '2px 7px',
                      borderRadius: 2,
                      fontFamily: 'var(--font-mono)',
                      fontSize: contentFs(9),
                      fontWeight: 700,
                      color,
                      border: `1px solid ${color}`,
                      letterSpacing: '0.06em',
                    }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: contentFs(10),
                      color: 'var(--fg-3)',
                    }}
                  >
                    {srv.metrics}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Runtime Diagnostics telemetry box */}
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--bg-0)',
            border: '1px dashed var(--edge-engrave)',
            borderRadius: 3,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 10,
            fontFamily: 'var(--font-mono)',
            fontSize: contentFs(10),
          }}
        >
          <div>
            <div style={{ color: 'var(--fg-3)', marginBottom: 2 }}>LAST SYNC</div>
            <div style={{ color: 'var(--accent-bright)' }}>{lastSyncStr}</div>
          </div>
          <div>
            <div style={{ color: 'var(--fg-3)', marginBottom: 2 }}>CLIENT TIME</div>
            <div style={{ color: 'var(--fg-1)' }}>
              {new Date().toLocaleTimeString()}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--fg-3)', marginBottom: 2 }}>CONNECTION</div>
            <div style={{ color: connStatus === 'healthy' ? 'var(--signal-good)' : 'var(--signal-bad)' }}>
              {(conn || 'idle').toUpperCase()}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--fg-3)', marginBottom: 2 }}>TIMEZONE</div>
            <div style={{ color: 'var(--fg-1)' }}>
              UTC{new Date().getTimezoneOffset() <= 0 ? '+' : '-'}{Math.abs(Math.floor(new Date().getTimezoneOffset() / 60))}
            </div>
          </div>
        </div>
      </div>
    </ModalFrame>
  )
}
