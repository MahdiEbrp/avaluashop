import {
   AUTH_SEND_POLICY,
   AUTH_VERIFY_POLICY,
   clientIp,
   consume,
   forget,
   limitKey,
   tooManyRequests,
} from '@/lib/rate-limit'

const policy = { limit: 3, windowMs: 10_000 }

describe('consume', () => {
   it('allows up to the limit and reports the remaining budget', () => {
      expect(consume('a', policy)).toEqual({
         allowed: true,
         remaining: 2,
         retryAfterSeconds: 0,
      })
      expect(consume('a', policy)).toEqual({
         allowed: true,
         remaining: 1,
         retryAfterSeconds: 0,
      })
      expect(consume('a', policy)).toEqual({
         allowed: true,
         remaining: 0,
         retryAfterSeconds: 0,
      })
   })

   it('blocks once the budget is spent and reports a retry hint', () => {
      consume('b', policy)
      consume('b', policy)
      consume('b', policy)

      const blocked = consume('b', policy)

      expect(blocked.allowed).toBe(false)
      expect(blocked.remaining).toBe(0)
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
      expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(10)
   })

   it('keeps buckets independent per key', () => {
      consume('c1', policy)
      consume('c1', policy)
      consume('c1', policy)

      expect(consume('c1', policy).allowed).toBe(false)
      expect(consume('c2', policy).allowed).toBe(true)
   })

   it('slides the window: hits older than windowMs stop counting', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))

      consume('d', policy)
      consume('d', policy)
      consume('d', policy)
      expect(consume('d', policy).allowed).toBe(false)

      vi.setSystemTime(new Date('2024-01-01T00:00:11Z'))

      expect(consume('d', policy).allowed).toBe(true)
   })

   it('reports at least one second of wait even at the edge of the window', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))

      const tight = { limit: 1, windowMs: 10 }
      consume('edge', tight)
      vi.setSystemTime(new Date('2024-01-01T00:00:00.005Z'))

      expect(consume('edge', tight).retryAfterSeconds).toBe(1)
   })

   it('bounds memory by evicting the oldest bucket past the cap', () => {
      /* MAX_TRACKED_KEYS is 5000; the 5001st distinct key must push the first
         one out so a flood of keys cannot grow the map without bound. */
      for (let index = 0; index < 5001; index++) consume(`flood-${index}`, policy)

      expect(consume('flood-0', policy).remaining).toBe(2)
   })
})

describe('forget', () => {
   it('clears a bucket so the next attempt starts from a full budget', () => {
      consume('e', policy)
      consume('e', policy)
      consume('e', policy)
      expect(consume('e', policy).allowed).toBe(false)

      forget('e')

      expect(consume('e', policy)).toMatchObject({ allowed: true, remaining: 2 })
   })

   it('is a no-op for an unknown key', () => {
      expect(() => forget('never-seen')).not.toThrow()
   })
})

describe('policies', () => {
   it('allow six deliveries and five verification attempts per ten minutes', () => {
      expect(AUTH_SEND_POLICY).toEqual({ limit: 6, windowMs: 600_000 })
      expect(AUTH_VERIFY_POLICY).toEqual({ limit: 5, windowMs: 600_000 })
   })
})

describe('clientIp', () => {
   const request = (headers: Record<string, string>) =>
      new Request('http://localhost/api/x', { headers })

   it('takes the leftmost x-forwarded-for hop', () => {
      expect(clientIp(request({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4')
   })

   it('trims whitespace around the hop and ignores a forged tail', () => {
      expect(clientIp(request({ 'x-forwarded-for': '  5.6.7.8  ,evil' }))).toBe('5.6.7.8')
   })

   it('falls back to x-real-ip', () => {
      expect(clientIp(request({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9')
   })

   it('reports unknown when neither header is present', () => {
      expect(clientIp(request({}))).toBe('unknown')
   })
})

describe('tooManyRequests', () => {
   it('answers 429 with retry-after and no-store', async () => {
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

describe('limitKey', () => {
   it('joins scope, client and a normalised identifier', () => {
      expect(limitKey('otp', '1.2.3.4', '  User@Example.COM ')).toBe(
         'otp:1.2.3.4:user@example.com'
      )
   })
})

describe('consume with a policy that blocks everything', () => {
   it('reports a wait hint even though no hit was ever recorded', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))

      /* limit 0 means the very first attempt is already over budget, so the
         blocked branch runs with an empty hit list — the `?? now` fallback. */
      const denied = consume('never-allowed', { limit: 0, windowMs: 10_000 })

      expect(denied.allowed).toBe(false)
      expect(denied.remaining).toBe(0)
      expect(denied.retryAfterSeconds).toBe(10)

      vi.useRealTimers()
   })
})
