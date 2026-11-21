import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(
   req: Request,
   { params }: { params: Promise<{ orderId: string }> }
) {
   const { orderId } = await params

   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

      if (!orderId) {
         return new NextResponse('orderId is required', { status: 400 })
      }

      /* Return only the fields used by the customer's tracking page.
         In particular, never serialize User (OTP) or PaymentProvider
         (encrypted credentials/settings) relations to the storefront. */
      const order = await prisma.order.findFirst({
         where: { userId, id: orderId },
         select: {
            id: true,
            status: true,
            shippingTrackingNumber: true,
            shippingCarrierName: true,
            shippingMethodName: true,
         },
      })

      if (!order) {
         return new NextResponse('Order not found', { status: 404 })
      }

      return NextResponse.json(order, {
         headers: { 'Cache-Control': 'private, no-store' },
      })
   } catch (error) {
      console.error('[ORDER_GET]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}
