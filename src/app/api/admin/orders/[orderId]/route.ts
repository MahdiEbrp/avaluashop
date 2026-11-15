import prisma from '@/lib/prisma'
import { getErrorResponse } from '@/lib/utils'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

/** The nine states in `OrderStatusEnum`, as a closed list. */
const orderStatus = z.enum([
   'Processing',
   'Shipped',
   'Delivered',
   'ReturnProcessing',
   'ReturnCompleted',
   'Cancelled',
   'RefundProcessing',
   'RefundCompleted',
   'Denied',
])

/**
 * A fulfilment update. Amounts are money: they must be finite and
 * non-negative, and `payable` can never exceed what was actually ordered.
 */
const orderPatch = z
   .object({
      status: orderStatus,
      shipping: z.coerce.number().min(0).max(1_000_000),
      discount: z.coerce.number().min(0).max(1_000_000),
      payable: z.coerce.number().min(0).max(1_000_000),
      isPaid: z.boolean(),
      isCompleted: z.boolean(),
   })
   .partial()
   .refine((value) => Object.keys(value).length > 0, {
      message: 'At least one field is required',
   })

type RouteContext = Readonly<{ params: Promise<{ orderId: string }> }>

function unauthorized() {
   return getErrorResponse(401, 'UNAUTHORIZED')
}

export async function GET(req: Request, { params }: RouteContext) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   const { orderId } = await params

   try {
      const order = await prisma.order.findUnique({
         where: { id: orderId },
         include: {
            orderItems: { include: { product: true } },
            payments: true,
            refund: true,
            user: {
               select: { id: true, name: true, email: true, phone: true },
            },
         },
      })

      if (!order) return getErrorResponse(404, 'ORDER NOT FOUND')

      return NextResponse.json(order)
   } catch (error) {
      console.error('[ADMIN_ORDER_GET]', error)
      return getErrorResponse(500, 'Internal error')
   }
}

export async function PATCH(req: Request, { params }: RouteContext) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   const { orderId } = await params

   try {
      const data = orderPatch.parse(await req.json())

      const existing = await prisma.order.findUnique({
         where: { id: orderId },
         select: { id: true },
      })

      if (!existing) return getErrorResponse(404, 'ORDER NOT FOUND')

      const order = await prisma.order.update({
         where: { id: orderId },
         data,
      })

      return NextResponse.json(order)
   } catch (error) {
      if (error instanceof ZodError) {
         return getErrorResponse(400, 'INVALID ORDER', error)
      }

      console.error('[ADMIN_ORDER_PATCH]', error)
      return getErrorResponse(500, 'Internal error')
   }
}
