import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

const ELIGIBLE_REFUND_STATUSES = new Set([
   'Processing',
   'Shipped',
   'Delivered',
])

const refundRequestSchema = z.object({
   reason: z.string().trim().min(5).max(500),
   amount: z.number().positive().max(1_000_000).optional(),
})

type RouteContext = Readonly<{ params: Promise<{ orderId: string }> }>

function isUniqueConstraintError(error: unknown): boolean {
   return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
   )
}

export async function POST(req: Request, { params }: RouteContext) {
   const userId = req.headers.get('X-USER-ID')
   if (!userId) {
      return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })
   }

   const { orderId } = await params
   if (!orderId) {
      return NextResponse.json({ message: 'ORDER_ID_REQUIRED' }, { status: 400 })
   }

   try {
      const data = refundRequestSchema.parse(await req.json())
      const order = await prisma.order.findFirst({
         where: { id: orderId, userId },
         select: {
            id: true,
            status: true,
            isPaid: true,
            payable: true,
            refund: {
               select: {
                  id: true,
               },
            },
         },
      })

      if (!order) {
         return NextResponse.json({ message: 'ORDER_NOT_FOUND' }, { status: 404 })
      }

      if (
         order.refund ||
         order.status === 'RefundProcessing' ||
         order.status === 'RefundCompleted'
      ) {
         return NextResponse.json(
            { message: 'REFUND_ALREADY_REQUESTED' },
            { status: 409 }
         )
      }

      if (!order.isPaid || !ELIGIBLE_REFUND_STATUSES.has(order.status)) {
         return NextResponse.json(
            { message: 'ORDER_NOT_ELIGIBLE_FOR_REFUND' },
            { status: 409 }
         )
      }

      const amount = data.amount ?? order.payable
      if (amount > order.payable) {
         return NextResponse.json(
            { message: 'REFUND_AMOUNT_EXCEEDS_PAYABLE' },
            { status: 400 }
         )
      }

      const refund = await prisma.$transaction(async (tx) => {
         const updated = await tx.order.updateMany({
            where: {
               id: orderId,
               userId,
               isPaid: true,
               status: order.status,
            },
            data: { status: 'RefundProcessing' },
         })
         if (updated.count !== 1) {
            throw new Error('ORDER_STATE_CONFLICT')
         }

         return tx.refund.create({
            data: {
               orderId,
               amount,
               reason: data.reason,
            },
            select: {
               id: true,
               orderId: true,
               amount: true,
               reason: true,
               createdAt: true,
            },
         })
      })

      return NextResponse.json(
         { refund, status: 'RefundProcessing' },
         { status: 201, headers: { 'Cache-Control': 'private, no-store' } }
      )
   } catch (error) {
      if (error instanceof ZodError) {
         return NextResponse.json(
            { message: 'INVALID_REFUND_REQUEST' },
            { status: 400 }
         )
      }
      if (
         (error instanceof Error && error.message === 'ORDER_STATE_CONFLICT') ||
         isUniqueConstraintError(error)
      ) {
         return NextResponse.json(
            { message: 'REFUND_ALREADY_REQUESTED' },
            { status: 409 }
         )
      }
      console.error('[ORDER_REFUND_POST]', error)
      return NextResponse.json({ message: 'INTERNAL_ERROR' }, { status: 500 })
   }
}
