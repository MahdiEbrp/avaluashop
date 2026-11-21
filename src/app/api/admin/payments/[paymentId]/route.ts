import prisma from '@/lib/prisma'
import { getErrorResponse } from '@/lib/utils'
import { NextResponse } from 'next/server'

type RouteContext = Readonly<{ params: Promise<{ paymentId: string }> }>

function unauthorized() {
   return getErrorResponse(401, 'UNAUTHORIZED')
}

export async function GET(req: Request, { params }: RouteContext) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   const { paymentId } = await params

   try {
      const payment = await prisma.payment.findUnique({
         where: { id: paymentId },
         include: {
            provider: true,
            order: { select: { id: true, number: true, status: true } },
            user: { select: { id: true, name: true, email: true } },
         },
      })

      if (!payment) return getErrorResponse(404, 'PAYMENT NOT FOUND')

      return NextResponse.json(payment)
   } catch (error) {
      console.error('[ADMIN_PAYMENT_GET]', error)
      return getErrorResponse(500, 'Internal error')
   }
}

export async function PATCH(req: Request) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   /* Payment settlement is evidence from the verified gateway callback.
      Admin edits must never be able to mark a payment paid or rewrite its
      amount; reconciliation belongs in a separate audited workflow. */
   return NextResponse.json(
      { message: 'PAYMENT_SETTLEMENT_READ_ONLY' },
      { status: 405, headers: { Allow: 'GET' } }
   )
}
