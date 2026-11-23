import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

const patchSchema = z.object({
   code: z.string().trim().min(2).max(40).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
   title: z.string().trim().min(2).max(100).optional(),
   description: z.string().trim().max(500).nullable().optional(),
   type: z.enum(['FlatRate', 'Free', 'FreeAbove']).optional(),
   amount: z.number().finite().min(0).max(100_000_000).optional(),
   freeAbove: z.number().finite().min(0).max(1_000_000_000).nullable().optional(),
   isActive: z.boolean().optional(),
   sortOrder: z.number().int().min(0).max(10_000).optional(),
   allowedCities: z.array(z.string().trim().min(1).max(80)).max(200).optional(),
}).refine((value) => Object.keys(value).length > 0, {
   message: 'EMPTY_PATCH',
})

interface Context { params: Promise<{ methodId: string }> }

function isAdmin(req: Request) {
   return Boolean(req.headers.get('X-USER-ID'))
}

export async function PATCH(req: Request, { params }: Context) {
   if (!isAdmin(req)) return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })
   const { methodId } = await params

   try {
      const input = patchSchema.parse(await req.json())
      const current = await prisma.shippingMethod.findUnique({ where: { id: methodId } })
      if (!current) return NextResponse.json({ message: 'SHIPPING_METHOD_NOT_FOUND' }, { status: 404 })

      const nextType = input.type ?? current.type
      const nextThreshold = input.freeAbove === undefined ? current.freeAbove : input.freeAbove
      if (nextType === 'FreeAbove' && nextThreshold == null) {
         return NextResponse.json({ message: 'FREE_THRESHOLD_REQUIRED' }, { status: 400 })
      }
      if (nextType !== 'FreeAbove' && input.freeAbove != null) {
         return NextResponse.json({ message: 'FREE_THRESHOLD_NOT_APPLICABLE' }, { status: 400 })
      }

      const method = await prisma.shippingMethod.update({
         where: { id: methodId },
         data: {
            ...input,
            ...(input.type === 'Free' ? { amount: 0 } : {}),
            ...(input.type && input.type !== 'FreeAbove' ? { freeAbove: null } : {}),
            ...(input.allowedCities
               ? { allowedCities: [...new Set(input.allowedCities.map((city) => city.trim()).filter(Boolean))] }
               : {}),
         },
      })
      return NextResponse.json(method)
   } catch (error) {
      if (error instanceof SyntaxError || error instanceof ZodError) {
         return NextResponse.json({ message: 'INVALID_SHIPPING_METHOD' }, { status: 400 })
      }
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
         return NextResponse.json({ message: 'SHIPPING_METHOD_CODE_EXISTS' }, { status: 409 })
      }
      console.error('[ADMIN_SHIPPING_METHOD_PATCH]', error)
      return NextResponse.json({ message: 'SHIPPING_METHOD_SAVE_FAILED' }, { status: 500 })
   }
}

export async function DELETE(req: Request, { params }: Context) {
   if (!isAdmin(req)) return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })
   const { methodId } = await params

   try {
      const existing = await prisma.shippingMethod.findUnique({ where: { id: methodId } })
      if (!existing) return NextResponse.json({ message: 'SHIPPING_METHOD_NOT_FOUND' }, { status: 404 })

      // Keep historical order relations intact; deletion is a soft disable.
      const method = await prisma.shippingMethod.update({
         where: { id: methodId },
         data: { isActive: false },
      })
      return NextResponse.json({ deleted: true, method })
   } catch (error) {
      console.error('[ADMIN_SHIPPING_METHOD_DELETE]', error)
      return NextResponse.json({ message: 'SHIPPING_METHOD_DELETE_FAILED' }, { status: 500 })
   }
}
