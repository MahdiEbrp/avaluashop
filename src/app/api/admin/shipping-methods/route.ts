import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

const methodSchema = z.object({
   code: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/),
   title: z.string().trim().min(2).max(80),
   description: z.string().trim().max(300).optional(),
   cost: z.number().finite().min(0).max(1_000_000_000),
   freeShippingThreshold: z.number().finite().min(0).max(1_000_000_000).nullable().optional(),
   isActive: z.boolean().default(true),
   sortOrder: z.number().int().min(0).max(10000).default(0),
})

export async function GET(req: Request) {
   if (!req.headers.get('X-USER-ID')) return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })
   const methods = await prisma.shippingMethod.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] })
   return NextResponse.json(methods)
}

export async function POST(req: Request) {
   if (!req.headers.get('X-USER-ID')) return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })
   try {
      const data = methodSchema.parse(await req.json())
      const method = await prisma.shippingMethod.create({ data })
      return NextResponse.json(method, { status: 201 })
   } catch (error) {
      if (error instanceof ZodError) return NextResponse.json({ message: 'INVALID_SHIPPING_METHOD', issues: error.issues }, { status: 400 })
      console.error('[ADMIN_SHIPPING_CREATE]', error)
      return NextResponse.json({ message: 'SHIPPING_METHOD_CREATE_FAILED' }, { status: 500 })
   }
}
