import { reconcilePendingOrders } from '@/lib/payments/reconcile-pending-orders'
import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

function extractCronToken(req: Request): string | null {
   const bearer = req.headers.get('authorization')
   if (bearer?.startsWith('Bearer ')) {
      return bearer.slice('Bearer '.length).trim()
   }
   return req.headers.get('x-cron-secret')?.trim() ?? null
}

function secretsMatch(expected: string, provided: string): boolean {
   const expectedBuf = Buffer.from(expected, 'utf8')
   const providedBuf = Buffer.from(provided, 'utf8')
   if (expectedBuf.length !== providedBuf.length) return false
   return timingSafeEqual(expectedBuf, providedBuf)
}

export async function POST(req: Request) {
   const configuredSecret = process.env.CRON_SECRET?.trim() ?? ''
   if (configuredSecret.length < 16) {
      return NextResponse.json(
         { message: 'CRON_SECRET_NOT_CONFIGURED' },
         { status: 503, headers: { 'Cache-Control': 'no-store' } }
      )
   }

   const providedSecret = extractCronToken(req)
   if (!providedSecret || !secretsMatch(configuredSecret, providedSecret)) {
      return NextResponse.json(
         { message: 'UNAUTHORIZED' },
         { status: 401, headers: { 'Cache-Control': 'no-store' } }
      )
   }

   let body: { expiryMinutes?: number; limit?: number } = {}
   const rawBody = await req.text()
   if (rawBody.trim().length > 0) {
      try {
         const parsed = JSON.parse(rawBody) as
            | { expiryMinutes?: number; limit?: number }
            | unknown[]
            | null
         if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return NextResponse.json(
               { message: 'INVALID_RECONCILE_OPTIONS' },
               { status: 400, headers: { 'Cache-Control': 'no-store' } }
            )
         }
         body = parsed
      } catch {
         return NextResponse.json(
            { message: 'INVALID_RECONCILE_OPTIONS' },
            { status: 400, headers: { 'Cache-Control': 'no-store' } }
         )
      }
   }

   try {
      const result = await reconcilePendingOrders({
         expiryMinutes: body.expiryMinutes,
         limit: body.limit,
      })
      return NextResponse.json(result, {
         status: 200,
         headers: { 'Cache-Control': 'no-store' },
      })
   } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_RECONCILE_OPTIONS') {
         return NextResponse.json(
            { message: 'INVALID_RECONCILE_OPTIONS' },
            { status: 400, headers: { 'Cache-Control': 'no-store' } }
         )
      }
      console.error('[RECONCILE_PENDING_ORDERS_POST]', error)
      return NextResponse.json(
         { message: 'INTERNAL_ERROR' },
         { status: 500, headers: { 'Cache-Control': 'no-store' } }
      )
   }
}
