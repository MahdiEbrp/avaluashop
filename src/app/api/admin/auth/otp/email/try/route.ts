import config from '@/config/site'
import Mail from '@/emails/verify'
import prisma from '@/lib/prisma'
import {
   AUTH_SEND_POLICY,
   clientIp,
   consume,
   limitKey,
   tooManyRequests,
} from '@/lib/rate-limit'
import { generateSerial } from '@/lib/serial'
import { getErrorResponse } from '@/lib/utils'
import { sendMail } from '@persepolis/mail'
import { isEmailValid } from '@persepolis/regex'
import { render } from '@react-email/render'
import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'

export async function POST(req: NextRequest) {
   try {
      const OTP = generateSerial({})

      const { email } = await req.json()

      /* The admin door gets the same budget as the storefront one; the admin
         address is the most valuable target in the app. */
      const verdict = consume(
         limitKey('admin-otp-send', clientIp(req), String(email)),
         AUTH_SEND_POLICY
      )

      if (!verdict.allowed) return tooManyRequests(verdict.retryAfterSeconds)

      if (isEmailValid(email)) {
         await prisma.owner.update({
            where: { email },
            data: {
               OTP,
            },
         })

         // Delivery is best-effort: the OTP is already persisted, so a mail
         // transport problem must not fail the handshake.
         const delivered = await sendMail({
            name: config.name,
            to: email,
            subject: 'Verify your email.',
            html: await render(Mail({ code: OTP, name: config.name })),
         })
            .then(() => true)
            .catch((error) => {
               console.error('[OTP_EMAIL_DELIVERY]', error)
               return false
            })

         return new NextResponse(
            JSON.stringify({
               status: 'success',
               email,
               delivered,
            }),
            {
               status: 200,
               headers: { 'Content-Type': 'application/json' },
            }
         )
      }

      if (!isEmailValid(email)) {
         return getErrorResponse(400, 'Incorrect Email')
      }
   } catch (error) {
      console.error(error)
      if (error instanceof ZodError) {
         return getErrorResponse(400, 'failed validations', error)
      }

      return getErrorResponse(500, error.message)
   }
}
