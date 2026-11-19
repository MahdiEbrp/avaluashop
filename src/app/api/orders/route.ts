import config from '@/config/site'
import Mail from '@/emails/order_notification_owner'
import prisma from '@/lib/prisma'
import { sendMail } from '@persepolis/mail'
import { render } from '@react-email/render'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

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

      if (!userId) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

      const body = await req.json()
      const addressId =
         typeof body.addressId === 'string' ? body.addressId : null
      const discountCode =
         typeof body.discountCode === 'string' ? body.discountCode.trim() : ''

      if (!addressId) {
         return new NextResponse('A valid shipping address is required', {
            status: 400,
         })
      }

      // Never allow an order to be attached to another customer's address.
      const address = await prisma.address.findFirst({
         where: { id: addressId, userId },
         select: { id: true },
      })

      if (!address) {
         return new NextResponse('Shipping address not found', { status: 404 })
      }

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
            return new NextResponse('Discount code is invalid or expired', {
               status: 400,
            })
         }
      }

      const cart = await prisma.cart.findUnique({
         where: { userId },
         include: {
            items: {
               include: { product: true },
            },
         },
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

      const { total, tax, discount, payable } = calculateCosts({ cart })

      // Reserve stock and create the order atomically. A concurrent checkout
      // cannot make the stock count negative or create an order for stale stock.
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

            if (updated.count !== 1) {
               throw new Error('INSUFFICIENT_STOCK')
            }
         }

         return tx.order.create({
            data: {
               userId,
               status: 'Processing',
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

      const owners = await prisma.owner.findMany()

      await prisma.notification.createMany({
         data: owners.map((owner) => ({
            userId: owner.id,
            content: `Order #${order.number} was created with a value of $${payable}.`,
         })),
      })

      // The order and its notifications are already committed. A mail
      // transport failure must not turn a successful order into a 500.
      for (const owner of owners) {
         await sendMail({
            name: config.name,
            to: owner.email,
            subject: 'An order was created.',
            html: await render(
               Mail({
                  id: order.id,
                  payable: payable.toFixed(2),
                  orderNum: order.number.toString(),
               })
            ),
         }).catch((error) => {
            console.error('[ORDER_MAIL]', error)
         })
      }

      return NextResponse.json(order)
   } catch (error) {
      if (error instanceof Error && error.message === 'INSUFFICIENT_STOCK') {
         return new NextResponse(
            'One or more products no longer have enough stock',
            { status: 409 }
         )
      }
      console.error('[ORDER_POST]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

function calculateCosts({ cart }) {
   let total = 0
   let discount = 0

   for (const item of cart.items) {
      total += item.count * item.product.price
      discount += item.count * item.product.discount
   }

   const afterDiscount = total - discount
   const tax = afterDiscount * 0.09
   const payable = afterDiscount + tax

   return {
      total: Number.parseFloat(total.toFixed(2)),
      discount: Number.parseFloat(discount.toFixed(2)),
      tax: Number.parseFloat(tax.toFixed(2)),
      payable: Number.parseFloat(payable.toFixed(2)),
   }
}
