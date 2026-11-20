import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

const patchSchema = z.object({
   code: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/).optional(),
   title: z.string().trim().min(2).max(80).optional(),
   description: z.string().trim().max(300).nullable().optional(),
   cost: z.number().finite().min(0).max(1_000_000_000).optional(),
   freeShippingThreshold: z.number().finite().min(0).max(1_000_000_000).nullable().optional(),
   isActive: z.boolean().optional(),
   sortOrder: z.number().int().min(0).max(10000).optional(),
}).refine((value) => Object.keys(value).length > 0)

type Context = { params: Promise<{ methodId: string }> }

export async function PATCH(req: Request, { params }: Context) {
   if (!req.headers.get('X-USER-ID')) return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })
   const { methodId } = await params
   try {
      const data = patchSchema.parse(await req.json())
      const method = await prisma.shippingMethod.update({ where: { id: methodId }, data })
      return NextResponse.json(method)
   } catch (error) {
      if (error instanceof ZodError) return NextResponse.json({ message: 'INVALID_SHIPPING_METHOD', issues: error.issues }, { status: 400 })
      console.error('[ADMIN_SHIPPING_PATCH]', error)
      return NextResponse.json({ message: 'SHIPPING_METHOD_UPDATE_FAILED' }, { status: 500 })
   }
}

export async function DELETE(req: Request, { params }: Context) {
   if (!req.headers.get('X-USER-ID')) return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })
   const { methodId } = await params
   try {
      await prisma.shippingMethod.delete({ where: { id: methodId } })
      return NextResponse.json({ deleted: true })
   } catch (error) {
      console.error('[ADMIN_SHIPPING_DELETE]', error)
      return NextResponse.json({ message: 'SHIPPING_METHOD_DELETE_FAILED' }, { status: 409 })
   }
}
