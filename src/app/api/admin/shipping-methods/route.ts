import { adminId } from '@/lib/require-admin'
import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

/* Lowercase letters and digits, single hyphens between them, no leading or
   trailing hyphen. Written without nested quantifiers. */
function isValidMethodCode(code: string) {
   return !code.startsWith('-') && !code.endsWith('-') && !code.includes('--')
}

const methodSchema = z.object({
   code: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/).refine(isValidMethodCode, 'کد روش ارسال نامعتبر است'),
   title: z.string().trim().min(2).max(100),
   description: z.string().trim().max(500).optional().nullable(),
   type: z.enum(['FlatRate', 'Free', 'FreeAbove']),
   amount: z.number().min(0).max(100_000_000),
   freeAbove: z.number().min(0).max(1_000_000_000).nullable().optional(),
   isActive: z.boolean().default(true),
   sortOrder: z.number().int().min(0).max(10_000).default(0),
   allowedCities: z.array(z.string().trim().min(1).max(80)).max(200).default([]),
}).superRefine((value, ctx) => {
   if (value.type === 'FreeAbove' && value.freeAbove == null) {
      ctx.addIssue({ code: 'custom', path: ['freeAbove'], message: 'FREE_THRESHOLD_REQUIRED' })
   }
})

function isAdmin(req: Request) {
   return Boolean(adminId(req))
}

export async function GET(req: Request) {
   if (!isAdmin(req)) return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })

   try {
      const methods = await prisma.shippingMethod.findMany({
         orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
         include: {
            carrier: { select: { id: true, code: true, title: true, isActive: true } },
            _count: { select: { orders: true } },
         },
      })
      return NextResponse.json(methods, { headers: { 'Cache-Control': 'no-store' } })
   } catch (error) {
      console.error('[ADMIN_SHIPPING_METHODS_GET]', error)
      return NextResponse.json({ message: 'SHIPPING_METHODS_READ_FAILED' }, { status: 500 })
   }
}

export async function POST(req: Request) {
   if (!isAdmin(req)) return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })

   try {
      const input = methodSchema.parse(await req.json())
      if (input.type !== 'FreeAbove' && input.freeAbove != null) {
         return NextResponse.json({ message: 'FREE_THRESHOLD_NOT_APPLICABLE' }, { status: 400 })
      }

      const method = await prisma.shippingMethod.create({
         data: {
            ...input,
            amount: input.type === 'Free' ? 0 : input.amount,
            description: input.description || null,
            freeAbove: input.type === 'FreeAbove' ? input.freeAbove : null,
            allowedCities: [...new Set(input.allowedCities.map((city) => city.trim()).filter(Boolean))],
         },
      })
      return NextResponse.json(method, { status: 201 })
   } catch (error) {
      if (error instanceof SyntaxError || error instanceof ZodError) {
         return NextResponse.json({ message: 'INVALID_SHIPPING_METHOD' }, { status: 400 })
      }
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
         return NextResponse.json({ message: 'SHIPPING_METHOD_CODE_EXISTS' }, { status: 409 })
      }
      console.error('[ADMIN_SHIPPING_METHODS_POST]', error)
      return NextResponse.json({ message: 'SHIPPING_METHOD_SAVE_FAILED' }, { status: 500 })
   }
}
