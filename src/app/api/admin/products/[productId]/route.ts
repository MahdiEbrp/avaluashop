import { CATALOG_TAG } from '@/lib/catalog'
import prisma from '@/lib/prisma'
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

type RouteContext = { params: Promise<{ productId: string }> }

const productPatchSchema = z.object({
   title: z.string().trim().min(1).max(200).optional(),
   description: z.string().max(10_000).nullable().optional(),
   images: z.array(z.string().min(1).max(2048)).max(20).optional(),
   keywords: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
   price: z.number().finite().positive().optional(),
   discount: z.number().finite().min(0).optional(),
   stock: z.number().int().min(0).max(1_000_000).optional(),
   categoryId: z.string().min(1).optional(),
   brandId: z.string().min(1).optional(),
   isFeatured: z.boolean().optional(),
   isAvailable: z.boolean().optional(),
}).refine((value) => Object.values(value).some((entry) => entry !== undefined), {
   message: 'At least one field is required',
})

function unauthorized() {
   return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })
}

export async function GET(req: Request, context: RouteContext) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   try {
      const { productId } = await context.params
      const product = await prisma.product.findUnique({
         where: { id: productId },
         include: { categories: true, brand: true },
      })
      if (!product) return NextResponse.json({ message: 'PRODUCT_NOT_FOUND' }, { status: 404 })

      return NextResponse.json(product, {
         headers: { 'Cache-Control': 'private, no-store' },
      })
   } catch (error) {
      console.error('[ADMIN_PRODUCT_GET]', error)
      return NextResponse.json({ message: 'PRODUCT_READ_FAILED' }, { status: 500 })
   }
}

export async function PATCH(req: Request, context: RouteContext) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   try {
      const { productId } = await context.params
      const input = productPatchSchema.parse(await req.json())
      const existing = await prisma.product.findUnique({
         where: { id: productId },
         select: { id: true, price: true, discount: true, stock: true },
      })
      if (!existing) return NextResponse.json({ message: 'PRODUCT_NOT_FOUND' }, { status: 404 })

      const price = input.price ?? existing.price
      const discount = input.discount ?? existing.discount
      const stock = input.stock ?? existing.stock
      if (discount > price) {
         return NextResponse.json({ message: 'DISCOUNT_EXCEEDS_PRICE' }, { status: 400 })
      }

      if (input.brandId) {
         const brand = await prisma.brand.findUnique({
            where: { id: input.brandId },
            select: { id: true },
         })
         if (!brand) return NextResponse.json({ message: 'BRAND_NOT_FOUND' }, { status: 400 })
      }
      if (input.categoryId) {
         const category = await prisma.category.findUnique({
            where: { id: input.categoryId },
            select: { id: true },
         })
         if (!category) return NextResponse.json({ message: 'CATEGORY_NOT_FOUND' }, { status: 400 })
      }

      const {
         categoryId,
         brandId,
         ...fields
      } = input
      const product = await prisma.product.update({
         where: { id: productId },
         data: {
            ...fields,
            ...(brandId ? { brand: { connect: { id: brandId } } } : {}),
            ...(categoryId ? { categories: { set: [{ id: categoryId }] } } : {}),
            ...(input.stock !== undefined && stock === 0 ? { isAvailable: false } : {}),
         },
         include: { categories: true, brand: true },
      })

      revalidateTag(CATALOG_TAG, { expire: 0 })
      return NextResponse.json(product)
   } catch (error) {
      if (error instanceof SyntaxError || error instanceof ZodError) {
         return NextResponse.json({ message: 'INVALID_PRODUCT' }, { status: 400 })
      }
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
         return NextResponse.json({ message: 'PRODUCT_NOT_FOUND' }, { status: 404 })
      }
      console.error('[ADMIN_PRODUCT_PATCH]', error)
      return NextResponse.json({ message: 'PRODUCT_UPDATE_FAILED' }, { status: 500 })
   }
}

export async function DELETE(req: Request, context: RouteContext) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   try {
      const { productId } = await context.params
      const existing = await prisma.product.findUnique({
         where: { id: productId },
         select: { id: true },
      })
      if (!existing) return NextResponse.json({ message: 'PRODUCT_NOT_FOUND' }, { status: 404 })

      const [orders, cartItems, reviews, wishlists] = await Promise.all([
         prisma.orderItem.count({ where: { productId } }),
         prisma.cartItem.count({ where: { productId } }),
         prisma.productReview.count({ where: { productId } }),
         prisma.user.count({ where: { wishlist: { some: { id: productId } } } }),
      ])

      if (orders + cartItems + reviews + wishlists > 0) {
         /* Preserve order history and customer lists: hide the product instead
            of deleting a record that is still referenced. */
         const product = await prisma.product.update({
            where: { id: productId },
            data: { isAvailable: false, stock: 0 },
            select: { id: true, isAvailable: true, stock: true },
         })
         revalidateTag(CATALOG_TAG, { expire: 0 })
         return NextResponse.json({ ...product, archived: true })
      }

      await prisma.product.delete({ where: { id: productId } })
      revalidateTag(CATALOG_TAG, { expire: 0 })
      return NextResponse.json({ deleted: true })
   } catch (error) {
      console.error('[ADMIN_PRODUCT_DELETE]', error)
      return NextResponse.json({ message: 'PRODUCT_DELETE_FAILED' }, { status: 500 })
   }
}
