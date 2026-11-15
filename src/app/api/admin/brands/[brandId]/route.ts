import { CATALOG_TAG } from '@/lib/catalog'
import prisma from '@/lib/prisma'
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'

export async function GET(
   req: Request,
   { params }: { params: Promise<{ brandId: string }> }
) {
   const { brandId } = await params

   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

      if (!brandId) {
         return new NextResponse('Brand id is required', { status: 400 })
      }

      const brand = await prisma.brand.findUnique({
         where: {
            id: brandId,
         },
      })

      /* The storefront reads from the tagged catalogue cache. */
      revalidateTag(CATALOG_TAG, { expire: 0 })

      return NextResponse.json(brand)
   } catch (error) {
      console.error('[BRAND_GET]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

export async function DELETE(
   req: Request,
   { params }: { params: Promise<{ brandId: string }> }
) {
   const { brandId } = await params

   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

      if (!brandId) {
         return new NextResponse('Brand id is required', { status: 400 })
      }

      const brand = await prisma.brand.delete({
         where: {
            id: brandId,
         },
      })

      /* The storefront reads from the tagged catalogue cache. */
      revalidateTag(CATALOG_TAG, { expire: 0 })

      return NextResponse.json(brand)
   } catch (error) {
      console.error('[BRAND_DELETE]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

export async function PATCH(
   req: Request,
   { params }: { params: Promise<{ brandId: string }> }
) {
   const { brandId } = await params

   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

      const body = await req.json()

      const { title, description } = body

      if (!title && !description) {
         return new NextResponse(
            'At least one field (title or description) is required',
            { status: 400 }
         )
      }

      if (!brandId) {
         return new NextResponse('Brand id is required', { status: 400 })
      }

      const updatedBrand = await prisma.brand.update({
         where: {
            id: brandId,
         },
         data: {
            ...(title && { title }),
            ...(description && { description }),
         },
      })

      /* The storefront reads from the tagged catalogue cache. */
      revalidateTag(CATALOG_TAG, { expire: 0 })

      return NextResponse.json(updatedBrand)
   } catch (error) {
      console.error('[BRAND_PATCH]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}
