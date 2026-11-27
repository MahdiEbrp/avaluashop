import { ipv4 } from '../support/ip'
import {
   AUTH_SEND_POLICY,
   clientIp,
   consume,
   createMemoryStore,
   createRedisStore,
   forget,
   limitKey,
   tooManyRequests,
   type LimitPolicy,
   type RedisLike,
} from '@/lib/rate-limit'

const redisState = vi.hoisted(() => ({
   instance: {},
   configs: [] as { url: string; token: string }[],
}))

vi.mock('@upstash/redis', () => ({
   Redis: function RedisMock(config: { url: string; token: string }) {
      redisState.configs.push(config)
      return redisState.instance
   },
}))

/** An in-memory stand-in with the four commands the store uses. */
function fakeRedis() {
   const values = new Map<string, { value: number; expiresAt: number }>()

   return {
      set: vi.fn((key: string, value: number, options?: { nx?: boolean; px?: number }) => {
         const live = values.get(key)
         if (options?.nx && live && live.expiresAt > Date.now()) return Promise.resolve(null)
         values.set(key, { value, expiresAt: Date.now() + (options?.px ?? 0) })
         return Promise.resolve("OK")
      }),
      incr: vi.fn((key: string) => {
         const entry = values.get(key)
         if (!entry) throw new Error("incr before set")
         entry.value += 1
         return Promise.resolve(entry.value)
      }),
      pttl: vi.fn((key: string) => {
         const entry = values.get(key)
         return Promise.resolve(entry ? entry.expiresAt - Date.now() : -2)
      }),
      del: vi.fn((key: string) => {
         values.delete(key)
         return Promise.resolve(1)
      }),
   }
}

const policy: LimitPolicy = { limit: 2, windowMs: 60_000 }

beforeEach(() => {
   vi.spyOn(console, 'warn').mockImplementation(() => {/* noop */})
})

afterEach(() => {
   vi.unstubAllEnvs()
   vi.restoreAllMocks()
   vi.resetModules()
   redisState.configs.length = 0
})

describe('memory store', () => {
   it('counts hits and reports the time left in the window', async () => {
      let now = 1000
      const store = createMemoryStore(() => now)

      await expect(store.hit('a', 10_000)).resolves.toEqual({ count: 1, ttlMs: 10_000 })
      now += 4000
      await expect(store.hit('a', 10_000)).resolves.toEqual({ count: 2, ttlMs: 6000 })
   })

   it('starts a fresh window once the old one has expired', async () => {
      let now = 0
      const store = createMemoryStore(() => now)

      await store.hit('a', 1000)
      now = 1000
      await expect(store.hit('a', 1000)).resolves.toEqual({ count: 1, ttlMs: 1000 })
   })

   it('clears a key on request', async () => {
      const store = createMemoryStore()

      await store.hit('a', 60_000)
      await store.clear('a')
      await expect(store.hit('a', 60_000)).resolves.toMatchObject({ count: 1 })
   })

   it('evicts the oldest key once the map is over its cap', async () => {
      const store = createMemoryStore()

      await store.hit('first', 60_000)
      await store.hit('first', 60_000)
      for (let index = 0; index < 5000; index += 1) {
         await store.hit(`filler-${index}`, 60_000)
      }

      /* `first` was the oldest insertion and got evicted, so it counts from 1 again. */
      await expect(store.hit('first', 60_000)).resolves.toMatchObject({ count: 1 })
   })
})

describe('redis store', () => {
   it('creates the window with a TTL, counts with INCR, and reads the TTL', async () => {
      const redis = fakeRedis()
      const store = createRedisStore(redis as unknown as RedisLike)

      const first = await store.hit('k', 60_000)
      const second = await store.hit('k', 60_000)

      expect(redis.set).toHaveBeenCalledWith('k', 0, { nx: true, px: 60_000 })
      expect(first.count).toBe(1)
      expect(second.count).toBe(2)
      expect(second.ttlMs).toBeGreaterThan(0)
   })

   it('falls back to the full window when the TTL is not positive', async () => {
      const redis = fakeRedis()
      redis.pttl.mockResolvedValueOnce(-1)
      const store = createRedisStore(redis as unknown as RedisLike)

      await expect(store.hit('k', 5000)).resolves.toMatchObject({ ttlMs: 5000 })
   })

   it('deletes the key on clear', async () => {
      const redis = fakeRedis()
      const store = createRedisStore(redis as unknown as RedisLike)

      await store.clear('k')
      expect(redis.del).toHaveBeenCalledWith('k')
   })
})

describe('consume and forget', () => {
   it('allows up to the limit and then reports the wait', async () => {
      vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
      const limiter = await import('@/lib/rate-limit')

      const one = await limiter.consume('c1', policy)
      const two = await limiter.consume('c1', policy)
      const three = await limiter.consume('c1', policy)

      expect(one).toEqual({ allowed: true, remaining: 1, retryAfterSeconds: 0 })
      expect(two).toEqual({ allowed: true, remaining: 0, retryAfterSeconds: 0 })
      expect(three.allowed).toBe(false)
      expect(three.retryAfterSeconds).toBeGreaterThanOrEqual(1)
   })

   it('lets a cleared key start over', async () => {
      vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
      const limiter = await import('@/lib/rate-limit')

      await limiter.consume('c2', policy)
      await limiter.consume('c2', policy)
      await limiter.forget('c2')

      await expect(limiter.consume('c2', policy)).resolves.toMatchObject({ allowed: true })
   })

   it('warns once and uses memory when Upstash is not configured', async () => {
      vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
      const limiter = await import('@/lib/rate-limit')

      await limiter.consume('c3', AUTH_SEND_POLICY)
      await limiter.consume('c3', AUTH_SEND_POLICY)

      expect(console.warn).toHaveBeenCalledTimes(1)
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[RATE_LIMIT]'))
   })

   it('shares the budget through Redis when Upstash is configured', async () => {
      vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io')
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token-value')
      redisState.instance = fakeRedis()
      const limiter = await import('@/lib/rate-limit')

      await limiter.consume('c4', policy)
      await limiter.consume('c4', policy)
      const blocked = await limiter.consume('c4', policy)
      await limiter.forget('c4')

      expect(redisState.configs).toEqual([
         { url: 'https://example.upstash.io', token: 'token-value' },
      ])
      expect(blocked.allowed).toBe(false)
      expect(console.warn).not.toHaveBeenCalled()
      expect((redisState.instance as ReturnType<typeof fakeRedis>).del).toHaveBeenCalledWith('c4')
   })

   it('exposes the module-level helpers', async () => {
      await expect(consume('module-level', policy)).resolves.toMatchObject({ allowed: true })
      await expect(forget('module-level')).resolves.toBeUndefined()
   })
})

describe('client identity and keys', () => {
   it('takes the leftmost forwarded address', () => {
      const req = new Request('http://localhost', {
         headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' },
      })

      expect(clientIp(req)).toBe('203.0.113.9')
   })

   it('falls back to x-real-ip, then to unknown', () => {
      const real = new Request('http://localhost', { headers: { 'x-real-ip': '198.51.100.2' } })
      const none = new Request('http://localhost')

      expect(clientIp(real)).toBe('198.51.100.2')
      expect(clientIp(none)).toBe('unknown')
   })

   it('builds keys from scope, address and a case-folded identifier', () => {
      expect(limitKey('otp-send', ipv4(1, 2, 3, 4), 'Buyer@Example.com')).toBe(
         'rl:otp-send:1.2.3.4:buyer@example.com'
      )
   })

   it('answers 429 with Retry-After and never caches', async () => {
      const response = tooManyRequests(42)

      expect(response.status).toBe(429)
      expect(response.headers.get('Retry-After')).toBe('42')
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      await expect(response.json()).resolves.toEqual({
         status: 'fail',
         message: 'TOO MANY REQUESTS',
      })
   })
})
