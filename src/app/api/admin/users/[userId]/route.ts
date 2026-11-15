import prisma from '@/lib/prisma'
import { getErrorResponse } from '@/lib/utils'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

/**
 * Admin user record. The panel can rename, re-contact, ban and remove a
 * customer — but never read an OTP or a session token, so the payload is
 * built from an explicit `select` rather than `omit`.
 */
const userPatch = z
   .object({
      name: z.string().min(1).max(120),
      email: z.email().max(200),
      phone: z.string().min(4).max(32),
      isBanned: z.boolean(),
   })
   .partial()
   .refine((value) => Object.keys(value).length > 0, {
      message: 'At least one field is required',
   })

const userSelect = {
   id: true,
   name: true,
   email: true,
   phone: true,
   birthday: true,
   isBanned: true,
   isEmailVerified: true,
   isPhoneVerified: true,
   isEmailSubscribed: true,
   isPhoneSubscribed: true,
   referralCode: true,
   createdAt: true,
   updatedAt: true,
} as const

type RouteContext = Readonly<{ params: Promise<{ userId: string }> }>

function unauthorized() {
   return getErrorResponse(401, 'UNAUTHORIZED')
}

export async function GET(req: Request, { params }: RouteContext) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   const { userId } = await params

   try {
      const user = await prisma.user.findUnique({
         where: { id: userId },
         select: userSelect,
      })

      if (!user) return getErrorResponse(404, 'USER NOT FOUND')

      return NextResponse.json(user)
   } catch (error) {
      console.error('[ADMIN_USER_GET]', error)
      return getErrorResponse(500, 'Internal error')
   }
}

export async function PATCH(req: Request, { params }: RouteContext) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   const { userId } = await params

   try {
      const data = userPatch.parse(await req.json())

      const existing = await prisma.user.findUnique({
         where: { id: userId },
         select: { id: true },
      })

      if (!existing) return getErrorResponse(404, 'USER NOT FOUND')

      const user = await prisma.user.update({
         where: { id: userId },
         data,
         select: userSelect,
      })

      return NextResponse.json(user)
   } catch (error) {
      if (error instanceof ZodError) {
         return getErrorResponse(400, 'INVALID USER', error)
      }

      /* A duplicate email or phone is the caller's problem, not a server fault. */
      if (
         error !== null &&
         typeof error === 'object' &&
         'code' in error &&
         error.code === 'P2002'
      ) {
         return getErrorResponse(409, 'EMAIL OR PHONE ALREADY IN USE')
      }

      console.error('[ADMIN_USER_PATCH]', error)
      return getErrorResponse(500, 'Internal error')
   }
}

export async function DELETE(req: Request, { params }: RouteContext) {
   if (!req.headers.get('X-USER-ID')) return unauthorized()

   const { userId } = await params

   try {
      const existing = await prisma.user.findUnique({
         where: { id: userId },
         select: { id: true },
      })

      if (!existing) return getErrorResponse(404, 'USER NOT FOUND')

      /* Orders are financial history: a customer with orders is banned, never
         erased. The panel uses `isBanned` for exactly this case. */
      const orders = await prisma.order.count({ where: { userId } })

      if (orders > 0) {
         return getErrorResponse(409, 'USER HAS ORDERS — BAN INSTEAD')
      }

      const user = await prisma.user.delete({
         where: { id: userId },
         select: { id: true },
      })

      return NextResponse.json(user)
   } catch (error) {
      console.error('[ADMIN_USER_DELETE]', error)
      return getErrorResponse(500, 'Internal error')
   }
}
