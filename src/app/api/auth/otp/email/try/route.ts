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

      /* Delivery costs money and lands in someone else's inbox, so a single
         address cannot be flooded even from many sessions. */
      const verdict = await consume(
         limitKey('otp-send-email', clientIp(req), address),
         AUTH_SEND_POLICY
      )

      if (!verdict.allowed) return tooManyRequests(verdict.retryAfterSeconds)

      if (!isEmailValid(email)) return getErrorResponse(400, 'Incorrect Email')

      const existing = await prisma.user.findUnique({
         where: { email: address },
         select: { otpExpiresAt: true },
      })

      if (isOtpCoolingDown(existing?.otpExpiresAt ?? null)) {
         return tooManyRequests(60)
      }

      const OTP = generateOtp()
      const fields = otpFields(address, OTP)

      await prisma.user.upsert({
         where: { email: address },
         update: fields,
         create: { email: address, ...fields },
      })

      // Delivery is best-effort: the code is already stored, so a mail
      // transport problem must not fail the handshake.
      const delivered = await sendMail({
         name: config.name,
         to: address,
         subject: 'Verify your email.',
         html: await render(Mail({ code: OTP, name: config.name })),
      })
         .then(() => true)
         .catch((error) => {
            console.error('[OTP_EMAIL_DELIVERY]', error)
            return false
         })

      return NextResponse.json({ status: 'success', email, delivered }, { status: 200 })
   } catch (error) {
      if (error instanceof ZodError) {
         return getErrorResponse(400, 'failed validations', error)
      }

      console.error('[OTP_EMAIL_TRY]', error)
      return getErrorResponse(500, 'Internal error')
   }
}
