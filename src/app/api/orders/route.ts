import prisma from '@/lib/prisma'
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

      const body = await req.json()
      const addressId = typeof body.addressId === 'string' ? body.addressId : null
      const discountCode =
         typeof body.discountCode === 'string' ? body.discountCode.trim() : ''

      if (!addressId) {
         return new NextResponse('A valid shipping address is required', { status: 400 })
      }

      const address = await prisma.address.findFirst({
         where: { id: addressId, userId },
         select: { id: true },
      })
      if (!address) return new NextResponse('Shipping address not found', { status: 404 })

      if (discountCode) {
         const validCode = await prisma.discountCode.findFirst({
            where: {
               code: discountCode,
               stock: { gte: 1 },
               startDate: { lte: new Date() },
               endDate: { gte: new Date() },
            },
            select: { id: true },
         })
         if (!validCode) {
            return new NextResponse('Discount code is invalid or expired', { status: 400 })
         }
      }

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

      const { total, tax, discount, payable } = calculateCosts(cart)

      // Inventory is reserved atomically while payment is pending. It is
      // restored by the payment lifecycle if Tabapay rejects or fails.
      const order = await prisma.$transaction(async (tx) => {
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

         return tx.order.create({
            data: {
               userId,
               status: 'PendingPayment',
               total,
               tax,
               payable,
               discount,
               shipping: 0,
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
      console.error('[ORDERS_POST]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

function calculateCosts(cart: {
   items: Array<{
      count: number
      product: { price: number; discount: number }
   }>
}) {
   let total = 0
   let discount = 0

   for (const item of cart.items) {
      total += item.count * item.product.price
      discount += item.count * item.product.discount
   }

   const afterDiscount = Math.max(0, total - discount)
   const tax = afterDiscount * 0.09
   const payable = afterDiscount + tax

   return {
      total: Number(total.toFixed(2)),
      discount: Number(discount.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      payable: Number(payable.toFixed(2)),
   }
}
