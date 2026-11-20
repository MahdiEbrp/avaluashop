import prisma from '@/lib/prisma'
import { releasePendingOrder } from '@/lib/payments/order-lifecycle'
import {
   TABAPAY_PROVIDER_CODE,
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

      // Check for an existing transaction before validating current gateway
      // configuration. A configuration change must never cancel an order that
      // already has a usable payment URL or an in-flight initialization.
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

         const amountRial = Math.round(order.payable * 10)
         if (!isTabapayAmountValid(amountRial)) {
            return { kind: 'amount-invalid' as const }
         }

         try {
            await validateTabapayConfiguration()
         } catch {
            return { kind: 'not-configured' as const }
         }

         /* Resolve the row the admin settings page writes; never create one
            here. Creating by title used to produce a second, credential-less
            provider that later shadowed the configured one. */
         const provider = await tx.paymentProvider.findUnique({
            where: { code: TABAPAY_PROVIDER_CODE },
            select: { id: true, isActive: true },
         })
         if (!provider) return { kind: 'not-configured' as const }
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
         return { kind: 'created' as const, paymentId: payment.id, order, amountRial }
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
      if (reservation.kind === 'amount-invalid') {
         await releasePendingOrder(orderId)
         return NextResponse.json(
            { message: 'TABAPAY_AMOUNT_OUT_OF_RANGE' },
            { status: 400 }
         )
      }
      if (reservation.kind === 'not-configured') {
         await releasePendingOrder(orderId)
         return NextResponse.json(
            { message: 'TABAPAY_NOT_CONFIGURED' },
            { status: 503 }
         )
      }
      if (reservation.kind === 'disabled') {
         await releasePendingOrder(orderId)
         return NextResponse.json({ message: 'PAYMENT_PROVIDER_DISABLED' }, { status: 503 })
      }

      paymentId = reservation.paymentId
      gatewayRequestStarted = true
      const result = await createTabapayPayment({
         amountRial: reservation.amountRial,
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
      const definitiveCreateRejection =
         error instanceof Error && error.message.startsWith('TABAPAY_CREATE_REJECTED:')
      if (orderId && (!gatewayRequestStarted || definitiveCreateRejection)) {
         await releasePendingOrder(orderId, paymentId).catch((releaseError) => {
            console.error('[TABAPAY_RELEASE]', releaseError)
         })
      }

      return NextResponse.json(
         { message: gatewayRequestStarted && !definitiveCreateRejection
            ? 'PAYMENT_INITIALIZATION_PENDING_RECONCILIATION'
            : 'PAYMENT_INITIALIZATION_FAILED' },
         { status: gatewayRequestStarted && !definitiveCreateRejection ? 202 : 502 }
      )
   }
}
