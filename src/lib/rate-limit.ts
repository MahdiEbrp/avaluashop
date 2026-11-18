import { NextResponse } from 'next/server'

/**
 * Process-local sliding-window rate limiter.
 *
 * Scope: one Node process. That is enough to stop online guessing of an OTP
 * (which is what it defends: a 5-digit code with unlimited attempts is not a
 * secret) and to stop the mail/SMS handshake from being used as a free
 * delivery service for someone else's inbox. A multi-instance deployment
 * should put this state in Redis and keep the same policies — the shape of the
 * API does not change.
 *
 * Memory is bounded two ways: each key keeps at most `limit` timestamps, and
 * the map itself is capped at `MAX_TRACKED_KEYS` (oldest-inserted key evicted),
 * so a flood of unique keys degrades accuracy instead of the process.
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

const buckets = new Map<string, number[]>()
const MAX_TRACKED_KEYS = 5000

/** The OTP handshake: 6 deliveries per identifier per 10 minutes. */
export const AUTH_SEND_POLICY: LimitPolicy = { limit: 6, windowMs: 10 * 60_000 }

/** The OTP check: 5 *failed* attempts per identifier per 10 minutes. */
export const AUTH_VERIFY_POLICY: LimitPolicy = { limit: 5, windowMs: 10 * 60_000 }

function recentOnly(
   hitTimes: readonly number[],
   now: number,
   windowMs: number
): number[] {
   return hitTimes.filter((time) => now - time < windowMs)
}

function evictOne(): void {
   if (buckets.size <= MAX_TRACKED_KEYS) return

   const oldest = buckets.keys().next()

   /* `evictOne` only runs once the map is over the cap, so the iterator is
      never empty here; the guard keeps it honest for the type. */
   /* v8 ignore next */
   if (!oldest.done) buckets.delete(oldest.value)
}

/** Records one attempt against `key` and reports whether it may proceed. */
export function consume(key: string, policy: LimitPolicy): LimitVerdict {
   const now = Date.now()
   const hits = recentOnly(buckets.get(key) ?? [], now, policy.windowMs)

   if (hits.length >= policy.limit) {
      buckets.set(key, hits)

      const oldestHit = hits[0] ?? now
      const waitsUntil = oldestHit + policy.windowMs

      return {
         allowed: false,
         remaining: 0,
         retryAfterSeconds: Math.max(1, Math.ceil((waitsUntil - now) / 1000)),
      }
   }

   hits.push(now)
   buckets.set(key, hits)
   evictOne()

   return { allowed: true, remaining: policy.limit - hits.length, retryAfterSeconds: 0 }
}

/** Clears a bucket — used when the attempt succeeded. */
export function forget(key: string): void {
   buckets.delete(key)
}

/**
 * Best available client address. On Vercel (and any reverse proxy) the leftmost
 * `x-forwarded-for` entry is the original client; direct connections fall back
 * to `x-real-ip`.
 */
export function clientIp(req: Request): string {
   const forwardedFor = req.headers.get('x-forwarded-for')

   /* `split(x, 1)` returns just the first hop, so a forged tail cannot be
      read and no array is allocated per request. */
   /* `split` always yields at least one element, so `?? ''` is only a
      type-level fallback. */
   /* v8 ignore next */
   if (forwardedFor) return (forwardedFor.split(',', 1)[0] ?? '').trim()

   return req.headers.get('x-real-ip') ?? 'unknown'
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

/** One key per (scope, client, identifier) triple. */
export function limitKey(
   scope: string,
   ip: string,
   identifier: string
): string {
   return `${scope}:${ip}:${identifier.trim().toLowerCase()}`
}
