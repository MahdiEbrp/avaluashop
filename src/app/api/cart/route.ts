import prisma from '@/lib/prisma'
import { getErrorResponse } from '@/lib/utils'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

/**
 * The cart is keyed off `X-USER-ID`, which `proxy.ts` derives from the signed
 * session cookie — a client cannot forge it.
 *
 * Everything else in the body is attacker-controlled, so it is validated here:
 * a `count` of `"drop"`, a negative number, a 4 MB `productId` or a body that
 * is not JSON all end up as a 400 instead of a Prisma 500.
 */
const cartLine = z.object({
   productId: z.string().min(1).max(64),
   count: z.coerce.number().int().min(0).max(99),
})

const cartInclude = {
   items: {
      include: {
         product: {
            include: {
               brand: true,
               categories: true,
            },
         },
      },
   },
} as const

function unauthorized() {
   return getErrorResponse(401, 'UNAUTHORIZED')
}

export async function GET(req: Request) {
   const userId = req.headers.get('X-USER-ID')

   if (!userId) return unauthorized()

   try {
      /* `findUnique`, not `findUniqueOrThrow`: a signed-in visitor who has never
         added a product has no cart row yet, and that is a normal empty cart,
         not a 500. */
      const cart = await prisma.cart.findUnique({
         where: { userId },
         include: cartInclude,
      })

      return NextResponse.json(cart ?? { userId, items: [] })
   } catch (error) {
      console.error('[GET_CART]', error)
      return getErrorResponse(500, 'Internal error')
   }
}

export async function POST(req: Request) {
   const userId = req.headers.get('X-USER-ID')

   if (!userId) return unauthorized()

   try {
      const { productId, count } = cartLine.parse(await req.json())

      if (count < 1) {
         /* Removing something that is not there is a no-op, not an error —
            `deleteMany` cannot throw P2025 the way `delete` can. */
         await prisma.cartItem.deleteMany({
            where: { cartId: userId, productId },
         })
      } else {
         const product = await prisma.product.findFirst({
            where: { id: productId, isAvailable: true },
            select: { id: true },
         })

         if (!product) return getErrorResponse(404, 'PRODUCT NOT AVAILABLE')

         await prisma.cart.upsert({
            where: { userId },
            create: {
               user: { connect: { id: userId } },
               items: { create: { productId, count } },
            },
            update: {
               items: {
                  upsert: {
                     where: { UniqueCartItem: { cartId: userId, productId } },
                     update: { count },
                     create: { productId, count },
                  },
               },
            },
         })
      }

      const cart = await prisma.cart.findUnique({
         where: { userId },
         include: {
            items: {
               include: {
                  product: true,
               },
            },
         },
      })

      return NextResponse.json(cart ?? { userId, items: [] })
   } catch (error) {
      if (error instanceof ZodError) {
         return getErrorResponse(400, 'INVALID CART LINE', error)
      }

      console.error('[POST_CART]', error)
      return getErrorResponse(500, 'Internal error')
   }
}
