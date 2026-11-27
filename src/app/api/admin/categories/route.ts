import { adminId } from '@/lib/require-admin'
import { CATALOG_TAG } from '@/lib/catalog'
import prisma from '@/lib/prisma'
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

const categorySchema = z.object({
   title: z.string().trim().min(2).max(100),
   description: z.string().trim().max(500).optional().nullable(),
})

function unauthorized() {
   return NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 })
}

export async function GET(req: Request) {
   if (!adminId(req)) return unauthorized()

   try {
      const categories = await prisma.category.findMany({
         include: { _count: { select: { products: true } } },
         orderBy: { title: 'asc' },
      })
      return NextResponse.json(categories, {
         headers: { 'Cache-Control': 'private, no-store' },
      })
   } catch (error) {
      console.error('[ADMIN_CATEGORIES_GET]', error)
      return NextResponse.json({ message: 'CATEGORIES_READ_FAILED' }, { status: 500 })
   }
}

export async function POST(req: Request) {
   if (!adminId(req)) return unauthorized()

   try {
      const input = categorySchema.parse(await req.json())
      const category = await prisma.category.create({
         data: { title: input.title, description: input.description ?? null },
      })
      revalidateTag(CATALOG_TAG, { expire: 0 })
      return NextResponse.json(category, { status: 201 })
   } catch (error) {
      if (error instanceof SyntaxError || error instanceof ZodError) {
         return NextResponse.json({ message: 'INVALID_CATEGORY' }, { status: 400 })
      }
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
         return NextResponse.json({ message: 'CATEGORY_ALREADY_EXISTS' }, { status: 409 })
      }
      console.error('[ADMIN_CATEGORIES_POST]', error)
      return NextResponse.json({ message: 'CATEGORY_CREATE_FAILED' }, { status: 500 })
   }
}
