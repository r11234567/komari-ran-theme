import assert from 'node:assert/strict'
import {
  computeTrafficQuota,
  computeTrafficResetInfo,
  formatTrafficResetSchedule,
  formatTrafficResetInstant,
  formatTrafficResetRemaining,
  formatTrafficResetBadge,
} from '../src/utils/traffic.ts'
import { zhCN } from '../src/i18n/locales/zh-CN.ts'
import { zhTW } from '../src/i18n/locales/zh-TW.ts'
import { en } from '../src/i18n/locales/en.ts'
import { ja } from '../src/i18n/locales/ja.ts'

console.log('--- Testing Traffic Reset Logic & Formatting ---')

// 1. Test formatTrafficResetSchedule
{
  assert.equal(formatTrafficResetSchedule(undefined), '')
  assert.equal(formatTrafficResetSchedule(0), '不设置月度重置')
  assert.equal(
    formatTrafficResetSchedule(1, '00:00:00', 'Asia/Tokyo'),
    '每月 1 日 00:00 (Asia/Tokyo)',
  )
  assert.equal(
    formatTrafficResetSchedule(15, '04:30:00', 'UTC'),
    '每月 15 日 04:30 (UTC)',
  )
  console.log('✓ formatTrafficResetSchedule tests passed')
}

// 2. Test formatTrafficResetRemaining
{
  const fixedNow = new Date('2026-11-08T12:00:00Z')
  // Next reset 22 days, 4 hours later
  const target = new Date('2026-11-30T16:00:00Z').toISOString()
  const remaining = formatTrafficResetRemaining(target, fixedNow)
  assert.equal(remaining, '22 天 4 小时')

  // Next reset 3 hours, 20 minutes later
  const shortTarget = new Date('2026-11-08T15:20:00Z').toISOString()
  assert.equal(formatTrafficResetRemaining(shortTarget, fixedNow), '3 小时 20 分钟')

  // Next reset 15 minutes later
  const veryShortTarget = new Date('2026-11-08T12:15:00Z').toISOString()
  assert.equal(formatTrafficResetRemaining(veryShortTarget, fixedNow), '15 分钟')

  // Past reset
  const pastTarget = new Date('2026-11-08T11:00:00Z').toISOString()
  assert.equal(formatTrafficResetRemaining(pastTarget, fixedNow), '即将重置')

  console.log('✓ formatTrafficResetRemaining tests passed')
}

// 3. Test formatTrafficResetBadge
{
  const fixedNow = new Date('2026-11-08T12:00:00Z')
  const target = new Date('2026-11-30T16:00:00Z').toISOString()
  assert.equal(formatTrafficResetBadge(1, target, fixedNow), '还有 22 天')

  const shortTarget = new Date('2026-11-08T15:20:00Z').toISOString()
  assert.equal(formatTrafficResetBadge(1, shortTarget, fixedNow), '还有 3 小时')

  // Without instant, but with active day
  assert.equal(formatTrafficResetBadge(15, undefined, fixedNow), '15 日重置')

  console.log('✓ formatTrafficResetBadge tests passed')
}

// 4. Test computeTrafficResetInfo with full backend data
{
  const fixedNow = new Date('2026-11-08T12:00:00Z')
  const node = {
    uuid: 'test-1',
    traffic_limit: 5_000_000_000_000,
    traffic_limit_type: 'sum',
    traffic_reset_day: 1,
    traffic_reset_time: '00:00:00',
    traffic_reset_timezone: 'Asia/Tokyo',
    traffic_next_reset: '2026-12-01T00:00:00+09:00',
  }
  const info = computeTrafficResetInfo(node, fixedNow)
  assert.ok(info)
  assert.equal(info.resetDay, 1)
  assert.equal(info.scheduleText, '每月 1 日 00:00 (Asia/Tokyo)')
  assert.ok(info.remainingText?.includes('天'))
  assert.ok(info.badgeText?.startsWith('还有'))
  assert.ok(info.tooltip?.includes('重置周期'))
  assert.ok(info.tooltip?.includes('下次重置'))

  console.log('✓ computeTrafficResetInfo full data test passed')
}

// 5. Test computeTrafficResetInfo client fallback when nextReset is omitted
{
  const fixedNow = new Date('2026-11-08T12:00:00Z')
  const node = {
    uuid: 'test-fallback',
    traffic_limit: 10_000_000_000_000,
    traffic_reset_day: 15,
    traffic_reset_time: '04:00:00',
    traffic_reset_timezone: 'UTC',
  }
  const info = computeTrafficResetInfo(node, fixedNow)
  assert.ok(info)
  assert.equal(info.resetDay, 15)
  assert.ok(info.nextReset)
  assert.ok(new Date(info.nextReset).getTime() > fixedNow.getTime())
  assert.ok(info.remainingText?.includes('天'))

  console.log('✓ computeTrafficResetInfo fallback test passed')
}

// 6. Test computeTrafficQuota integration
{
  const fixedNow = new Date('2026-11-08T12:00:00Z')
  const node = {
    uuid: 'test-quota',
    traffic_limit: 100_000_000,
    traffic_limit_type: 'sum',
    traffic_reset_day: 1,
    traffic_reset_time: '00:00:00',
    traffic_reset_timezone: 'Asia/Shanghai',
    traffic_next_reset: '2026-12-01T00:00:00+08:00',
  }
  const record = {
    uuid: 'test-quota',
    online: true,
    network_total_up: 30_000_000,
    network_total_down: 40_000_000,
  }
  const quota = computeTrafficQuota(node, record, fixedNow)
  assert.ok(quota)
  assert.equal(quota.used, 70_000_000)
  assert.equal(quota.limit, 100_000_000)
  assert.equal(quota.percent, 70)
  assert.equal(quota.level, 'warn')
  assert.ok(quota.reset)
  assert.equal(quota.reset.resetDay, 1)
  assert.ok(quota.reset.remainingText)
  assert.ok(quota.reset.badgeText)

  console.log('✓ computeTrafficQuota integration test passed')
}

// 7. Verify i18n dictionaries contain traffic keys
{
  const requiredKeys = [
    'traffic.threshold',
    'traffic.sum',
    'traffic.max',
    'traffic.reset_cycle',
    'traffic.next_reset',
    'traffic.remaining',
    'traffic.no_reset',
  ]
  for (const k of requiredKeys) {
    assert.ok(zhCN[k], `Missing ${k} in zh-CN`)
    assert.ok(zhTW[k], `Missing ${k} in zh-TW`)
    assert.ok(en[k], `Missing ${k} in en`)
    assert.ok(ja[k], `Missing ${k} in ja`)
  }
  console.log('✓ i18n dictionaries keys verified across all 4 locales')
}

console.log('All traffic reset unit tests passed successfully!')
