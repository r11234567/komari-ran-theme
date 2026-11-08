import type { TranslationDict } from '../types'

export const zhCN: TranslationDict = {
  // Common
  'lang.label': '语言',
  'lang.name': '简体中文',
  'theme.night': '墨石',
  'theme.mist': '雾色',
  'layout.label': '布局',
  'search.placeholder': '搜索节点...',
  'search.no_match': '未找到匹配节点',

  // Navigation
  'nav.overview': '概览',
  'nav.nodes': '节点',
  'nav.traffic': '全网流量',
  'nav.billing': '订阅账单',
  'nav.hub': '驾驶舱',
  'nav.geo_map': '全球地图',

  // Status & Time
  'status.live': '实时',
  'status.online': '在线',
  'status.offline': '离线',
  'status.degraded': '降级',
  'status.regions': '地区',
  'status.alerts': '告警',
  'status.avg_lat': '平均延迟',
  'status.sync': '同步',
  'time.just_now': '刚刚',
  'time.seconds_ago': '{s}秒前',
  'time.minutes_ago': '{m}分钟前',
  'time.hours_ago': '{h}小时前',
  'time.days_ago': '{d}天前',

  // V2 Cards
  'card.health_score': '集群健康分',
  'card.active_alerts': '活动告警',
  'card.global_throughput': '全网实时吞吐',
  'card.avg_packet_loss': '平均丢包率',
  'card.expiring_soon': '临期节点',

  // V2 Panels
  'panel.region_donut': '区域节点分布',
  'panel.alert_summary': '告警摘要',
  'panel.recent_incidents': '近期故障与事件',
  'panel.recent_events': '近期事件流',
  'panel.health_trend': '健康度趋势 (7D)',
  'panel.attention_needed': '需关注节点 TOP 5',
  'panel.system_health': '系统连通性与服务状态',
  'panel.loss_heatmap': '全网丢包热力图',

  // Buttons & Actions
  'btn.view_alerts': '查看告警',
  'btn.view_all_alerts': '查看全部告警',
  'btn.view_all_incidents': '查看全部事件',
  'btn.view_all_services': '查看服务详情',
  'btn.view_all_nodes': '查看全部节点',
  'btn.close': '关闭',
  'btn.clear_history': '清空本地记录',

  // Alert Levels
  'level.all': '全部',
  'level.critical': '严重',
  'level.warning': '警告',
  'level.info': '提示',

  // Alert & Event Messages
  'alert.node_offline': '节点离线',
  'alert.node_recovered': '节点恢复在线',
  'alert.high_loss': '高丢包率',
  'alert.mod_loss': '丢包率偏高',
  'alert.high_ping': '高延迟',
  'alert.mod_ping': '延迟升高',
  'alert.high_cpu': 'CPU 使用率高',
  'alert.high_mem': '内存接近满载',
  'alert.high_disk': '磁盘空间不足',
  'alert.high_load': '负载偏高',
  'alert.traffic_warning': '流量配额接近上限',
  'alert.traffic_exhausted': '流量配额已耗尽',
  'alert.expiring_soon': '即将到期',
  'alert.expired': '节点已过期',
  'alert.stale_heartbeat': '心跳超时未上报',
  'alert.days_ago_expired': '已过期 {d} 天',
  'alert.enter_degraded': '节点进入降级',
  'alert.recover_normal': '节点恢复正常',
  'unit.days': '天',

  // Modals
  'modal.alerts.title': '活动告警监控中心',
  'modal.alerts.subtitle': '实时集群异常与告警事件追踪',
  'modal.alerts.empty': '当前集群运行良好，无活动告警',
  'modal.incidents.title': '系统突发事件历史',
  'modal.incidents.subtitle': '记录节点状态转换、掉线与恢复轨迹',
  'modal.incidents.empty': '暂无事件记录，节点发生状态流转时将在此呈现',
  'modal.services.title': '系统连通性与服务健康',
  'modal.services.subtitle': 'Connect gRPC 实时数据通道与探针服务概览',

  // Metrics
  'metric.cpu': 'CPU',
  'metric.memory': '内存',
  'metric.disk': '磁盘',
  'metric.network': '网络',
  'metric.load': '负载',
  'metric.latency': '延迟',
  'metric.loss': '丢包',
  'metric.uptime': '运行时间',
  'metric.connections': '连接数',

  // Traffic & Quota
  'traffic.threshold': '流量阈值',
  'traffic.sum': '求和',
  'traffic.max': '取最大',
  'traffic.reset_cycle': '重置周期',
  'traffic.next_reset': '下次重置',
  'traffic.remaining': '还有 {t}',
  'traffic.no_reset': '不设置月度重置',
}
