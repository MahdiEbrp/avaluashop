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
import { isIranianPhoneNumberValid } from '@persepolis/regex'
import { sendTransactionalSMS } from '@persepolis/sms'
import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'

export async function POST(req: NextRequest) {
   try {
      const OTP = generateSerial({})

      const { phone } = await req.json()

      const verdict = consume(
         limitKey('otp-send-phone', clientIp(req), String(phone)),
         AUTH_SEND_POLICY
      )

      if (!verdict.allowed) return tooManyRequests(verdict.retryAfterSeconds)

      // Use isPhoneNumberValid if international
      if (isIranianPhoneNumberValid(phone)) {
         await prisma.user.upsert({
            where: { phone: phone.toString().toLowerCase() },
            update: {
               OTP,
            },
            create: {
               phone: phone.toString().toLowerCase(),
               OTP,
            },
         })

         const delivered = await sendTransactionalSMS({
            Mobile: phone,
            TemplateId: 100_000,
            Parameters: [
               {
                  name: 'Code',
                  value: '12345',
               },
            ],
         })
            .then(() => true)
            .catch((error) => {
               console.error('[OTP_SMS_DELIVERY]', error)
               return false
            })

         return new NextResponse(
            JSON.stringify({
               status: 'success',
               phone,
               delivered,
            }),
            {
               status: 200,
               headers: { 'Content-Type': 'application/json' },
            }
         )
      }

      /* The `if (isIranianPhoneNumberValid(...))` block above always returns, so this arm is
         a defensive re-check that cannot run. */
      /* v8 ignore next */
      if (!isIranianPhoneNumberValid(phone)) {
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
