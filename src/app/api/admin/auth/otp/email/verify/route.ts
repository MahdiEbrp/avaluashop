import { ADMIN_SESSION_MINUTES, startSession } from '@/lib/session'
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
import { getErrorResponse } from '@/lib/utils'
import { NextRequest } from 'next/server'
import { z, ZodError } from 'zod'

const verifyBody = z.object({
   email: z.coerce.string().min(3).max(200),
   OTP: z.coerce.string().regex(OTP_PATTERN),
})

export async function POST(req: NextRequest) {
   try {
      const { email: rawEmail, OTP } = verifyBody.parse(await req.json())
      const email = rawEmail.toLowerCase()

      const attemptKey = limitKey('admin-otp-verify', clientIp(req), email)
      const verdict = await consume(attemptKey, AUTH_VERIFY_POLICY)

      if (!verdict.allowed) return tooManyRequests(verdict.retryAfterSeconds)

      const owner = await prisma.owner.findUnique({ where: { email } })

      if (!owner || !isOtpUsable(owner)) return getErrorResponse(401, 'INVALID OTP')

      const reserved = await prisma.owner.updateMany({
         where: {
            id: owner.id,
            otpHash: owner.otpHash,
            otpAttempts: { lt: OTP_MAX_ATTEMPTS },
         },
         data: { otpAttempts: { increment: 1 } },
      })

      if (reserved.count === 0 || !otpMatches(owner.otpHash, email, OTP)) {
         return getErrorResponse(401, 'INVALID OTP')
      }

      await prisma.owner.update({
         where: { id: owner.id },
         data: { otpHash: null, otpExpiresAt: null, otpAttempts: 0 },
      })

      await forget(attemptKey)

      return await startSession({ sub: owner.id, role: 'admin' }, ADMIN_SESSION_MINUTES)
   } catch (error: unknown) {
      if (error instanceof ZodError) {
         return getErrorResponse(400, 'failed validations', error)
      }

      console.error('[ADMIN_OTP_VERIFY]', error)
      return getErrorResponse(500, 'Internal error')
   }
}
