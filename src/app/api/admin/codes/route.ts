import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

const codeSchema = z
   .string()
   .trim()
   .min(3)
   .max(40)
   .regex(/^[A-Z0-9_-]+$/)

const createSchema = z.object({
   code: z.string().trim().min(3).max(40).transform((value) => value.toUpperCase()).pipe(codeSchema),
   description: z.string().trim().max(240).optional().nullable(),
   percent: z.number().int().min(1).max(100),
   stock: z.number().int().min(0).max(1_000_000),
   maxDiscountAmount: z.number().finite().positive(),
   startDate: z.string().datetime().transform((value) => new Date(value)),
   endDate: z.string().datetime().transform((value) => new Date(value)),
}).refine((value) => value.endDate > value.startDate, {
   message: 'تاریخ پایان باید بعد از تاریخ شروع باشد',
   path: ['endDate'],
})

function authorized(req: Request) {
   // The app proxy verifies the signed JWT and admin role before this route.
   return Boolean(req.headers.get('X-USER-ID'))
}

function invalidBody() {
   return NextResponse.json({ message: 'INVALID_DISCOUNT_CODE' }, { status: 400 })
}

export async function GET(req: Request) {
   if (!authorized(req)) {
      return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })
   }

   try {
      const codes = await prisma.discountCode.findMany({
         orderBy: { createdAt: 'desc' },
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
            _count: { select: { order: true } },
         },
      })

      return NextResponse.json(codes, {
         headers: { 'Cache-Control': 'private, no-store' },
      })
   } catch (error) {
      console.error('[ADMIN_DISCOUNT_CODES_GET]', error)
      return NextResponse.json({ message: 'DISCOUNT_CODES_READ_FAILED' }, { status: 500 })
   }
}

export async function POST(req: Request) {
   if (!authorized(req)) {
      return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })
   }

   try {
      const input = createSchema.parse(await req.json())
      if (input.startDate <= new Date(0) || input.endDate <= new Date(0)) {
         return invalidBody()
      }

      const code = await prisma.discountCode.create({
         data: {
            code: input.code!,
            description: input.description ?? null,
            percent: input.percent!,
            stock: input.stock!,
            maxDiscountAmount: input.maxDiscountAmount!,
            startDate: input.startDate!,
            endDate: input.endDate!,
         },
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

      return NextResponse.json(code, { status: 201 })
   } catch (error) {
      if (error instanceof SyntaxError || error instanceof ZodError) return invalidBody()
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
         return NextResponse.json({ message: 'DISCOUNT_CODE_ALREADY_EXISTS' }, { status: 409 })
      }
      console.error('[ADMIN_DISCOUNT_CODES_POST]', error)
      return NextResponse.json({ message: 'DISCOUNT_CODE_CREATE_FAILED' }, { status: 500 })
   }
}
