import { parseGuestCart, mergeGuestCart } from '@/lib/cart-merge'
import { signJWT } from '@/lib/jwt'
import {
   AUTH_VERIFY_POLICY,
   clientIp,
   consume,
   forget,
   limitKey,
   tooManyRequests,
} from '@/lib/rate-limit'
import prisma from '@/lib/prisma'
import { getErrorResponse } from '@/lib/utils'
import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

const verifyBody = z.object({
   phone: z.coerce.string().min(3).max(200),
   OTP: z.coerce.string().min(1).max(12),
   /* Validated line by line in parseGuestCart, never trusted here. */
   cart: z.unknown().optional(),
})

export async function POST(req: NextRequest) {
   try {
      const expiryMinutes = 30 * 24 * 60
      const tokenMaxAge = expiryMinutes * 60

      /* The body is attacker-controlled: validate before it touches a
         query. `cart` is normalised separately by parseGuestCart. */
      const body = verifyBody.parse(await req.json())
      const { phone, OTP, cart } = body
      const number = phone.toLowerCase()

      const attemptKey = limitKey('otp-verify-phone', clientIp(req), number)
      const verdict = consume(attemptKey, AUTH_VERIFY_POLICY)

      if (!verdict.allowed) return tooManyRequests(verdict.retryAfterSeconds)

      const matched = await prisma.user.findFirst({
         where: { phone: number, OTP },
      })

      if (!matched) return getErrorResponse(401, 'INVALID OTP')

      const user = await prisma.user.update({
         where: { id: matched.id },
         data: { isPhoneVerified: true },
      })

      forget(attemptKey)

      await mergeGuestCart(user.id, parseGuestCart(cart))

      const token = await signJWT(
         { sub: user.id, role: 'user' },
         { exp: `${expiryMinutes}m` }
      )

      const cookieOptions = {
         name: 'token',
         value: token,
         httpOnly: true,
         // `lax` keeps the cookie off cross-site POSTs (CSRF) while still
         // letting a link from another site land with the session intact.
         sameSite: 'lax' as const,
         path: '/',
         secure: process.env.NODE_ENV !== 'development',
         maxAge: tokenMaxAge,
      }

      const response = new NextResponse(
         JSON.stringify({
            status: 'success',
            token,
         }),
         {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
         }
      )

      response.cookies.set(cookieOptions)
      response.cookies.set({
         name: 'logged-in',
         value: 'true',
         maxAge: tokenMaxAge,
      })

      return response
   } catch (error: unknown) {
      if (error instanceof ZodError) {
         return getErrorResponse(400, 'failed validations', error)
      }

      return getErrorResponse(
         500,
         error instanceof Error ? error.message : 'Internal error'
      )
   }
}
