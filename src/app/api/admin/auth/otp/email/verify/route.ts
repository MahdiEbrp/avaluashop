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
import { ZodError } from 'zod'

export async function POST(req: NextRequest) {
   try {
      const expiryMinutes = 30 * 24 * 60

      const payload = await req.json()
      const OTP = payload.OTP
      const email = String(payload.email).toLowerCase()

      if (!process.env.JWT_SECRET_KEY) {
         console.error('JWT secret key is missing')
         return getErrorResponse(500, 'Internal Server Error')
      }

      const attemptKey = limitKey('admin-otp-verify', clientIp(req), email)
      const verdict = consume(attemptKey, AUTH_VERIFY_POLICY)

      if (!verdict.allowed) return tooManyRequests(verdict.retryAfterSeconds)

      const user = await prisma.owner.findFirst({
         where: { email, OTP: String(OTP) },
      })

      if (!user) return getErrorResponse(401, 'INVALID OTP')

      forget(attemptKey)

      const token = await signJWT(
         { sub: user.id, role: 'admin' },
         { exp: `${expiryMinutes}m` }
      )

      const tokenMaxAge = expiryMinutes * 60
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
