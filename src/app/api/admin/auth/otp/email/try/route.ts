import config from '@/config/site'
import Mail from '@/emails/verify'
import { generateOtp, isOtpCoolingDown, otpFields } from '@/lib/otp'
import prisma from '@/lib/prisma'
import { AUTH_SEND_POLICY, clientIp, consume, limitKey, tooManyRequests } from '@/lib/rate-limit'
import { getErrorResponse } from '@/lib/utils'
import { sendMail } from '@persepolis/mail'
import { isEmailValid } from '@persepolis/regex'
import { render } from '@react-email/render'
import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'

export async function POST(req: NextRequest) {
   try {
      const { email } = await req.json()
      const address = String(email).toLowerCase()

      /* The admin door gets the same budget as the storefront one; the admin
         address is the most valuable target in the app. */
      const verdict = await consume(
         limitKey('admin-otp-send', clientIp(req), address),
         AUTH_SEND_POLICY
      )

      if (!verdict.allowed) return tooManyRequests(verdict.retryAfterSeconds)

      if (!isEmailValid(email)) return getErrorResponse(400, 'Incorrect Email')

      /* An unknown address gets the exact same response as a known one, so the
         endpoint cannot be used to enumerate admin accounts. The cooldown is
         silent for the same reason: no 429 for a real admin only. */
      /* Case-insensitive so a row stored as Owner@Example.com still matches. */
      const owner = await prisma.owner.findFirst({
         where: { email: { equals: address, mode: 'insensitive' } },
         select: { id: true, otpExpiresAt: true },
      })

      if (owner && !isOtpCoolingDown(owner.otpExpiresAt)) {
         const OTP = generateOtp()

         await prisma.owner.update({
            where: { id: owner.id },
            data: otpFields(address, OTP),
         })

         // Delivery is best-effort; a failure is logged, never returned.
         await sendMail({
            name: config.name,
            to: address,
            subject: 'Verify your email.',
            html: await render(Mail({ code: OTP, name: config.name })),
         }).catch((error) => {
            console.error('[ADMIN_OTP_EMAIL_DELIVERY]', error)
         })
      }

      return NextResponse.json({ status: 'success', email: address }, { status: 200 })
   } catch (error) {
      if (error instanceof ZodError) {
         return getErrorResponse(400, 'failed validations', error)
      }

      console.error('[ADMIN_OTP_TRY]', error)
      return getErrorResponse(500, 'Internal error')
   }
}
