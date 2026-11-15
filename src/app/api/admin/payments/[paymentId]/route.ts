import prisma from '@/lib/prisma'
import { getErrorResponse } from '@/lib/utils'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

const paymentStatus = z.enum(['Processing', 'Paid', 'Failed', 'Denied'])

/**
 * Only the settlement fields are writable. `refId`, `cardHash` and `number`
 * are evidence of what the gateway reported — an operator correcting a failed
 * capture must not be able to rewrite the receipt itself.
 */
const paymentPatch = z
   .object({
      status: paymentStatus,
      isSuccessful: z.boolean(),
      payable: z.coerce.number().min(0).max(1_000_000),
      fee: z.coerce.number().min(0).max(1_000_000),
   })
   .partial()
   .refine((value) => Object.keys(value).length > 0, {
      message: 'At least one field is required',
   })

type RouteContext = Readonly<{ params: Promise<{ paymentId: string }> }>

function unauthorized() {
   return getErrorResponse(401, 'UNAUTHORIZED')
}

export async function GET(req: Request, { params }: RouteContext) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   const { paymentId } = await params

   try {
      const payment = await prisma.payment.findUnique({
         where: { id: paymentId },
         include: {
            provider: true,
            order: { select: { id: true, number: true, status: true } },
            user: { select: { id: true, name: true, email: true } },
         },
      })

      if (!payment) return getErrorResponse(404, 'PAYMENT NOT FOUND')

      return NextResponse.json(payment)
   } catch (error) {
      console.error('[ADMIN_PAYMENT_GET]', error)
      return getErrorResponse(500, 'Internal error')
   }
}

export async function PATCH(req: Request, { params }: RouteContext) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   const { paymentId } = await params

   try {
      const data = paymentPatch.parse(await req.json())

      const existing = await prisma.payment.findUnique({
         where: { id: paymentId },
         select: { id: true },
      })

      if (!existing) return getErrorResponse(404, 'PAYMENT NOT FOUND')

      const payment = await prisma.payment.update({
         where: { id: paymentId },
         data,
      })

      return NextResponse.json(payment)
   } catch (error) {
      if (error instanceof ZodError) {
         return getErrorResponse(400, 'INVALID PAYMENT', error)
      }

      console.error('[ADMIN_PAYMENT_PATCH]', error)
      return getErrorResponse(500, 'Internal error')
   }
}
