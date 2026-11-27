import { parseGuestCart, mergeGuestCart } from '@/lib/cart-merge'
import { OTP_MAX_ATTEMPTS, OTP_PATTERN, isOtpUsable, otpMatches } from '@/lib/otp'
import prisma from '@/lib/prisma'
import {
   AUTH_VERIFY_POLICY,
   clientIp,
   consume,
   forget,
   limitKey,
   tooManyRequests,
} from '@/lib/rate-limit'
import { USER_SESSION_MINUTES, startSession } from '@/lib/session'
import { getErrorResponse } from '@/lib/utils'
import { NextRequest } from 'next/server'
import { z, ZodError } from 'zod'

const verifyBody = z.object({
   phone: z.coerce.string().min(3).max(200),
   OTP: z.coerce.string().regex(OTP_PATTERN),
   /* Validated line by line in parseGuestCart, never trusted here. */
   cart: z.unknown().optional(),
})

export async function POST(req: NextRequest) {
   try {
      const { phone, OTP, cart } = verifyBody.parse(await req.json())
      const number = phone.toLowerCase()

      const attemptKey = limitKey('otp-verify-phone', clientIp(req), number)
      const verdict = await consume(attemptKey, AUTH_VERIFY_POLICY)

      if (!verdict.allowed) return tooManyRequests(verdict.retryAfterSeconds)

      const user = await prisma.user.findUnique({ where: { phone: number } })

      if (!user || !isOtpUsable(user)) return getErrorResponse(401, 'INVALID OTP')

      const reserved = await prisma.user.updateMany({
         where: {
            id: user.id,
            otpHash: user.otpHash,
            otpAttempts: { lt: OTP_MAX_ATTEMPTS },
         },
         data: { otpAttempts: { increment: 1 } },
      })

      if (reserved.count === 0 || !otpMatches(user.otpHash, number, OTP)) {
         return getErrorResponse(401, 'INVALID OTP')
      }

      const verified = await prisma.user.update({
         where: { id: user.id },
         data: {
            isPhoneVerified: true,
            otpHash: null,
            otpExpiresAt: null,
            otpAttempts: 0,
         },
      })

      await forget(attemptKey)
      await mergeGuestCart(verified.id, parseGuestCart(cart))

      return await startSession({ sub: verified.id, role: 'user' }, USER_SESSION_MINUTES)
   } catch (error: unknown) {
      if (error instanceof ZodError) {
         return getErrorResponse(400, 'failed validations', error)
      }

      console.error('[OTP_PHONE_VERIFY]', error)
      return getErrorResponse(500, 'Internal error')
   }
}
