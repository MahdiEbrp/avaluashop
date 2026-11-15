import { CATALOG_TAG } from '@/lib/catalog'
import prisma from '@/lib/prisma'
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'

export async function GET(
   req: Request,
   { params }: { params: Promise<{ productId: string }> }
) {
   const { productId } = await params

   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

      if (!productId) {
         return new NextResponse('Product id is required', { status: 400 })
      }

      const product = await prisma.product.findUniqueOrThrow({
         where: {
            id: productId,
         },
      })

      /* The storefront reads from the tagged catalogue cache. */
      revalidateTag(CATALOG_TAG, { expire: 0 })

      return NextResponse.json(product)
   } catch (error) {
      console.error('[PRODUCT_GET]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

export async function DELETE(
   req: Request,
   { params }: { params: Promise<{ productId: string }> }
) {
   const { productId } = await params

   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

      const product = await prisma.product.delete({
         where: {
            id: productId,
         },
      })

      /* The storefront reads from the tagged catalogue cache. */
      revalidateTag(CATALOG_TAG, { expire: 0 })

      return NextResponse.json(product)
   } catch (error) {
      console.error('[PRODUCT_DELETE]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

export async function PATCH(
   req: Request,
   { params }: { params: Promise<{ productId: string }> }
) {
   const { productId } = await params

   try {
      if (!productId) {
         return new NextResponse('Product Id is required', { status: 400 })
      }

      const userId = req.headers.get('X-USER-ID')

      if (!userId) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

      const {
         data: { title, price, discount, stock, isFeatured, isAvailable },
      } = await req.json()

      const product = await prisma.product.update({
         where: {
            id: productId,
         },
         data: {
            title,
            price,
            discount,
            stock,
            isFeatured,
            isAvailable,
         },
      })

      /* The storefront reads from the tagged catalogue cache. */
      revalidateTag(CATALOG_TAG, { expire: 0 })

      return NextResponse.json(product)
   } catch (error) {
      console.error('[PRODUCT_PATCH]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}
