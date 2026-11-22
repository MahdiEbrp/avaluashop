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

      // Explicit customer-safe selection: never serialize User, Payment or
      // PaymentProvider relations into a storefront response.
      const order = await prisma.order.findFirst({
         where: { userId, id: orderId },
         select: {
            id: true,
            number: true,
            status: true,
            isPaid: true,
            payable: true,
            shipping: true,
            createdAt: true,
            shippingTrackingNumber: true,
            shippingCarrierName: true,
            shippingMethodName: true,
            orderItems: {
               select: {
                  count: true,
                  price: true,
                  discount: true,
                  product: { select: { title: true } },
               },
            },
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
