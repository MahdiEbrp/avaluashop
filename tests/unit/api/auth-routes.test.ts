import { ipv4 } from '../support/ip'
import { POST as emailTry } from '@/app/api/auth/otp/email/try/route'
import { POST as emailVerify } from '@/app/api/auth/otp/email/verify/route'
import { POST as phoneTry } from '@/app/api/auth/otp/phone/try/route'
import { POST as phoneVerify } from '@/app/api/auth/otp/phone/verify/route'
import { GET as logout } from '@/app/api/auth/logout/route'
import { POST as adminEmailTry } from '@/app/api/admin/auth/otp/email/try/route'
import { POST as adminEmailVerify } from '@/app/api/admin/auth/otp/email/verify/route'
import { GET as adminLogout } from '@/app/api/admin/auth/logout/route'
import { hashOtp } from '@/lib/otp'
import { sendMail } from '@persepolis/mail'
import { sendTransactionalSMS } from '@persepolis/sms'
import { NextRequest } from 'next/server'

import { prismaMock, silenceConsole } from './helpers'

vi.mock('@/lib/prisma', () => import('../support/db').then((m) => m.prismaModule()))

/* A fixed code keeps the assertions readable. The real HMAC still runs. */
vi.mock('@/lib/otp', async (importOriginal) => ({
   ...(await importOriginal<typeof import('@/lib/otp')>()),
   generateOtp: () => '123456',
}))

const CODE = '123456'
const statusOf = async (pending: Promise<Response>) => {
   const response = await pending

   return response.status
}
const FUTURE = () => new Date(Date.now() + 4 * 60_000)

let seq = 0
let currentIp = ''

const request = (body: unknown, extra: Record<string, string> = {}) =>
   new NextRequest('http://localhost/api/auth', {
      method: 'POST',
      headers: {
         'content-type': 'application/json',
         'x-forwarded-for': currentIp,
         ...extra,
      },
      body: JSON.stringify(body),
   })

const brokenRequest = () =>
   new NextRequest('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': currentIp },
      body: '{not json',
   })

/** A stored challenge as the verify routes read it back. */
const challenge = ({
   identifier = 'buyer@example.com',
   ...overrides
}: { identifier?: string } & Record<string, unknown> = {}) => ({
   id: 'account-1',
   otpHash: hashOtp(identifier, CODE),
   otpExpiresAt: FUTURE(),
   otpAttempts: 0,
   ...overrides,
})

const zodError = async () => {
   const { ZodError } = await import('zod')
   return new ZodError([{ code: 'custom', message: 'bad row', path: ['email'] }])
}

const cookieHeader = (response: Response, name: string) =>
   response.headers.getSetCookie().find((cookie) => cookie.startsWith(`${name}=`)) ?? ''

beforeEach(() => {
   silenceConsole()
   seq += 1
   currentIp = ipv4(10, 0, Math.floor(seq / 250), seq % 250)

   prismaMock.user.findUnique.mockResolvedValue(null)
   prismaMock.user.upsert.mockResolvedValue({ id: 'account-1' })
   prismaMock.user.updateMany.mockResolvedValue({ count: 1 })
   prismaMock.user.update.mockImplementation(({ data }) => Promise.resolve({ id: 'account-1', ...data }))
   prismaMock.owner.findFirst.mockResolvedValue(null)
   prismaMock.owner.update.mockResolvedValue({ id: 'owner-1' })
   prismaMock.owner.updateMany.mockResolvedValue({ count: 1 })
   vi.mocked(sendMail).mockClear()
   vi.mocked(sendTransactionalSMS).mockClear()
})

describe('POST /api/auth/otp/email/try', () => {
   it('stores only a hash of a six-digit code and reports delivery', async () => {
      const response = await emailTry(request({ email: 'Buyer@Example.com' }))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({
         status: 'success',
         email: 'Buyer@Example.com',
         delivered: true,
      })

      const { create } = prismaMock.user.upsert.mock.calls[0][0]
      expect(create.email).toBe('buyer@example.com')
      expect(create.otpHash).toBe(hashOtp('buyer@example.com', CODE))
      expect(create.otpHash).not.toContain(CODE)
      expect(create.otpAttempts).toBe(0)
      expect(create.otpExpiresAt.getTime()).toBeGreaterThan(Date.now())
      expect(create).not.toHaveProperty('OTP')
      expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'buyer@example.com' }))
   })

   it('still succeeds when the mail transport fails', async () => {
      vi.mocked(sendMail).mockRejectedValueOnce(new Error('smtp down'))

      const response = await emailTry(request({ email: 'buyer@example.com' }))

      await expect(response.json()).resolves.toMatchObject({ delivered: false })
   })

   it('rejects an invalid address with 400', async () => {
      const response = await emailTry(request({ email: 'not-an-email' }))

      expect(response.status).toBe(400)
      expect(prismaMock.user.upsert).not.toHaveBeenCalled()
   })

   it('refuses a resend while the previous code is still cooling down', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
         otpExpiresAt: new Date(Date.now() + 4 * 60_000 + 30_000),
      })

      const response = await emailTry(request({ email: 'buyer@example.com' }))

      expect(response.status).toBe(429)
      expect(response.headers.get('Retry-After')).toBe('60')
      expect(prismaMock.user.upsert).not.toHaveBeenCalled()
   })

   it('rate limits after six deliveries from one address', async () => {
      for (let index = 0; index < 6; index += 1) {
      expect(await statusOf(emailTry(request({ email: 'buyer@example.com' })))).toBe(200)
      }

      expect(await statusOf(emailTry(request({ email: 'buyer@example.com' })))).toBe(429)
   })

   it('answers 500 with a generic message for a malformed body', async () => {
      const response = await emailTry(brokenRequest())

      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toMatchObject({ message: 'Internal error' })
   })

   it('does not leak database error text', async () => {
      prismaMock.user.upsert.mockRejectedValueOnce(new Error('relation "User" secret detail'))

      const response = await emailTry(request({ email: 'buyer@example.com' }))

      expect(response.status).toBe(500)
      expect(JSON.stringify(await response.json())).not.toContain('secret detail')
   })

   it('maps a validation error from persistence to 400', async () => {
      prismaMock.user.upsert.mockRejectedValueOnce(await zodError())

      const response = await emailTry(request({ email: 'buyer@example.com' }))

      expect(response.status).toBe(400)
   })
})

describe('POST /api/auth/otp/email/verify', () => {
   it('issues a user session, clears the code and marks the email verified', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(challenge({ identifier: 'buyer@example.com' }))

      const response = await emailVerify(request({ email: 'Buyer@Example.com', OTP: CODE }))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toMatchObject({ status: 'success' })
      expect(body.token).toEqual(expect.any(String))
      expect(cookieHeader(response, 'token')).toContain('HttpOnly')
      expect(cookieHeader(response, 'logged-in')).toContain('logged-in=true')

      expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
         where: expect.objectContaining({ id: 'account-1', otpAttempts: { lt: 5 } }),
         data: { otpAttempts: { increment: 1 } },
      })
      expect(prismaMock.user.update).toHaveBeenCalledWith({
         where: { id: 'account-1' },
         data: {
            isEmailVerified: true,
            otpHash: null,
            otpExpiresAt: null,
            otpAttempts: 0,
         },
      })
   })

   it('accepts a guest cart on the way in', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(challenge({ identifier: 'buyer@example.com' }))

      const response = await emailVerify(
         request({ email: 'buyer@example.com', OTP: CODE, cart: { items: [] } })
      )

      expect(response.status).toBe(200)
   })

   it('rejects a wrong code with 401 and still counts the attempt', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(challenge({ identifier: 'buyer@example.com' }))

      const response = await emailVerify(request({ email: 'buyer@example.com', OTP: '000000' }))

      expect(response.status).toBe(401)
      await expect(response.json()).resolves.toMatchObject({ message: 'INVALID OTP' })
      expect(prismaMock.user.updateMany).toHaveBeenCalledTimes(1)
      expect(prismaMock.user.update).not.toHaveBeenCalled()
   })

   it('rejects an unknown address without touching any row', async () => {
      const response = await emailVerify(request({ email: 'ghost@example.com', OTP: CODE }))

      expect(response.status).toBe(401)
      expect(prismaMock.user.updateMany).not.toHaveBeenCalled()
   })

   it('rejects an expired code', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(
         challenge({ identifier: 'buyer@example.com', otpExpiresAt: new Date(Date.now() - 1) })
      )

      const response = await emailVerify(request({ email: 'buyer@example.com', OTP: CODE }))

      expect(response.status).toBe(401)
      expect(prismaMock.user.updateMany).not.toHaveBeenCalled()
   })

   it('rejects a code that has no pending challenge', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(
         challenge({ identifier: 'buyer@example.com', otpHash: null, otpExpiresAt: null })
      )

      const response = await emailVerify(request({ email: 'buyer@example.com', OTP: CODE }))

      expect(response.status).toBe(401)
   })

   it('rejects a code whose attempt budget is already spent', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(
         challenge({ identifier: 'buyer@example.com', otpAttempts: 5 })
      )

      const response = await emailVerify(request({ email: 'buyer@example.com', OTP: CODE }))

      expect(response.status).toBe(401)
      expect(prismaMock.user.updateMany).not.toHaveBeenCalled()
   })

   it('refuses when a parallel guess already reserved the last attempt', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(challenge({ identifier: 'buyer@example.com' }))
      prismaMock.user.updateMany.mockResolvedValueOnce({ count: 0 })

      const response = await emailVerify(request({ email: 'buyer@example.com', OTP: CODE }))

      expect(response.status).toBe(401)
      expect(prismaMock.user.update).not.toHaveBeenCalled()
   })

   it('locks out after five failed attempts from one address', async () => {
      for (let index = 0; index < 5; index += 1) {
         prismaMock.user.findUnique.mockResolvedValueOnce(challenge({ identifier: 'buyer@example.com' }))
      expect(await statusOf(emailVerify(request({ email: 'buyer@example.com', OTP: '111111' })))).toBe(401)
      }

      expect(await statusOf(emailVerify(request({ email: 'buyer@example.com', OTP: '111111' })))).toBe(429)
   })

   it('rejects a body that is not six digits', async () => {
      const response = await emailVerify(request({ email: 'buyer@example.com', OTP: '12345' }))

      expect(response.status).toBe(400)
   })

   it('answers 500 with a generic message for a malformed body', async () => {
      const response = await emailVerify(brokenRequest())

      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toMatchObject({ message: 'Internal error' })
   })

   it('normalises a non-Error rejection to a generic 500', async () => {
      prismaMock.user.findUnique.mockRejectedValueOnce('boom')

      const response = await emailVerify(request({ email: 'buyer@example.com', OTP: CODE }))

      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toMatchObject({ message: 'Internal error' })
   })

   it('maps a validation error from persistence to 400', async () => {
      prismaMock.user.findUnique.mockRejectedValueOnce(await zodError())

      const response = await emailVerify(request({ email: 'buyer@example.com', OTP: CODE }))

      expect(response.status).toBe(400)
   })
})

describe('POST /api/auth/otp/phone/try', () => {
   it('sends the same code that was stored', async () => {
      const response = await phoneTry(request({ phone: '09123456789' }))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({ phone: '09123456789', delivered: true })

      const { create } = prismaMock.user.upsert.mock.calls[0][0]
      expect(create.otpHash).toBe(hashOtp('09123456789', CODE))
      expect(sendTransactionalSMS).toHaveBeenCalledWith(
         expect.objectContaining({
            Parameters: [{ name: 'Code', value: CODE }],
         })
      )
   })

   it('still succeeds when the SMS gateway fails', async () => {
      vi.mocked(sendTransactionalSMS).mockRejectedValueOnce(new Error('gateway down'))

      const response = await phoneTry(request({ phone: '09123456789' }))

      await expect(response.json()).resolves.toMatchObject({ delivered: false })
   })

   it('rejects a non-Iranian number', async () => {
      const response = await phoneTry(request({ phone: '12' }))

      expect(response.status).toBe(400)
   })

   it('refuses a resend while cooling down', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
         otpExpiresAt: new Date(Date.now() + 4 * 60_000 + 30_000),
      })

      const response = await phoneTry(request({ phone: '09123456789' }))

      expect(response.status).toBe(429)
   })

   it('rate limits repeated sends to one number', async () => {
      for (let index = 0; index < 6; index += 1) {
      expect(await statusOf(phoneTry(request({ phone: '09123456789' })))).toBe(200)
      }

      expect(await statusOf(phoneTry(request({ phone: '09123456789' })))).toBe(429)
   })

   it('answers 500 with a generic message for a malformed body', async () => {
      const response = await phoneTry(brokenRequest())

      expect(response.status).toBe(500)
   })
})

describe('POST /api/auth/otp/phone/verify', () => {
   it('issues a session and marks the phone verified', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(challenge({ identifier: '09123456789' }))

      const response = await phoneVerify(request({ phone: '09123456789', OTP: CODE }))

      expect(response.status).toBe(200)
      expect(cookieHeader(response, 'token')).toContain('token=')
      expect(prismaMock.user.update).toHaveBeenCalledWith(
         expect.objectContaining({ data: expect.objectContaining({ isPhoneVerified: true, otpHash: null }) })
      )
   })

   it('rejects a wrong code', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(challenge({ identifier: '09123456789' }))

      const response = await phoneVerify(request({ phone: '09123456789', OTP: '999999' }))

      expect(response.status).toBe(401)
   })

   it('locks out after five failures', async () => {
      for (let index = 0; index < 5; index += 1) {
         prismaMock.user.findUnique.mockResolvedValueOnce(challenge({ identifier: '09123456789' }))
         await phoneVerify(request({ phone: '09123456789', OTP: '999999' }))
      }

      expect(await statusOf(phoneVerify(request({ phone: '09123456789', OTP: CODE })))).toBe(429)
   })

   it('rejects an invalid body', async () => {
      const response = await phoneVerify(request({ phone: '09123456789', OTP: 'abc' }))

      expect(response.status).toBe(400)
   })

   it('answers 500 for a malformed body', async () => {
      const response = await phoneVerify(brokenRequest())

      expect(response.status).toBe(500)
   })

   it('normalises a non-Error rejection', async () => {
      prismaMock.user.findUnique.mockRejectedValueOnce('boom')

      const response = await phoneVerify(request({ phone: '09123456789', OTP: CODE }))

      expect(response.status).toBe(500)
   })
})

describe('POST /api/admin/auth/otp/email/try', () => {
   it('stores a hashed code on the owner and sends it', async () => {
      prismaMock.owner.findFirst.mockResolvedValueOnce({ id: 'owner-1', otpExpiresAt: null })

      const response = await adminEmailTry(request({ email: 'Owner@Example.com' }))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({
         status: 'success',
         email: 'owner@example.com',
      })
      const { data } = prismaMock.owner.update.mock.calls[0][0]
      expect(data.otpHash).toBe(hashOtp('owner@example.com', CODE))
      expect(sendMail).toHaveBeenCalledTimes(1)
   })

   it('answers exactly like a known owner for an unknown address', async () => {
      const response = await adminEmailTry(request({ email: 'nobody@example.com' }))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({
         status: 'success',
         email: 'nobody@example.com',
      })
      expect(prismaMock.owner.update).not.toHaveBeenCalled()
      expect(sendMail).not.toHaveBeenCalled()
   })

   it('stays silent during the cooldown instead of revealing the account', async () => {
      prismaMock.owner.findFirst.mockResolvedValueOnce({
         id: 'owner-1',
         otpExpiresAt: new Date(Date.now() + 4 * 60_000 + 30_000),
      })

      const response = await adminEmailTry(request({ email: 'owner@example.com' }))

      expect(response.status).toBe(200)
      expect(prismaMock.owner.update).not.toHaveBeenCalled()
   })

   it('logs but does not return a delivery failure', async () => {
      prismaMock.owner.findFirst.mockResolvedValueOnce({ id: 'owner-1', otpExpiresAt: null })
      vi.mocked(sendMail).mockRejectedValueOnce(new Error('smtp down'))

      const response = await adminEmailTry(request({ email: 'owner@example.com' }))

      expect(response.status).toBe(200)
      expect(await response.text()).not.toContain('smtp')
   })

   it('rejects an invalid address', async () => {
      const response = await adminEmailTry(request({ email: 'nope' }))

      expect(response.status).toBe(400)
   })

   it('rate limits sends', async () => {
      for (let index = 0; index < 6; index += 1) {
      expect(await statusOf(adminEmailTry(request({ email: 'nobody@example.com' })))).toBe(200)
      }

      expect(await statusOf(adminEmailTry(request({ email: 'nobody@example.com' })))).toBe(429)
   })

   it('answers 500 with a generic message for a malformed body', async () => {
      const response = await adminEmailTry(brokenRequest())

      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toMatchObject({ message: 'Internal error' })
   })

   it('maps a validation error from persistence to 400', async () => {
      prismaMock.owner.findFirst.mockRejectedValueOnce(await zodError())

      const response = await adminEmailTry(request({ email: 'owner@example.com' }))

      expect(response.status).toBe(400)
   })
})

describe('POST /api/admin/auth/otp/email/verify', () => {
   it('issues an eight-hour admin session for a matching owner', async () => {
      prismaMock.owner.findFirst.mockResolvedValueOnce(challenge({ id: 'owner-1', identifier: 'owner@example.com' }))

      const response = await adminEmailVerify(request({ email: 'owner@example.com', OTP: CODE }))

      expect(response.status).toBe(200)
      expect(cookieHeader(response, 'token')).toContain('Max-Age=28800')
      expect(prismaMock.owner.update).toHaveBeenCalledWith({
         where: { id: 'owner-1' },
         data: { otpHash: null, otpExpiresAt: null, otpAttempts: 0 },
      })
   })

   it('rejects a wrong code', async () => {
      prismaMock.owner.findFirst.mockResolvedValueOnce(challenge({ id: 'owner-1', identifier: 'owner@example.com' }))

      const response = await adminEmailVerify(request({ email: 'owner@example.com', OTP: '000001' }))

      expect(response.status).toBe(401)
      expect(prismaMock.owner.update).not.toHaveBeenCalled()
   })

   it('rejects an unknown owner', async () => {
      const response = await adminEmailVerify(request({ email: 'nobody@example.com', OTP: CODE }))

      expect(response.status).toBe(401)
   })

   it('refuses when a parallel guess already reserved the last attempt', async () => {
      prismaMock.owner.findFirst.mockResolvedValueOnce(challenge({ id: 'owner-1', identifier: 'owner@example.com' }))
      prismaMock.owner.updateMany.mockResolvedValueOnce({ count: 0 })

      const response = await adminEmailVerify(request({ email: 'owner@example.com', OTP: CODE }))

      expect(response.status).toBe(401)
   })

   it('locks out after five failures', async () => {
      for (let index = 0; index < 5; index += 1) {
         prismaMock.owner.findFirst.mockResolvedValueOnce(challenge({ id: 'owner-1', identifier: 'owner@example.com' }))
         await adminEmailVerify(request({ email: 'owner@example.com', OTP: '111111' }))
      }

      expect(await statusOf(adminEmailVerify(request({ email: 'owner@example.com', OTP: CODE })))).toBe(429)
   })

   it('rejects an invalid body', async () => {
      const response = await adminEmailVerify(request({ email: 'owner@example.com', OTP: '1' }))

      expect(response.status).toBe(400)
   })

   it('answers 500 with a generic message for a malformed body', async () => {
      const response = await adminEmailVerify(brokenRequest())

      expect(response.status).toBe(500)
   })

   it('normalises a non-Error rejection to a generic 500', async () => {
      prismaMock.owner.findFirst.mockRejectedValueOnce('boom')

      const response = await adminEmailVerify(request({ email: 'owner@example.com', OTP: CODE }))

      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toMatchObject({ message: 'Internal error' })
   })
})

describe('logout endpoints', () => {
   it.each([
      ['storefront', logout],
      ['admin', adminLogout],
   ])('%s logout clears both cookies and answers JSON', async (_name, handler) => {
      const response = handler()
      const cookies = response.headers.getSetCookie().join(';')

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({
         status: 'success',
         message: 'LOGGED_OUT',
      })
      expect(cookies).toContain('token=')
      expect(cookies).toContain('logged-in=')
   })
})

describe('phone OTP edge paths', () => {
   it('maps a validation error from persistence to 400 on try', async () => {
      prismaMock.user.upsert.mockRejectedValueOnce(await zodError())

      const response = await phoneTry(request({ phone: '09123456789' }))

      expect(response.status).toBe(400)
   })

   it('maps a validation error from persistence to 400 on verify', async () => {
      prismaMock.user.findUnique.mockRejectedValueOnce(await zodError())

      const response = await phoneVerify(request({ phone: '09123456789', OTP: CODE }))

      expect(response.status).toBe(400)
   })

   it('refuses when a parallel guess already reserved the last attempt', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(challenge({ identifier: '09123456789' }))
      prismaMock.user.updateMany.mockResolvedValueOnce({ count: 0 })

      const response = await phoneVerify(request({ phone: '09123456789', OTP: CODE }))

      expect(response.status).toBe(401)
      expect(prismaMock.user.update).not.toHaveBeenCalled()
   })
})

describe('phone verify with an unknown number', () => {
   it('answers 401 without touching any row', async () => {
      const response = await phoneVerify(request({ phone: '09129999999', OTP: CODE }))

      expect(response.status).toBe(401)
      expect(prismaMock.user.updateMany).not.toHaveBeenCalled()
   })
})
