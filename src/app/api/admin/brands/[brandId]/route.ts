import { CATALOG_TAG } from '@/lib/catalog'
import prisma from '@/lib/prisma'
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

interface RouteContext {
   params: Promise<{ brandId: string }>
}

const brandPatchSchema = z.object({
   title: z.string().trim().min(2).max(100).optional(),
   description: z.string().trim().max(500).nullable().optional(),
   logo: z.string().trim().max(2048).nullable().optional(),
}).refine((value) => Object.values(value).some((entry) => entry !== undefined), {
   message: 'At least one field is required',
})

function unauthorized() {
   return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })
}

export async function GET(req: Request, context: RouteContext) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   try {
      const { brandId } = await context.params
      if (!brandId) return NextResponse.json({ message: 'BRAND_ID_REQUIRED' }, { status: 400 })
      const brand = await prisma.brand.findUnique({
         where: { id: brandId },
         include: { _count: { select: { products: true } } },
      })
      if (!brand) return NextResponse.json({ message: 'BRAND_NOT_FOUND' }, { status: 404 })
      return NextResponse.json(brand, {
         headers: { 'Cache-Control': 'private, no-store' },
      })
   } catch (error) {
      console.error('[ADMIN_BRAND_GET]', error)
      return NextResponse.json({ message: 'BRAND_READ_FAILED' }, { status: 500 })
   }
}

export async function PATCH(req: Request, context: RouteContext) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   try {
      const { brandId } = await context.params
      if (!brandId) return NextResponse.json({ message: 'BRAND_ID_REQUIRED' }, { status: 400 })
      const input = brandPatchSchema.parse(await req.json())
      const brand = await prisma.brand.update({
         where: { id: brandId },
         data: input,
      })
      revalidateTag(CATALOG_TAG, { expire: 0 })
      return NextResponse.json(brand)
   } catch (error) {
      if (error instanceof SyntaxError || error instanceof ZodError) {
         return NextResponse.json({ message: 'INVALID_BRAND' }, { status: 400 })
      }
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
         return NextResponse.json({ message: 'BRAND_NOT_FOUND' }, { status: 404 })
      }
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
         return NextResponse.json({ message: 'BRAND_ALREADY_EXISTS' }, { status: 409 })
      }
      console.error('[ADMIN_BRAND_PATCH]', error)
      return NextResponse.json({ message: 'BRAND_UPDATE_FAILED' }, { status: 500 })
   }
}

export async function DELETE(req: Request, context: RouteContext) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   try {
      const { brandId } = await context.params
      if (!brandId) return NextResponse.json({ message: 'BRAND_ID_REQUIRED' }, { status: 400 })
      const existing = await prisma.brand.findUnique({
         where: { id: brandId },
         select: { id: true },
      })
      if (!existing) return NextResponse.json({ message: 'BRAND_NOT_FOUND' }, { status: 404 })

      const products = await prisma.product.count({ where: { brandId } })
      if (products > 0) {
         return NextResponse.json({ message: 'BRAND_HAS_PRODUCTS' }, { status: 409 })
      }

      await prisma.brand.delete({ where: { id: brandId } })
      revalidateTag(CATALOG_TAG, { expire: 0 })
      return NextResponse.json({ deleted: true })
   } catch (error) {
      console.error('[ADMIN_BRAND_DELETE]', error)
      return NextResponse.json({ message: 'BRAND_DELETE_FAILED' }, { status: 500 })
   }
}
