import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

const reviewSchema = z.object({
   rating: z.number().int().min(1).max(5),
   text: z.string().trim().min(3).max(1000),
})

type RouteContext = Readonly<{ params: Promise<{ productId: string }> }>

function isUniqueConstraintError(error: unknown): boolean {
   return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
   )
}

export async function GET(_req: Request, { params }: RouteContext) {
   const { productId } = await params
   if (!productId) {
      return NextResponse.json(
         { message: 'PRODUCT_ID_REQUIRED' },
         { status: 400 }
      )
   }

   try {
      const reviews = await prisma.productReview.findMany({
         where: { productId },
         orderBy: { createdAt: 'desc' },
         select: {
            id: true,
            rating: true,
            text: true,
            createdAt: true,
            user: {
               select: {
                  name: true,
               },
            },
         },
      })

      const count = reviews.length
      const averageRating =
         count === 0
            ? 0
            : Math.round(
                 ((reviews as { rating: number }[]).reduce((sum, item) => sum + item.rating, 0) / count) *
                    100
              ) / 100

      return NextResponse.json({
         reviews,
         summary: { count, averageRating },
      })
   } catch (error) {
      console.error('[PRODUCT_REVIEWS_GET]', error)
      return NextResponse.json({ message: 'INTERNAL_ERROR' }, { status: 500 })
   }
}

export async function POST(req: Request, { params }: RouteContext) {
   const userId = req.headers.get('X-USER-ID')
   if (!userId) {
      return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })
   }

   const { productId } = await params
   if (!productId) {
      return NextResponse.json(
         { message: 'PRODUCT_ID_REQUIRED' },
         { status: 400 }
      )
   }

   try {
      const data = reviewSchema.parse(await req.json())

      const product = await prisma.product.findUnique({
         where: { id: productId },
         select: { id: true },
      })
      if (!product) {
         return NextResponse.json(
            { message: 'PRODUCT_NOT_FOUND' },
            { status: 404 }
         )
      }

      const verifiedPurchase = await prisma.order.findFirst({
         where: {
            userId,
            isPaid: true,
            status: { in: ['Processing', 'Shipped', 'Delivered'] },
            orderItems: {
               some: { productId },
            },
         },
         select: { id: true },
      })
      if (!verifiedPurchase) {
         return NextResponse.json(
            { message: 'VERIFIED_PURCHASE_REQUIRED' },
            { status: 403 }
         )
      }

      const existing = await prisma.productReview.findUnique({
         where: {
            UniqueProductProductReview: {
               productId,
               userId,
            },
         },
         select: { id: true },
      })
      if (existing) {
         return NextResponse.json(
            { message: 'REVIEW_ALREADY_EXISTS' },
            { status: 409 }
         )
      }

      const review = await prisma.productReview.create({
         data: {
            productId,
            userId,
            rating: data.rating,
            text: data.text,
         },
         select: {
            id: true,
            productId: true,
            rating: true,
            text: true,
            createdAt: true,
         },
      })

      return NextResponse.json(review, { status: 201 })
   } catch (error) {
      if (error instanceof ZodError) {
         return NextResponse.json({ message: 'INVALID_REVIEW' }, { status: 400 })
      }
      if (isUniqueConstraintError(error)) {
         return NextResponse.json(
            { message: 'REVIEW_ALREADY_EXISTS' },
            { status: 409 }
         )
      }
      console.error('[PRODUCT_REVIEWS_POST]', error)
      return NextResponse.json({ message: 'INTERNAL_ERROR' }, { status: 500 })
   }
}

export async function DELETE(req: Request, { params }: RouteContext) {
   const userId = req.headers.get('X-USER-ID')
   if (!userId) {
      return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })
   }

   const { productId } = await params
   if (!productId) {
      return NextResponse.json(
         { message: 'PRODUCT_ID_REQUIRED' },
         { status: 400 }
      )
   }

   try {
      const deleted = await prisma.productReview.deleteMany({
         where: { productId, userId },
      })
      if (deleted.count === 0) {
         return NextResponse.json(
            { message: 'REVIEW_NOT_FOUND' },
            { status: 404 }
         )
      }

      return NextResponse.json({ deleted: true })
   } catch (error) {
      console.error('[PRODUCT_REVIEWS_DELETE]', error)
      return NextResponse.json({ message: 'INTERNAL_ERROR' }, { status: 500 })
   }
}
