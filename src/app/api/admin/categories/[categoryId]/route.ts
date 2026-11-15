import { CATALOG_TAG } from '@/lib/catalog'
import prisma from '@/lib/prisma'
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'

export async function GET(
   req: Request,
   { params }: { params: Promise<{ categoryId: string }> }
) {
   const { categoryId } = await params

   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

      if (!categoryId) {
         return new NextResponse('Category id is required', { status: 400 })
      }

      const category = await prisma.category.findUnique({
         where: {
            id: categoryId,
         },
      })

      /* The storefront reads from the tagged catalogue cache. */
      revalidateTag(CATALOG_TAG, { expire: 0 })

      return NextResponse.json(category)
   } catch (error) {
      console.error('[CATEGORY_GET]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

export async function DELETE(
   req: Request,
   { params }: { params: Promise<{ categoryId: string }> }
) {
   const { categoryId } = await params

   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

      if (!categoryId) {
         return new NextResponse('Category id is required', { status: 400 })
      }

      const category = await prisma.category.delete({
         where: {
            id: categoryId,
         },
      })

      /* The storefront reads from the tagged catalogue cache. */
      revalidateTag(CATALOG_TAG, { expire: 0 })

      return NextResponse.json(category)
   } catch (error) {
      console.error('[CATEGORY_DELETE]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

export async function PATCH(
   req: Request,
   { params }: { params: Promise<{ categoryId: string }> }
) {
   const { categoryId } = await params

   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

      const body = await req.json()

      const { title, description, bannerId } = body

      if (!bannerId) {
         return new NextResponse('Banner ID is required', { status: 400 })
      }

      if (!title) {
         return new NextResponse('Name is required', { status: 400 })
      }

      if (!categoryId) {
         return new NextResponse('Category id is required', { status: 400 })
      }

      const updatedCategory = await prisma.category.update({
         where: {
            id: categoryId,
         },
         data: {
            title,
            description,
            banners: {
               connect: {
                  id: bannerId,
               },
            },
         },
      })

      /* The storefront reads from the tagged catalogue cache. */
      revalidateTag(CATALOG_TAG, { expire: 0 })

      return NextResponse.json(updatedCategory)
   } catch (error) {
      console.error('[CATEGORY_PATCH]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}
