import { adminId } from '@/lib/require-admin'
import prisma from '@/lib/prisma'
import { canTransitionOrderStatus, ORDER_STATUSES } from '@/lib/order-status'
import { getErrorResponse } from '@/lib/utils'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

const orderPatch = z
   .object({
      status: z.enum(ORDER_STATUSES),
      shippingTrackingNumber: z
         .string()
         .trim()
         .max(100)
         .nullable()
         .transform((value) => (value === '' ? null : value)),
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
   if (!adminId(req)) return unauthorized()

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

type OrderFulfilmentPatch = z.infer<typeof orderPatch>

interface ExistingOrderState {
   status: string
   isPaid: boolean
   shippingTrackingNumber: string | null
}

function validateOrderFulfilmentPatch(
   existing: ExistingOrderState,
   data: OrderFulfilmentPatch
): NextResponse | null {
   if (data.status && data.status !== existing.status) {
      if (!canTransitionOrderStatus(existing.status, data.status)) {
         return getErrorResponse(409, 'INVALID ORDER STATUS TRANSITION')
      }

      /* Payment state is written only by the verified gateway lifecycle. */
      if (!existing.isPaid) {
         return getErrorResponse(409, 'ORDER NOT PAID')
      }
   }

   const targetStatus = data.status ?? existing.status
   const trackingNumber =
      data.shippingTrackingNumber === undefined
         ? existing.shippingTrackingNumber
         : data.shippingTrackingNumber
   if (
      (targetStatus === 'Shipped' || targetStatus === 'Delivered') &&
      !trackingNumber
   ) {
      return getErrorResponse(400, 'TRACKING NUMBER REQUIRED')
   }

   return null
}

export async function PATCH(req: Request, { params }: RouteContext) {
   if (!adminId(req)) return unauthorized()

   const { orderId } = await params

   try {
      const data = orderPatch.parse(await req.json())
      const existing = await prisma.order.findUnique({
         where: { id: orderId },
         select: {
            id: true,
            status: true,
            isPaid: true,
            shippingTrackingNumber: true,
         },
      })

      if (!existing) return getErrorResponse(404, 'ORDER NOT FOUND')

      const validationError = validateOrderFulfilmentPatch(existing, data)
      if (validationError) return validationError

      if (data.status && data.status !== existing.status) {
         /* Compare-and-set prevents two admins from advancing the same order
            from a stale page at the same time. */
         const updated = await prisma.order.updateMany({
            where: {
               id: orderId,
               status: existing.status,
               isPaid: true,
               shippingTrackingNumber: existing.shippingTrackingNumber,
            },
            data: {
               ...data,
               ...(data.status === 'Delivered' ? { isCompleted: true } : {}),
            },
         })

         if (updated.count !== 1) {
            return getErrorResponse(409, 'ORDER STATE CONFLICT')
         }

         const order = await prisma.order.findUnique({ where: { id: orderId } })
         return NextResponse.json(order)
      }

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
