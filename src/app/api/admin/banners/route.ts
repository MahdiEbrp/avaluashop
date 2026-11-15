import prisma from '@/lib/prisma'
import { getErrorResponse } from '@/lib/utils'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

/**
 * Banners are the storefront hero strip. They are not part of the catalogue
 * cache, so a write invalidates the home page itself.
 */
const bannerBody = z.object({
   label: z.string().min(1).max(120),
   image: z.string().min(1).max(2048),
})

function unauthorized() {
   return getErrorResponse(401, 'UNAUTHORIZED')
}

export async function GET(req: Request) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   try {
      const banners = await prisma.banner.findMany({
         orderBy: { createdAt: 'desc' },
      })

      return NextResponse.json(banners)
   } catch (error) {
      console.error('[BANNERS_GET]', error)
      return getErrorResponse(500, 'Internal error')
   }
}

export async function POST(req: Request) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   try {
      const data = bannerBody.parse(await req.json())
      const banner = await prisma.banner.create({ data })

      revalidatePath('/')

      return NextResponse.json(banner)
   } catch (error) {
      if (error instanceof ZodError) {
         return getErrorResponse(400, 'INVALID BANNER', error)
      }

      console.error('[BANNERS_POST]', error)
      return getErrorResponse(500, 'Internal error')
   }
}
