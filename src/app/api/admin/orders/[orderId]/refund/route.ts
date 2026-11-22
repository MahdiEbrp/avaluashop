import prisma from '@/lib/prisma'
import { getErrorResponse } from '@/lib/utils'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

const refundDecisionSchema = z.discriminatedUnion('action', [
   z.object({
      action: z.literal('complete'),
      manualConfirmation: z.literal(true),
      note: z.string().trim().min(3).max(500),
   }),
   z.object({
      action: z.literal('deny'),
      note: z.string().trim().min(3).max(500),
   }),
])

type RouteContext = Readonly<{ params: Promise<{ orderId: string }> }>

export async function PATCH(req: Request, { params }: RouteContext) {
   if (!req.headers.get('X-USER-ID')) {
      return getErrorResponse(401, 'UNAUTHORIZED')
   }

   const { orderId } = await params

   try {
      const decision = refundDecisionSchema.parse(await req.json())
      const existing = await prisma.order.findUnique({
         where: { id: orderId },
         select: {
            id: true,
            status: true,
            isPaid: true,
            refund: {
               select: {
                  id: true,
                  amount: true,
                  reason: true,
               },
            },
         },
      })

      if (!existing?.refund) {
         return getErrorResponse(404, 'REFUND NOT FOUND')
      }

      if (!existing.isPaid || existing.status !== 'RefundProcessing') {
         return getErrorResponse(409, 'INVALID REFUND STATE')
      }

      const nextStatus =
         decision.action === 'complete' ? 'RefundCompleted' : 'Denied'
      const auditTag = decision.action === 'complete' ? 'COMPLETED' : 'DENIED'
      const existingRefund = existing.refund

      const updatedRefund = await prisma.$transaction(async (tx) => {
         const updated = await tx.order.updateMany({
            where: {
               id: orderId,
               isPaid: true,
               status: 'RefundProcessing',
            },
            data: { status: nextStatus },
         })
         if (updated.count !== 1) {
            throw new Error('REFUND_STATE_CONFLICT')
         }

         return tx.refund.update({
            where: { id: existingRefund.id },
            data: {
               reason: `${existingRefund.reason} | [${auditTag}] ${decision.note}`,
            },
            select: {
               id: true,
               orderId: true,
               amount: true,
               reason: true,
               updatedAt: true,
            },
         })
      })

      return NextResponse.json({
         orderId,
         status: nextStatus,
         refund: updatedRefund,
      })
   } catch (error) {
      if (error instanceof ZodError) {
         return getErrorResponse(400, 'INVALID REFUND DECISION', error)
      }
      if (error instanceof Error && error.message === 'REFUND_STATE_CONFLICT') {
         return getErrorResponse(409, 'REFUND STATE CONFLICT')
      }
      console.error('[ADMIN_ORDER_REFUND_PATCH]', error)
      return getErrorResponse(500, 'Internal error')
   }
}
