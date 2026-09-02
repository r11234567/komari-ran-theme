/**
 * 请求去重 / 短期缓存。
 *
 * 同一页上有多个 hook 各自按节点扇出(useKomari、App 级 useGlobalHistory、
 * 页面级 useGlobalHistory),它们问的其实是同一个问题。这里让同 key 的请求
 * 共享一次往返,并把结果留 ttlMs 供后到的调用方复用。
 *
 * 共享请求自己持有生命周期 —— 某个调用方卸载不能把别人还在等的请求取消掉。
 * 调用方各自的取消语义交给 withAbort。
 */

const CACHE_LIMIT = 64

interface CacheEntry<T> {
  promise: Promise<T>
  /** 请求仍在飞行中时为 0。 */
  expiresAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()

function sweep(now: number) {
  if (cache.size <= CACHE_LIMIT) return
  for (const [key, entry] of cache) {
    if (entry.expiresAt !== 0 && entry.expiresAt <= now) cache.delete(key)
  }
}

const abortReason = (signal: AbortSignal): unknown =>
  (signal as { reason?: unknown }).reason ?? new DOMException('Aborted', 'AbortError')

export function dedupe<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const cached = cache.get(key) as CacheEntry<T> | undefined
  if (cached && (cached.expiresAt === 0 || cached.expiresAt > now)) return cached.promise

  const entry = { expiresAt: 0 } as CacheEntry<T>
  entry.promise = (async () => factory())().then(
    (value) => {
      entry.expiresAt = Date.now() + ttlMs
      return value
    },
    (error) => {
      cache.delete(key)
      throw error
    },
  )
  cache.set(key, entry as CacheEntry<unknown>)
  sweep(now)
  return entry.promise
}

/** 调用方的 signal 触发后只让它自己这条 promise 拒绝,共享请求继续跑。 */
export function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(abortReason(signal))
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortReason(signal))
    signal.addEventListener('abort', onAbort, { once: true })
    const settle = () => signal.removeEventListener('abort', onAbort)
    promise.then(
      (value) => {
        settle()
        resolve(value)
      },
      (error) => {
        settle()
        reject(error)
      },
    )
  })
}

/**
 * 把窗口末端对齐到 stepMs 边界。否则每个调用方各带一个 Date.now(),
 * 缓存 key 永远撞不上。
 */
export function quantizedWindow(hours: number, stepMs: number) {
  const end = new Date(Math.floor(Date.now() / stepMs) * stepMs)
  return { start: new Date(end.getTime() - hours * 3_600_000), end }
}

/** 与窗口无关的稳定 key 片段。 */
export const idsKey = (ids: string[]) => [...ids].sort().join(',')
