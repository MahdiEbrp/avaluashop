import prisma from '@/lib/prisma'
import { releasePendingOrder } from '@/lib/payments/order-lifecycle'
import {
   createTabapayPayment,
   isTabapayAmountValid,
   validateTabapayConfiguration,
} from '@/lib/payments/tabapay'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
   let orderId: string | undefined
   let paymentId: string | undefined
   let gatewayRequestStarted = false

   try {
      const userId = req.headers.get('X-USER-ID')
      if (!userId) {
         return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })
      }

      const body = await req.json()
      orderId = typeof body.orderId === 'string' ? body.orderId : undefined
      if (!orderId) {
         return NextResponse.json({ message: 'ORDER_ID_REQUIRED' }, { status: 400 })
      }

      const orderSnapshot = await prisma.order.findFirst({
         where: { id: orderId, userId },
         include: { address: true },
      })
      if (!orderSnapshot) {
         return NextResponse.json({ message: 'ORDER_NOT_FOUND' }, { status: 404 })
      }
      if (orderSnapshot.isPaid || orderSnapshot.status !== 'PendingPayment') {
         return NextResponse.json({ message: 'ORDER_NOT_PAYABLE' }, { status: 409 })
      }

      const amountRial = Math.round(orderSnapshot.payable * 10)
      if (!isTabapayAmountValid(amountRial)) {
         await releasePendingOrder(orderId)
         return NextResponse.json(
            { message: 'TABAPAY_AMOUNT_OUT_OF_RANGE' },
            { status: 400 }
         )
      }

      try {
         validateTabapayConfiguration()
      } catch {
         await releasePendingOrder(orderId)
         return NextResponse.json(
            { message: 'TABAPAY_NOT_CONFIGURED' },
            { status: 503 }
         )
      }

      // A transaction-scoped PostgreSQL advisory lock serializes payment
      // initialization for this order without holding a DB transaction open
      // while making the external gateway request.
      const reservation = await prisma.$transaction(async (tx) => {
         await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${orderId}))`

         const order = await tx.order.findFirst({
            where: { id: orderId, userId },
            include: { address: true },
         })
         if (!order || order.isPaid || order.status !== 'PendingPayment') {
            return { kind: 'not-payable' as const }
         }

         const existingPayment = await tx.payment.findFirst({
            where: { orderId: order.id, status: 'Processing' },
            select: { id: true, refId: true, paymentUrl: true },
         })
         if (existingPayment) {
            if (existingPayment.paymentUrl && !existingPayment.refId.startsWith('pending:')) {
               return { kind: 'existing-url' as const, paymentUrl: existingPayment.paymentUrl }
            }
            return { kind: 'initializing' as const }
         }

         const provider = await tx.paymentProvider.upsert({
            where: { title: 'Tabapay' },
            create: {
               title: 'Tabapay',
               description: 'Tabapay Iranian payment gateway',
               websiteUrl: 'https://tabapay.ir',
               isActive: true,
            },
            update: {},
         })
         if (!provider.isActive) return { kind: 'disabled' as const }

         const payment = await tx.payment.create({
            data: {
               status: 'Processing',
               refId: `pending:${crypto.randomUUID()}`,
               payable: order.payable,
               providerId: provider.id,
               userId,
               orderId: order.id,
            },
         })
         return { kind: 'created' as const, paymentId: payment.id, order }
      })

      if (reservation.kind === 'not-payable') {
         return NextResponse.json({ message: 'ORDER_NOT_PAYABLE' }, { status: 409 })
      }
      if (reservation.kind === 'existing-url') {
         return NextResponse.json({ paymentUrl: reservation.paymentUrl })
      }
      if (reservation.kind === 'initializing') {
         return NextResponse.json(
            { message: 'PAYMENT_ALREADY_INITIALIZED' },
            { status: 202 }
         )
      }
      if (reservation.kind === 'disabled') {
         await releasePendingOrder(orderId)
         return NextResponse.json({ message: 'PAYMENT_PROVIDER_DISABLED' }, { status: 503 })
      }

      paymentId = reservation.paymentId
      gatewayRequestStarted = true
      const result = await createTabapayPayment({
         amountRial,
         orderNumber: reservation.order.number,
         mobile: reservation.order.address?.phone,
      })

      await prisma.payment.update({
         where: { id: paymentId },
         data: { refId: result.token, paymentUrl: result.paymentUrl },
      })

      return NextResponse.json({ paymentUrl: result.paymentUrl })
   } catch (error) {
      console.error('[TABAPAY_CREATE]', error)

      // Once the external create request has started, its outcome may be
      // unknown (for example a timeout after the provider created a token).
      // Keep the reservation in that case; releasing it could permit an
      // untracked late payment against stock that has already been resold.
      if (orderId && !gatewayRequestStarted) {
         await releasePendingOrder(orderId, paymentId).catch((releaseError) => {
            console.error('[TABAPAY_RELEASE]', releaseError)
         })
      }

      return NextResponse.json(
         { message: gatewayRequestStarted
            ? 'PAYMENT_INITIALIZATION_PENDING_RECONCILIATION'
            : 'PAYMENT_INITIALIZATION_FAILED' },
         { status: gatewayRequestStarted ? 202 : 502 }
      )
   }
}
