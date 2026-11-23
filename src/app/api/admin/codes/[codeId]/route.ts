import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

interface RouteContext {
   params: Promise<{ codeId: string }>
}

const patchSchema = z
   .object({
      description: z.string().trim().max(240).nullable().optional(),
      percent: z.number().int().min(1).max(100).optional(),
      stock: z.number().int().min(0).max(1_000_000).optional(),
      maxDiscountAmount: z.number().positive().optional(),
      startDate: z.iso
         .datetime()
         .transform((value) => new Date(value))
         .optional(),
      endDate: z.iso
         .datetime()
         .transform((value) => new Date(value))
         .optional(),
   })
   .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
      message: 'حداقل یک فیلد برای ویرایش لازم است',
   })

function authorized(req: Request) {
   return Boolean(req.headers.get('X-USER-ID'))
}

export async function PATCH(req: Request, context: RouteContext) {
   if (!authorized(req)) {
      return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })
   }

   try {
      const { codeId } = await context.params
      const input = patchSchema.parse(await req.json())
      const current = await prisma.discountCode.findUnique({
         where: { id: codeId },
         select: { id: true, startDate: true, endDate: true },
      })

      if (!current) {
         return NextResponse.json(
            { message: 'DISCOUNT_CODE_NOT_FOUND' },
            { status: 404 }
         )
      }

      const startDate = input.startDate ?? current.startDate
      const endDate = input.endDate ?? current.endDate
      if (endDate <= startDate) {
         return NextResponse.json(
            { message: 'INVALID_DISCOUNT_DATE_RANGE' },
            { status: 400 }
         )
      }

      const updated = await prisma.discountCode.update({
         where: { id: codeId },
         data: input,
         select: {
            id: true,
            code: true,
            description: true,
            percent: true,
            stock: true,
            maxDiscountAmount: true,
            startDate: true,
            endDate: true,
            createdAt: true,
         },
      })

      return NextResponse.json(updated)
   } catch (error) {
      if (error instanceof SyntaxError || error instanceof ZodError) {
         return NextResponse.json(
            { message: 'INVALID_DISCOUNT_CODE' },
            { status: 400 }
         )
      }
      console.error('[ADMIN_DISCOUNT_CODE_PATCH]', error)
      return NextResponse.json(
         { message: 'DISCOUNT_CODE_UPDATE_FAILED' },
         { status: 500 }
      )
   }
}

export async function DELETE(req: Request, context: RouteContext) {
   if (!authorized(req)) {
      return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })
   }

   try {
      const { codeId } = await context.params
      const deleted = await prisma.$transaction(async (tx) => {
         const existing = await tx.discountCode.findUnique({
            where: { id: codeId },
            select: { id: true },
         })

         if (!existing) return 'missing' as const

         const usedByOrders = await tx.order.count({
            where: { discountCodeId: codeId },
         })

         if (usedByOrders > 0) return 'in-use' as const

         await tx.discountCode.delete({ where: { id: codeId } })
         return 'deleted' as const
      })

      if (deleted === 'missing') {
         return NextResponse.json(
            { message: 'DISCOUNT_CODE_NOT_FOUND' },
            { status: 404 }
         )
      }
      if (deleted === 'in-use') {
         return NextResponse.json(
            { message: 'DISCOUNT_CODE_IN_USE' },
            { status: 409 }
         )
      }

      return NextResponse.json({ deleted: true })
   } catch (error) {
      console.error('[ADMIN_DISCOUNT_CODE_DELETE]', error)
      return NextResponse.json(
         { message: 'DISCOUNT_CODE_DELETE_FAILED' },
         { status: 500 }
      )
   }
}
