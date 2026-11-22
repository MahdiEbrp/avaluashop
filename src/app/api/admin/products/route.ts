import { CATALOG_TAG } from '@/lib/catalog'
import prisma from '@/lib/prisma'
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

const productSchema = z.object({
   title: z.string().trim().min(1).max(200),
   description: z.string().max(10_000).optional().nullable(),
   images: z.array(z.url()).max(20),
   keywords: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
   price: z.number().finite().positive(),
   discount: z.number().finite().min(0),
   stock: z.number().int().min(0).max(1_000_000),
   categoryId: z.string().min(1),
   brandId: z.string().min(1),
   isFeatured: z.boolean().default(false),
   isAvailable: z.boolean().default(false),
}).refine((value) => value.discount <= value.price, {
   message: 'Discount cannot exceed price',
   path: ['discount'],
})

function unauthorized() {
   return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })
}

function invalidProduct() {
   return NextResponse.json({ message: 'INVALID_PRODUCT' }, { status: 400 })
}

export async function GET(req: Request) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   try {
      const { searchParams } = new URL(req.url)
      const categoryId = searchParams.get('categoryId')
      const featuredParam = searchParams.get('isFeatured')
      const products = await prisma.product.findMany({
         where: {
            ...(categoryId ? { categories: { some: { id: categoryId } } } : {}),
            ...(featuredParam === null ? {} : { isFeatured: featuredParam === 'true' }),
         },
         include: { categories: true, brand: true },
         orderBy: { createdAt: 'desc' },
      })

      return NextResponse.json(products, {
         headers: { 'Cache-Control': 'private, no-store' },
      })
   } catch (error) {
      console.error('[ADMIN_PRODUCTS_GET]', error)
      return NextResponse.json({ message: 'PRODUCTS_READ_FAILED' }, { status: 500 })
   }
}

export async function POST(req: Request) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   try {
      const input = productSchema.parse(await req.json())
      const [brand, category] = await Promise.all([
         prisma.brand.findUnique({ where: { id: input.brandId }, select: { id: true } }),
         prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true } }),
      ])

      if (!brand || !category) {
         return NextResponse.json({ message: 'BRAND_OR_CATEGORY_NOT_FOUND' }, { status: 400 })
      }

      const product = await prisma.product.create({
         data: {
            title: input.title,
            description: input.description ?? null,
            images: input.images,
            keywords: input.keywords ?? [],
            price: input.price,
            discount: input.discount,
            stock: input.stock,
            isFeatured: input.isFeatured,
            isAvailable: input.isAvailable && input.stock > 0,
            brand: { connect: { id: input.brandId } },
            categories: { connect: { id: input.categoryId } },
         },
         include: { categories: true, brand: true },
      })

      revalidateTag(CATALOG_TAG, { expire: 0 })
      return NextResponse.json(product, { status: 201 })
   } catch (error) {
      if (error instanceof SyntaxError || error instanceof ZodError) return invalidProduct()
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
         return NextResponse.json({ message: 'PRODUCT_CONFLICT' }, { status: 409 })
      }
      console.error('[ADMIN_PRODUCTS_POST]', error)
      return NextResponse.json({ message: 'PRODUCT_CREATE_FAILED' }, { status: 500 })
   }
}
