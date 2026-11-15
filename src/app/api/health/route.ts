import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'

/**
 * Liveness + readiness probe.
 *
 * Public on purpose: an uptime monitor has no session. It therefore reports a
 * verdict and nothing else — no versions, no connection strings, no row counts.
 * `status: 'fail'` with 503 is what a monitor should alert on, so the database
 * check is a real `SELECT 1` rather than a hardcoded `ok`.
 */
export async function GET() {
   const startedAt = Date.now()

   try {
      await prisma.$queryRaw`SELECT 1`

      return NextResponse.json(
         {
            status: 'success',
            database: 'reachable',
            latencyMs: Date.now() - startedAt,
         },
         { headers: { 'Cache-Control': 'no-store' } }
      )
   } catch (error) {
      console.error('[HEALTH]', error)

      return NextResponse.json(
         { status: 'fail', database: 'unreachable' },
         { status: 503, headers: { 'Cache-Control': 'no-store' } }
      )
   }
}
