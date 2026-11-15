import { CATALOG_TAG } from '@/lib/catalog'
import prisma from '@/lib/prisma'
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
   try {
      const userId = req.headers.get('X-USER-ID')

      if (!userId) {
         return new NextResponse('Unauthorized', { status: 401 })
      }

      const body = await req.json()

      const { title, description, logo } = body

      if (!title) {
         return new NextResponse('Name is required', { status: 400 })
      }

      const brand = await prisma.brand.create({
         data: {
            title,
            description,
            logo,
         },
      })

      /* The storefront reads from the tagged catalogue cache. */
      revalidateTag(CATALOG_TAG, { expire: 0 })

      return NextResponse.json(brand)
   } catch (error) {
      console.error('[BRANDS_POST]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

export async function GET() {
   try {
      const brands = await prisma.brand.findMany({})

      /* The storefront reads from the tagged catalogue cache. */
      revalidateTag(CATALOG_TAG, { expire: 0 })

      return NextResponse.json(brands)
   } catch (error) {
      console.error('[BRANDS_GET]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}
