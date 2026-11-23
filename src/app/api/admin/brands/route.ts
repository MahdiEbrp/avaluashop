import { CATALOG_TAG } from '@/lib/catalog'
import prisma from '@/lib/prisma'
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

const brandSchema = z.object({
   title: z.string().trim().min(2).max(100),
   description: z.string().trim().max(500).optional().nullable(),
   logo: z.string().trim().max(2048).optional().nullable(),
})

function unauthorized() {
   return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })
}

export async function GET(req: Request) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   try {
      const brands = await prisma.brand.findMany({
         include: { _count: { select: { products: true } } },
         orderBy: { title: 'asc' },
      })
      return NextResponse.json(brands, {
         headers: { 'Cache-Control': 'private, no-store' },
      })
   } catch (error) {
      console.error('[ADMIN_BRANDS_GET]', error)
      return NextResponse.json({ message: 'BRANDS_READ_FAILED' }, { status: 500 })
   }
}

export async function POST(req: Request) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   try {
      const input = brandSchema.parse(await req.json())
      const brand = await prisma.brand.create({ data: input })
      revalidateTag(CATALOG_TAG, { expire: 0 })
      return NextResponse.json(brand, { status: 201 })
   } catch (error) {
      if (error instanceof SyntaxError || error instanceof ZodError) {
         return NextResponse.json({ message: 'INVALID_BRAND' }, { status: 400 })
      }
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
         return NextResponse.json({ message: 'BRAND_ALREADY_EXISTS' }, { status: 409 })
      }
      console.error('[ADMIN_BRANDS_POST]', error)
      return NextResponse.json({ message: 'BRAND_CREATE_FAILED' }, { status: 500 })
   }
}
