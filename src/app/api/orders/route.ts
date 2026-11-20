import prisma from '@/lib/prisma'
import { calculateDiscountedSubtotal, calculateOrderTotals, quoteShipping } from '@/lib/shipping'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
   try {
      const userId = req.headers.get('X-USER-ID')
      if (!userId) return new NextResponse('Unauthorized', { status: 401 })

      const orders = await prisma.order.findMany({
         where: { userId },
         include: {
            address: true,
            payments: true,
            refund: true,
            orderItems: true,
            shippingMethod: {
               select: {
                  id: true,
                  code: true,
                  title: true,
                  description: true,
                  type: true,
                  amount: true,
                  freeAbove: true,
               },
            },
            shippingCarrier: {
               select: { id: true, code: true, title: true },
            },
         },
      })

      return NextResponse.json(orders)
   } catch (error) {
      console.error('[ORDERS_GET]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

export async function POST(req: Request) {
   try {
      const userId = req.headers.get('X-USER-ID')
      if (!userId) return new NextResponse('Unauthorized', { status: 401 })

      let body: { addressId?: unknown; discountCode?: unknown; shippingMethodId?: unknown }
      try {
         body = await req.json()
      } catch {
         return NextResponse.json({ message: 'INVALID_ORDER_REQUEST' }, { status: 400 })
      }

      const addressId = typeof body.addressId === 'string' ? body.addressId : null
      const discountCode =
         typeof body.discountCode === 'string' ? body.discountCode.trim() : ''
      const shippingMethodId =
         typeof body.shippingMethodId === 'string' ? body.shippingMethodId : null

      if (!addressId) {
         return new NextResponse('A valid shipping address is required', { status: 400 })
      }

      const address = await prisma.address.findFirst({
         where: { id: addressId, userId },
         select: { id: true, city: true },
      })
      if (!address) return new NextResponse('Shipping address not found', { status: 404 })

      const cart = await prisma.cart.findUnique({
         where: { userId },
         include: { items: { include: { product: true } } },
      })
      if (!cart?.items?.length) {
         return new NextResponse('Your cart is empty', { status: 400 })
      }

      for (const item of cart.items) {
         if (
            !Number.isInteger(item.count) ||
            item.count < 1 ||
            !item.product.isAvailable ||
            item.product.stock < item.count
         ) {
            return new NextResponse(
               'One or more products are unavailable or have insufficient stock',
               { status: 409 }
            )
         }
      }

      const now = new Date()

      // Inventory, coupon usage, shipping quote and order totals are committed atomically.
      const order = await prisma.$transaction(async (tx) => {
         let coupon: { id: string; percent: number; maxDiscountAmount: number } | null = null

         if (discountCode) {
            coupon = await tx.discountCode.findFirst({
               where: {
                  code: discountCode,
                  stock: { gte: 1 },
                  startDate: { lte: now },
                  endDate: { gte: now },
               },
               select: { id: true, percent: true, maxDiscountAmount: true },
            })

            if (!coupon) throw new Error('INVALID_DISCOUNT_CODE')

            const reservedCoupon = await tx.discountCode.updateMany({
               where: {
                  id: coupon.id,
                  stock: { gte: 1 },
                  startDate: { lte: now },
                  endDate: { gte: now },
               },
               data: { stock: { decrement: 1 } },
            })
            if (reservedCoupon.count !== 1) throw new Error('INVALID_DISCOUNT_CODE')
         }

         for (const item of cart.items) {
            const updated = await tx.product.updateMany({
               where: {
                  id: item.productId,
                  isAvailable: true,
                  stock: { gte: item.count },
               },
               data: { stock: { decrement: item.count } },
            })
            if (updated.count !== 1) throw new Error('INSUFFICIENT_STOCK')
         }

         const activeMethodCount = await tx.shippingMethod.count({
            where: { isActive: true },
         })

         let shippingMethod: {
            id: string
            title: string
            type: 'FlatRate' | 'Free' | 'FreeAbove' | 'CarrierCalculated'
            amount: number
            freeAbove: number | null
            allowedCities: string[]
            carrierId: string | null
            carrier: { title: string } | null
         } | null = null
         let shippingAmount = 0

         if (activeMethodCount > 0 && !shippingMethodId) {
            throw new Error('SHIPPING_METHOD_REQUIRED')
         }

         if (shippingMethodId) {
            shippingMethod = await tx.shippingMethod.findFirst({
               where: { id: shippingMethodId, isActive: true },
               include: { carrier: { select: { title: true } } },
            })
            if (!shippingMethod) throw new Error('SHIPPING_METHOD_UNAVAILABLE')

            const discountedSubtotal = calculateDiscountedSubtotal(cart.items, coupon)
            const quote = quoteShipping(
               shippingMethod,
               address.city,
               discountedSubtotal.subtotalAfterDiscount
            )
            if (!quote.available) throw new Error('SHIPPING_METHOD_UNAVAILABLE')
            shippingAmount = quote.amount
         }

         const store = await tx.storeSetting.findUnique({
            where: { id: 'default' },
            select: { taxEnabled: true, taxRate: true },
         })
         const taxEnabled = store?.taxEnabled ?? true
         const taxRate = store?.taxRate ?? 0.09

         const costs = calculateOrderTotals(
            cart.items,
            coupon,
            { enabled: taxEnabled, rate: taxRate },
            shippingAmount
         )

         return tx.order.create({
            data: {
               userId,
               status: 'PendingPayment',
               total: costs.total,
               tax: costs.tax,
               taxRateSnapshot: costs.taxRateSnapshot,
               payable: costs.payable,
               discount: costs.discount,
               shipping: costs.shipping,
               shippingMethodId: shippingMethod?.id,
               shippingMethodName: shippingMethod?.title,
               shippingCarrierId: shippingMethod?.carrierId,
               shippingCarrierName: shippingMethod?.carrier?.title,
               discountCodeId: coupon?.id,
               addressId,
               orderItems: {
                  create: cart.items.map((item) => ({
                     count: item.count,
                     price: item.product.price,
                     discount: item.product.discount,
                     productId: item.productId,
                  })),
               },
            },
         })
      })

      // Keep the cart until payment is verified by Tabapay.
      return NextResponse.json(order, { status: 201 })
   } catch (error) {
      if (error instanceof Error && error.message === 'INSUFFICIENT_STOCK') {
         return new NextResponse(
            'One or more products no longer have enough stock',
            { status: 409 }
         )
      }
      if (error instanceof Error && error.message === 'INVALID_DISCOUNT_CODE') {
         return new NextResponse('Discount code is invalid or expired', { status: 400 })
      }
      if (error instanceof Error && error.message === 'SHIPPING_METHOD_REQUIRED') {
         return NextResponse.json({ message: 'SHIPPING_METHOD_REQUIRED' }, { status: 400 })
      }
      if (error instanceof Error && error.message === 'SHIPPING_METHOD_UNAVAILABLE') {
         return NextResponse.json({ message: 'SHIPPING_METHOD_UNAVAILABLE' }, { status: 409 })
      }
      console.error('[ORDERS_POST]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}
