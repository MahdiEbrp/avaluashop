import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

/**
 * Fixed-window rate limiter with two stores.
 *
 * Production uses Upstash Redis (`UPSTASH_REDIS_REST_URL` and
 * `UPSTASH_REDIS_REST_TOKEN`), so the budget is shared by every serverless
 * instance. Without those variables the limiter falls back to process memory:
 * that is only a per-instance guard and it is logged once at startup.
 */

export interface LimitPolicy {
   /** How many hits are allowed inside one window. */
   limit: number
   /** Window length in milliseconds. */
   windowMs: number
}

export interface LimitVerdict {
   allowed: boolean
   remaining: number
   retryAfterSeconds: number
}

export interface LimitStore {
   /** Counts one hit and reports the hit count and milliseconds left in the window. */
   hit(key: string, windowMs: number): Promise<{ count: number; ttlMs: number }>
   clear(key: string): Promise<void>
}

export const AUTH_SEND_POLICY: LimitPolicy = { limit: 6, windowMs: 10 * 60_000 }
export const AUTH_VERIFY_POLICY: LimitPolicy = { limit: 5, windowMs: 10 * 60_000 }

const MAX_TRACKED_KEYS = 5000

export function createMemoryStore(now: () => number = Date.now): LimitStore {
   const windows = new Map<string, { count: number; resetAt: number }>()

   return {
      hit(key, windowMs) {
         const current = now()
         const existing = windows.get(key)

         if (!existing || existing.resetAt <= current) {
            windows.delete(key)
            windows.set(key, { count: 1, resetAt: current + windowMs })

            if (windows.size > MAX_TRACKED_KEYS) {
               const oldest = windows.keys().next()
               /* The map is over the cap here, so the iterator always yields. */
               /* v8 ignore next */
               if (!oldest.done) windows.delete(oldest.value)
            }

            return Promise.resolve({ count: 1, ttlMs: windowMs })
         }

         existing.count += 1

         return Promise.resolve({ count: existing.count, ttlMs: existing.resetAt - current })
      },
      clear(key) {
         windows.delete(key)

         return Promise.resolve()
      },
   }
}

export type RedisLike = Pick<Redis, 'set' | 'incr' | 'pttl' | 'del'>

export function createRedisStore(redis: RedisLike): LimitStore {
   return {
      async hit(key, windowMs) {
         /* NX with a TTL creates the window once; INCR then counts inside it.
            No key is ever left without an expiry. */
         await redis.set(key, 0, { nx: true, px: windowMs })
         const count = await redis.incr(key)
         const ttl = await redis.pttl(key)

         return { count, ttlMs: ttl > 0 ? ttl : windowMs }
      },
      async clear(key) {
         await redis.del(key)
      },
   }
}

let activeStore: LimitStore | undefined

function store(): LimitStore {
   if (activeStore) return activeStore

   const url = process.env.UPSTASH_REDIS_REST_URL
   const token = process.env.UPSTASH_REDIS_REST_TOKEN

   if (url && token) {
      activeStore = createRedisStore(new Redis({ url, token }))
   } else {
      console.warn(
         '[RATE_LIMIT] UPSTASH_REDIS_REST_URL/TOKEN not set; using per-instance memory'
      )
      activeStore = createMemoryStore()
   }

   return activeStore
}

/** Records one attempt against `key` and reports whether it may proceed. */
export async function consume(key: string, policy: LimitPolicy): Promise<LimitVerdict> {
   const { count, ttlMs } = await store().hit(key, policy.windowMs)

   if (count > policy.limit) {
      return {
         allowed: false,
         remaining: 0,
         retryAfterSeconds: Math.max(1, Math.ceil(ttlMs / 1000)),
      }
   }

   return { allowed: true, remaining: policy.limit - count, retryAfterSeconds: 0 }
}

/** Clears a bucket after the protected action succeeded. */
export async function forget(key: string): Promise<void> {
   await store().clear(key)
}

/**
 * Best available client address. On Vercel (and any reverse proxy that
 * overwrites the header) the leftmost `x-forwarded-for` entry is the client.
 */
export function clientIp(req: Request): string {
   const forwardedFor = req.headers.get('x-forwarded-for')

   /* `split` always yields at least one element, so `?? ''` is a type-level
      fallback only. */
   /* v8 ignore next */
   if (forwardedFor) return (forwardedFor.split(',', 1)[0] ?? '').trim()

   return req.headers.get('x-real-ip') ?? 'unknown'
}

export function limitKey(scope: string, ip: string, identifier: string): string {
   return `rl:${scope}:${ip}:${identifier.toLowerCase()}`
}

/** 429 with the standard retry hint, and never cached. */
export function tooManyRequests(retryAfterSeconds: number): NextResponse {
   return NextResponse.json(
      { status: 'fail', message: 'TOO MANY REQUESTS' },
      {
         status: 429,
         headers: {
            'Retry-After': String(retryAfterSeconds),
            'Cache-Control': 'no-store',
         },
      }
   )
}
