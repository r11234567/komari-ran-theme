/**
 * Komari Probe API types (real shape, observed from live panel).
 *
 * Theme view models derived from typed Connect browser and metrics messages.
 */

export type NodeStatus = 'good' | 'warn' | 'bad'

/** BrowserService node metadata */
export interface KomariNode {
  uuid: string
  name?: string
  /** OS string from agent boot */
  os?: string
  cpu_name?: string
  cpu_model?: string
  cpu_cores?: number
  arch?: string
  ip?: string
  region?: string
  group?: string
  /** Bandwidth/traffic labels: "1Gbps<green>;5T<blue>" */
  tags?: string
  /** ISO date — node expiry */
  expired_at?: string
  price?: number
  /**
   * Billing cycle in **days** (Komari quirk: numeric, not "monthly"/"yearly"):
   * 30=月, 90=季, 180=半年, 365=年, 1095=三年, -1=免费机.
   * The API surface is sometimes stringified, so we accept both.
   */
  billing_cycle?: number | string
  /** Currency symbol — e.g. "$", "¥", "€". From Komari node settings. */
  currency?: string
  /**
   * Traffic threshold in **bytes** (Komari 1.2.6+, admin "流量阈值" field).
   * 0 (or absent) means unlimited — Komari's own UI disables the traffic
   * progress bar in that case, and so do we.
   */
  traffic_limit?: number
  /**
   * How usage is measured against `traffic_limit`:
   *   'max' (取最大) — compare max(up, down) against the limit
   *   'sum' (求和)   — compare up + down against the limit
   */
  traffic_limit_type?: 'max' | 'sum' | string
  /** VPS / hosting provider name — Hetzner, Vultr, OVH, etc. May not be in Komari yet. */
  provider?: string
  weight?: number
  /** When true, node is hidden from anonymous viewers */
  hidden?: boolean
  /** Country code; sometimes present, sometimes derived from region */
  flag?: string
}

/** Normalized flat record — what components consume */
export interface KomariRecord {
  uuid: string
  online: boolean
  /** CPU usage percent 0..100 */
  cpu?: number
  memory_used?: number
  memory_total?: number
  swap_used?: number
  swap_total?: number
  disk_used?: number
  disk_total?: number
  /** Bytes per second, instantaneous */
  network_tx?: number
  network_rx?: number
  /** Cumulative bytes since boot — resets on reboot */
  network_total_up?: number
  network_total_down?: number
  tcp?: number
  udp?: number
  load1?: number
  load5?: number
  load15?: number
  uptime?: number
  process?: number
  os?: string
  cpu_model?: string
  message?: string
  updated_at?: string
  /** Recent typed Ping latency in milliseconds */
  ping?: number
  /** Packet loss percent */
  loss?: number
}

/** BrowserService public site config */
export interface KomariPublicConfig {
  site_name?: string
  sitename?: string
  description?: string
  /** Record retention in HOURS (not days). e.g. 720 = 30 days. */
  record_preserve_time?: number
  /** Ping record retention in HOURS. */
  ping_record_preserve_time?: number
  record_enabled?: boolean
  custom_css?: string
  custom_head?: string
  custom_body?: string
  footer_text?: string
  announce_text?: string
  theme?: string
  theme_settings?: Record<string, unknown>
}

export interface KomariMe {
  logged_in?: boolean
  username?: string
}
