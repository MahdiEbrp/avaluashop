import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'

const wishlistSelect = {
   id: true,
   title: true,
   description: true,
   images: true,
   price: true,
   discount: true,
   isAvailable: true,
   brand: { select: { id: true, title: true } },
   categories: { select: { id: true, title: true } },
} as const

function unauthorized() {
   return new NextResponse('Unauthorized', { status: 401 })
}

function invalidProductId() {
   return NextResponse.json({ message: 'INVALID_PRODUCT_ID' }, { status: 400 })
}

async function readProductId(req: Request): Promise<string | null> {
   try {
      const body: unknown = await req.json()
      if (
         typeof body !== 'object' ||
         body === null ||
         !('productId' in body) ||
         typeof body.productId !== 'string' ||
         body.productId.length === 0 ||
         body.productId.length > 64
      ) return null
      return body.productId
   } catch {
      return null
   }
}

export async function GET(req: Request) {
   const userId = req.headers.get('X-USER-ID')
   if (!userId) return unauthorized()

   try {
      const user = await prisma.user.findUnique({
         where: { id: userId },
         select: { wishlist: { select: wishlistSelect } },
      })

      if (!user) return new NextResponse('Not found', { status: 404 })

      return NextResponse.json(user.wishlist, {
         headers: { 'Cache-Control': 'private, no-store' },
      })
   } catch (error) {
      console.error('[WISHLIST_GET]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

export async function POST(req: Request) {
   const userId = req.headers.get('X-USER-ID')
   if (!userId) return unauthorized()

   try {
      const productId = await readProductId(req)
      if (!productId) return invalidProductId()

      const product = await prisma.product.findUnique({
         where: { id: productId },
         select: { id: true },
      })
      if (!product) return new NextResponse('Product not found', { status: 404 })

      const user = await prisma.user.update({
         where: { id: userId },
         data: { wishlist: { connect: { id: productId } } },
         select: { wishlist: { select: wishlistSelect } },
      })

      return NextResponse.json(user.wishlist, {
         headers: { 'Cache-Control': 'private, no-store' },
      })
   } catch (error) {
      console.error('[WISHLIST_POST]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}

export async function DELETE(req: Request) {
   const userId = req.headers.get('X-USER-ID')
   if (!userId) return unauthorized()

   try {
      const productId = await readProductId(req)
      if (!productId) return invalidProductId()

      const product = await prisma.product.findUnique({
         where: { id: productId },
         select: { id: true },
      })
      if (!product) return new NextResponse('Product not found', { status: 404 })

      const user = await prisma.user.update({
         where: { id: userId },
         data: { wishlist: { disconnect: { id: productId } } },
         select: { wishlist: { select: wishlistSelect } },
      })

      return NextResponse.json(user.wishlist, {
         headers: { 'Cache-Control': 'private, no-store' },
      })
   } catch (error) {
      console.error('[WISHLIST_DELETE]', error)
      return new NextResponse('Internal error', { status: 500 })
   }
}
