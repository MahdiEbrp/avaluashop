import prisma from '@/lib/prisma'
import { getErrorResponse } from '@/lib/utils'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

const bannerPatch = z
   .object({
      label: z.string().min(1).max(120),
      image: z.string().min(1).max(2048),
   })
   .partial()
   .refine((value) => Object.keys(value).length > 0, {
      message: 'At least one field is required',
   })

type RouteContext = Readonly<{ params: Promise<{ bannerId: string }> }>

function unauthorized() {
   return getErrorResponse(401, 'UNAUTHORIZED')
}

export async function GET(req: Request, { params }: RouteContext) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   const { bannerId } = await params

   try {
      const banner = await prisma.banner.findUnique({ where: { id: bannerId } })

      if (!banner) return getErrorResponse(404, 'BANNER NOT FOUND')

      return NextResponse.json(banner)
   } catch (error) {
      console.error('[BANNER_GET]', error)
      return getErrorResponse(500, 'Internal error')
   }
}

export async function PATCH(req: Request, { params }: RouteContext) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   const { bannerId } = await params

   try {
      const data = bannerPatch.parse(await req.json())

      const existing = await prisma.banner.findUnique({
         where: { id: bannerId },
         select: { id: true },
      })

      if (!existing) return getErrorResponse(404, 'BANNER NOT FOUND')

      const banner = await prisma.banner.update({
         where: { id: bannerId },
         data,
      })

      revalidatePath('/')

      return NextResponse.json(banner)
   } catch (error) {
      if (error instanceof ZodError) {
         return getErrorResponse(400, 'INVALID BANNER', error)
      }

      console.error('[BANNER_PATCH]', error)
      return getErrorResponse(500, 'Internal error')
   }
}

export async function DELETE(req: Request, { params }: RouteContext) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   const { bannerId } = await params

   try {
      const existing = await prisma.banner.findUnique({
         where: { id: bannerId },
         select: { id: true },
      })

      if (!existing) return getErrorResponse(404, 'BANNER NOT FOUND')

      /* A banner can be attached to categories, so detach before deleting —
         otherwise the foreign key answers with a 500. */
      await prisma.banner.update({
         where: { id: bannerId },
         data: { categories: { set: [] } },
      })

      const banner = await prisma.banner.delete({ where: { id: bannerId } })

      revalidatePath('/')

      return NextResponse.json(banner)
   } catch (error) {
      console.error('[BANNER_DELETE]', error)
      return getErrorResponse(500, 'Internal error')
   }
}
