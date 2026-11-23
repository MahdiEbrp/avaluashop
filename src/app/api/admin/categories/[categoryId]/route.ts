import { CATALOG_TAG } from '@/lib/catalog'
import prisma from '@/lib/prisma'
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

interface RouteContext {
   params: Promise<{ categoryId: string }>
}

const categoryPatchSchema = z.object({
   title: z.string().trim().min(2).max(100).optional(),
   description: z.string().trim().max(500).nullable().optional(),
}).refine((value) => Object.values(value).some((entry) => entry !== undefined), {
   message: 'At least one field is required',
})

function unauthorized() {
   return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })
}

export async function GET(req: Request, context: RouteContext) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   try {
      const { categoryId } = await context.params
      if (!categoryId) return NextResponse.json({ message: 'CATEGORY_ID_REQUIRED' }, { status: 400 })
      const category = await prisma.category.findUnique({
         where: { id: categoryId },
         include: { _count: { select: { products: true } } },
      })
      if (!category) return NextResponse.json({ message: 'CATEGORY_NOT_FOUND' }, { status: 404 })
      return NextResponse.json(category, {
         headers: { 'Cache-Control': 'private, no-store' },
      })
   } catch (error) {
      console.error('[ADMIN_CATEGORY_GET]', error)
      return NextResponse.json({ message: 'CATEGORY_READ_FAILED' }, { status: 500 })
   }
}

export async function PATCH(req: Request, context: RouteContext) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   try {
      const { categoryId } = await context.params
      if (!categoryId) return NextResponse.json({ message: 'CATEGORY_ID_REQUIRED' }, { status: 400 })
      const input = categoryPatchSchema.parse(await req.json())
      const category = await prisma.category.update({
         where: { id: categoryId },
         data: input,
      })
      revalidateTag(CATALOG_TAG, { expire: 0 })
      return NextResponse.json(category)
   } catch (error) {
      if (error instanceof SyntaxError || error instanceof ZodError) {
         return NextResponse.json({ message: 'INVALID_CATEGORY' }, { status: 400 })
      }
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
         return NextResponse.json({ message: 'CATEGORY_NOT_FOUND' }, { status: 404 })
      }
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
         return NextResponse.json({ message: 'CATEGORY_ALREADY_EXISTS' }, { status: 409 })
      }
      console.error('[ADMIN_CATEGORY_PATCH]', error)
      return NextResponse.json({ message: 'CATEGORY_UPDATE_FAILED' }, { status: 500 })
   }
}

export async function DELETE(req: Request, context: RouteContext) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   try {
      const { categoryId } = await context.params
      if (!categoryId) return NextResponse.json({ message: 'CATEGORY_ID_REQUIRED' }, { status: 400 })
      const existing = await prisma.category.findUnique({
         where: { id: categoryId },
         select: { id: true },
      })
      if (!existing) return NextResponse.json({ message: 'CATEGORY_NOT_FOUND' }, { status: 404 })

      const products = await prisma.product.count({
         where: { categories: { some: { id: categoryId } } },
      })
      if (products > 0) {
         return NextResponse.json({ message: 'CATEGORY_HAS_PRODUCTS' }, { status: 409 })
      }

      await prisma.category.delete({ where: { id: categoryId } })
      revalidateTag(CATALOG_TAG, { expire: 0 })
      return NextResponse.json({ deleted: true })
   } catch (error) {
      console.error('[ADMIN_CATEGORY_DELETE]', error)
      return NextResponse.json({ message: 'CATEGORY_DELETE_FAILED' }, { status: 500 })
   }
}
