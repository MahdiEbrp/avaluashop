import prisma from '@/lib/prisma'
import { releasePendingOrder } from '@/lib/payments/order-lifecycle'
import { createTabapayPayment } from '@/lib/payments/tabapay'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
   let paymentId: string | undefined
   let orderId: string | undefined

   try {
      const userId = req.headers.get('X-USER-ID')
      if (!userId) return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })

      const body = await req.json()
      orderId = typeof body.orderId === 'string' ? body.orderId : undefined
      if (!orderId) {
         return NextResponse.json({ message: 'ORDER_ID_REQUIRED' }, { status: 400 })
      }

      const order = await prisma.order.findFirst({
         where: { id: orderId, userId },
         include: { address: true },
      })
      if (!order) {
         return NextResponse.json({ message: 'ORDER_NOT_FOUND' }, { status: 404 })
      }
      if (order.isPaid || order.status !== 'PendingPayment') {
         return NextResponse.json({ message: 'ORDER_NOT_PAYABLE' }, { status: 409 })
      }

      const existingPayment = await prisma.payment.findFirst({
         where: { orderId: order.id, status: 'Processing' },
         select: { id: true, refId: true, paymentUrl: true },
      })
      if (existingPayment) {
         if (existingPayment.paymentUrl && !existingPayment.refId.startsWith('pending:')) {
            return NextResponse.json({ paymentUrl: existingPayment.paymentUrl })
         }
         return NextResponse.json({ message: 'PAYMENT_ALREADY_INITIALIZED' }, { status: 409 })
      }

      const provider = await prisma.paymentProvider.upsert({
         where: { title: 'Tabapay' },
         create: {
            title: 'Tabapay',
            description: 'Tabapay Iranian payment gateway',
            websiteUrl: 'https://tabapay.ir',
            isActive: true,
         },
         update: { isActive: true },
      })

      const placeholder = `pending:${crypto.randomUUID()}`
      const payment = await prisma.payment.create({
         data: {
            status: 'Processing',
            refId: placeholder,
            payable: order.payable,
            providerId: provider.id,
            userId,
            orderId: order.id,
         },
      })
      paymentId = payment.id

      // Product prices and order totals are stored/displayed in Toman;
      // Tabapay API expects the amount in Rial.
      const amountRial = Math.round(order.payable * 10)
      const result = await createTabapayPayment({
         amountRial,
         orderNumber: order.number,
         mobile: order.address?.phone,
      })

      await prisma.payment.update({
         where: { id: payment.id },
         data: { refId: result.token, paymentUrl: result.paymentUrl },
      })

      return NextResponse.json({ paymentUrl: result.paymentUrl })
   } catch (error) {
      console.error('[TABAPAY_CREATE]', error)
      if (orderId) {
         await releasePendingOrder(orderId, paymentId).catch((releaseError) => {
            console.error('[TABAPAY_RELEASE]', releaseError)
         })
      }
      const message =
         error instanceof Error && error.message === 'TABAPAY_AMOUNT_OUT_OF_RANGE'
            ? 'PAYMENT_AMOUNT_OUT_OF_RANGE'
            : 'PAYMENT_INITIALIZATION_FAILED'
      return NextResponse.json({ message }, { status: 502 })
   }
}
