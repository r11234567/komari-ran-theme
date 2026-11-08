import type { TranslationDict } from '../types'

export const ja: TranslationDict = {
  // Common
  'lang.label': '言語',
  'lang.name': '日本語',
  'theme.night': '墨石',
  'theme.mist': '霧色',
  'layout.label': 'レイアウト',
  'search.placeholder': 'ノードを検索...',
  'search.no_match': '一致するノードが見つかりません',

  // Navigation
  'nav.overview': '概要',
  'nav.nodes': 'ノード一覧',
  'nav.traffic': 'トラフィック',
  'nav.billing': '請求・契約',
  'nav.hub': 'コックピット',
  'nav.geo_map': '世界地図',

  // Status & Time
  'status.live': 'ライブ',
  'status.online': '稼働中',
  'status.offline': '停止中',
  'status.degraded': '性能低下',
  'status.regions': 'リージョン',
  'status.alerts': 'アラート',
  'status.avg_lat': '平均遅延',
  'status.sync': '同期',
  'time.just_now': 'たった今',
  'time.seconds_ago': '{s}秒前',
  'time.minutes_ago': '{m}分前',
  'time.hours_ago': '{h}時間前',
  'time.days_ago': '{d}日前',

  // V2 Cards
  'card.health_score': 'ヘルススコア',
  'card.active_alerts': 'アクティブアラート',
  'card.global_throughput': 'グローバルスループット',
  'card.avg_packet_loss': '平均パケットロス',
  'card.expiring_soon': '期限切れ間近',

  // V2 Panels
  'panel.region_donut': '地域別ノード分布',
  'panel.alert_summary': 'アラート概要',
  'panel.recent_incidents': '最近のインシデント',
  'panel.recent_events': '最近のイベント履歴',
  'panel.health_trend': 'ヘルストレンド (7日)',
  'panel.attention_needed': '要確認ノード TOP 5',
  'panel.system_health': 'システム健全性・接続状況',
  'panel.loss_heatmap': 'パケットロスヒートマップ',

  // Buttons & Actions
  'btn.view_alerts': 'アラートを表示',
  'btn.view_all_alerts': 'すべてのアラートを表示',
  'btn.view_all_incidents': 'すべてのインシデントを表示',
  'btn.view_all_services': 'サービス詳細を表示',
  'btn.view_all_nodes': 'すべてのノードを表示',
  'btn.close': '閉じる',
  'btn.clear_history': '履歴を消去',

  // Alert Levels
  'level.all': 'すべて',
  'level.critical': '緊急',
  'level.warning': '警告',
  'level.info': '情報',

  // Alert & Event Messages
  'alert.node_offline': 'ノード停止 (オフライン)',
  'alert.node_recovered': 'ノード復旧 (オンライン)',
  'alert.high_loss': '高パケットロス',
  'alert.mod_loss': 'パケットロス上昇',
  'alert.high_ping': '高遅延',
  'alert.mod_ping': '遅延上昇',
  'alert.high_cpu': 'CPU高負荷',
  'alert.high_mem': 'メモリ逼迫',
  'alert.high_disk': 'ディスク容量不足',
  'alert.high_load': 'システム高負荷',
  'alert.traffic_warning': 'トラフィック制限に近接',
  'alert.traffic_exhausted': 'トラフィック制限超過',
  'alert.expiring_soon': '契約期限切れ間近',
  'alert.expired': '契約期限切れ',
  'alert.stale_heartbeat': 'ハートビートタイムアウト',
  'alert.days_ago_expired': '{d}日超過',
  'alert.enter_degraded': 'ノード性能低下を検出',
  'alert.recover_normal': 'ノード正常復帰',
  'unit.days': '日',

  // Modals
  'modal.alerts.title': 'アクティブアラートセンター',
  'modal.alerts.subtitle': 'リアルタイム異常検知・インシデント追跡',
  'modal.alerts.empty': '現在クラスタは正常に稼働しています。アラートはありません。',
  'modal.incidents.title': 'システムインシデント履歴',
  'modal.incidents.subtitle': 'ノード状態遷移、障害および復旧の時系列ログ',
  'modal.incidents.empty': 'インシデント履歴はありません。状態変化が発生するとここに表示されます。',
  'modal.services.title': 'システム接続性・サービス健全性',
  'modal.services.subtitle': 'Connect gRPC リアルタイムストリームおよび測定状態',

  // Metrics
  'metric.cpu': 'CPU',
  'metric.memory': 'メモリ',
  'metric.disk': 'ディスク',
  'metric.network': 'ネットワーク',
  'metric.load': '負荷',
  'metric.latency': '遅延',
  'metric.loss': '損失率',
  'metric.uptime': '稼働時間',
  'metric.connections': '接続数',

  // Traffic & Quota
  'traffic.threshold': 'トラフィック上限',
  'traffic.sum': '合計',
  'traffic.max': '最大値',
  'traffic.reset_cycle': 'リセット周期',
  'traffic.next_reset': '次回リセット',
  'traffic.remaining': '残り {t}',
  'traffic.no_reset': '月度リセットなし',
}
