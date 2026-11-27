import { generateOtp, isOtpCoolingDown, otpFields } from '@/lib/otp'
import prisma from '@/lib/prisma'
import { AUTH_SEND_POLICY, clientIp, consume, limitKey, tooManyRequests } from '@/lib/rate-limit'
import { getErrorResponse } from '@/lib/utils'
import { isIranianPhoneNumberValid } from '@persepolis/regex'
import { sendTransactionalSMS } from '@persepolis/sms'
import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'

export async function POST(req: NextRequest) {
   try {
      const { phone } = await req.json()
      const number = String(phone).toLowerCase()

      const verdict = await consume(
         limitKey('otp-send-phone', clientIp(req), number),
         AUTH_SEND_POLICY
      )

      if (!verdict.allowed) return tooManyRequests(verdict.retryAfterSeconds)

      if (!isIranianPhoneNumberValid(phone)) return getErrorResponse(400, 'Incorrect phone')

      const existing = await prisma.user.findUnique({
         where: { phone: number },
         select: { otpExpiresAt: true },
      })

      if (isOtpCoolingDown(existing?.otpExpiresAt ?? null)) {
         return tooManyRequests(60)
      }

      const OTP = generateOtp()
      const fields = otpFields(number, OTP)

      await prisma.user.upsert({
         where: { phone: number },
         update: fields,
         create: { phone: number, ...fields },
      })

      /* The SMS carries the code that was just stored. Sending a constant here
         would make every stored code unusable from the phone. */
      const delivered = await sendTransactionalSMS({
         Mobile: phone,
         TemplateId: 100_000,
         Parameters: [{ name: 'Code', value: OTP }],
      })
         .then(() => true)
         .catch((error) => {
            console.error('[OTP_SMS_DELIVERY]', error)
            return false
         })

      return NextResponse.json({ status: 'success', phone, delivered }, { status: 200 })
   } catch (error) {
      if (error instanceof ZodError) {
         return getErrorResponse(400, 'failed validations', error)
      }

      console.error('[OTP_PHONE_TRY]', error)
      return getErrorResponse(500, 'Internal error')
   }
}
