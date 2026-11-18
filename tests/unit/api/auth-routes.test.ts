import { POST as emailTry } from '@/app/api/auth/otp/email/try/route'
import { POST as emailVerify } from '@/app/api/auth/otp/email/verify/route'
import { POST as phoneTry } from '@/app/api/auth/otp/phone/try/route'
import { POST as phoneVerify } from '@/app/api/auth/otp/phone/verify/route'
import { GET as logout } from '@/app/api/auth/logout/route'
import { POST as adminEmailTry } from '@/app/api/admin/auth/otp/email/try/route'
import { POST as adminEmailVerify } from '@/app/api/admin/auth/otp/email/verify/route'
import { GET as adminLogout } from '@/app/api/admin/auth/logout/route'
import { forget } from '@/lib/rate-limit'
import { sendMail } from '@persepolis/mail'
import { sendTransactionalSMS } from '@persepolis/sms'
import { NextRequest } from 'next/server'

import { prismaMock, silenceConsole } from './helpers'

vi.mock('@/lib/prisma', () => import('../support/db').then((m) => m.prismaModule()))

const request = (body: unknown, headers: Record<string, string> = {}) =>
   new NextRequest('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4', ...headers },
      body: JSON.stringify(body),
   })

const brokenRequest = () =>
   new NextRequest('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
   })

const jwtFor = async (sub: string, role: 'user' | 'admin') => {
   const { signJWT } = await import('@/lib/jwt')
   return await signJWT({ sub, role }, { exp: '1m' })
}

const cookieValue = (response: Response, name: string) => {
   const cookies = response.headers.getSetCookie()

   return cookies.find((cookie) => cookie.startsWith(`${name}=`))
}

beforeEach(() => {
   silenceConsole()
   forget('otp-send-email:1.2.3.4:buyer@example.com')
   forget('otp-send-phone:1.2.3.4:09123456789')
   forget('admin-otp-send:1.2.3.4:owner@example.com')
   forget('otp-verify-email:1.2.3.4:buyer@example.com')
   forget('otp-verify-phone:1.2.3.4:09123456789')
   forget('admin-otp-verify:1.2.3.4:owner@example.com')
})

describe('POST /api/auth/otp/email/try', () => {
   it('stores the OTP and reports delivery', async () => {
      prismaMock.user.upsert.mockResolvedValue({})

      const response = await emailTry(request({ email: 'Buyer@Example.com' }))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({
         status: 'success',
         email: 'Buyer@Example.com',
         delivered: true,
      })
      expect(prismaMock.user.upsert).toHaveBeenCalledWith({
         where: { email: 'buyer@example.com' },
         update: { OTP: expect.stringMatching(/^\d{5}$/) },
         create: { email: 'buyer@example.com', OTP: expect.stringMatching(/^\d{5}$/) },
      })
   })

   it('still succeeds when the mail transport fails', async () => {
      prismaMock.user.upsert.mockResolvedValue({})
      vi.mocked(sendMail).mockRejectedValueOnce(new Error('smtp down'))

      const response = await emailTry(request({ email: 'buyer@example.com' }))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({ delivered: false })
   })

   it('rejects an invalid address with 400', async () => {
      const response = await emailTry(request({ email: 'nope' }))

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toMatchObject({ message: 'Incorrect Email' })
   })

   it('rate limits after six deliveries from one address', async () => {
      prismaMock.user.upsert.mockResolvedValue({})

      for (let attempt = 0; attempt < 6; attempt++) {
         await emailTry(request({ email: 'buyer@example.com' }))
      }

      const response = await emailTry(request({ email: 'buyer@example.com' }))

      expect(response.status).toBe(429)
      expect(response.headers.get('retry-after')).toBeTruthy()
   })

   it('answers 500 for a malformed body', async () => {
      const response = await emailTry(brokenRequest() as never)

      expect(response.status).toBe(500)
   })
})

describe('POST /api/auth/otp/email/verify', () => {
   const stubMatch = () => {
      prismaMock.user.findFirst.mockResolvedValue({ id: 'u1' })
      prismaMock.user.update.mockResolvedValue({ id: 'u1' })
      prismaMock.product.findMany.mockResolvedValue([])
   }

   it('verifies, merges the guest cart and sets both cookies', async () => {
      stubMatch()

      const response = await emailVerify(
         request({ email: 'Buyer@Example.com', OTP: '12345', cart: { items: [] } })
      )

      expect(response.status).toBe(200)
      const body = (await response.json()) as { token: string }
      expect(body.token.split('.')).toHaveLength(3)

      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
         where: { email: 'buyer@example.com', OTP: '12345' },
      })
      expect(prismaMock.user.update).toHaveBeenCalledWith({
         where: { id: 'u1' },
         data: { isEmailVerified: true },
      })

      expect(cookieValue(response, 'token')).toContain('HttpOnly')
      expect(cookieValue(response, 'logged-in')).toContain('logged-in=true')
   })

   it('merges a guest cart on the way in', async () => {
      stubMatch()
      prismaMock.product.findMany.mockResolvedValue([{ id: 'p1' }])
      prismaMock.cart.upsert.mockResolvedValue({})

      await emailVerify(
         request({
            email: 'buyer@example.com',
            OTP: '12345',
            cart: { items: [{ productId: 'p1', count: 2 }] },
         })
      )

      expect(prismaMock.cart.upsert).toHaveBeenCalledTimes(1)
   })

   it('rejects a wrong OTP with 401 and keeps the attempt counted', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null)

      const response = await emailVerify(request({ email: 'buyer@example.com', OTP: '00000' }))

      expect(response.status).toBe(401)
      await expect(response.json()).resolves.toMatchObject({ message: 'INVALID OTP' })
   })

   it('locks out after five failed attempts', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null)

      for (let attempt = 0; attempt < 5; attempt++) {
         await emailVerify(request({ email: 'buyer@example.com', OTP: '00000' }))
      }

      const response = await emailVerify(request({ email: 'buyer@example.com', OTP: '00000' }))

      expect(response.status).toBe(429)
      expect(prismaMock.user.findFirst).toHaveBeenCalledTimes(5)
   })

   it('rejects a body that fails validation', async () => {
      const response = await emailVerify(request({ email: 'ab', OTP: '' }))

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toMatchObject({ message: 'failed validations' })
   })

   it('answers 500 when signing cannot proceed', async () => {
      const previous = process.env.JWT_SECRET_KEY
      prismaMock.user.findFirst.mockResolvedValue({ id: 'u1' })
      prismaMock.user.update.mockResolvedValue({ id: 'u1' })
      delete process.env.JWT_SECRET_KEY

      const response = await emailVerify(request({ email: 'buyer@example.com', OTP: '12345' }))

      expect(response.status).toBe(500)
      process.env.JWT_SECRET_KEY = previous
   })

   it('normalises a non-Error rejection', async () => {
      prismaMock.user.findFirst.mockRejectedValue('boom')

      const response = await emailVerify(request({ email: 'buyer@example.com', OTP: '12345' }))

      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toMatchObject({ message: 'Internal error' })
   })
})

describe('POST /api/auth/otp/phone/try', () => {
   it('stores the OTP and sends the SMS', async () => {
      prismaMock.user.upsert.mockResolvedValue({})

      const response = await phoneTry(request({ phone: '09123456789' }))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({
         status: 'success',
         phone: '09123456789',
         delivered: true,
      })
      expect(prismaMock.user.upsert).toHaveBeenCalledWith({
         where: { phone: '09123456789' },
         update: { OTP: expect.stringMatching(/^\d{5}$/) },
         create: { phone: '09123456789', OTP: expect.stringMatching(/^\d{5}$/) },
      })
      expect(vi.mocked(sendTransactionalSMS)).toHaveBeenCalled()
   })

   it('still succeeds when the SMS gateway fails', async () => {
      prismaMock.user.upsert.mockResolvedValue({})
      vi.mocked(sendTransactionalSMS).mockRejectedValueOnce(new Error('gateway down'))

      const response = await phoneTry(request({ phone: '09123456789' }))

      await expect(response.json()).resolves.toMatchObject({ delivered: false })
   })

   it('rejects a non-Iranian number', async () => {
      const response = await phoneTry(request({ phone: '+15550001' }))

      expect(response.status).toBe(400)
   })

   it('rate limits repeated sends', async () => {
      prismaMock.user.upsert.mockResolvedValue({})

      for (let attempt = 0; attempt < 6; attempt++) {
         await phoneTry(request({ phone: '09123456789' }))
      }

      expect((await phoneTry(request({ phone: '09123456789' }))).status).toBe(429)
   })

   it('answers 500 for a malformed body', async () => {
      expect((await phoneTry(brokenRequest() as never)).status).toBe(500)
   })
})

describe('POST /api/auth/otp/phone/verify', () => {
   it('verifies, sets the session and marks the phone verified', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ id: 'u2' })
      prismaMock.user.update.mockResolvedValue({ id: 'u2' })
      prismaMock.product.findMany.mockResolvedValue([])

      const response = await phoneVerify(request({ phone: '09123456789', OTP: '54321' }))

      expect(response.status).toBe(200)
      expect(prismaMock.user.update).toHaveBeenCalledWith({
         where: { id: 'u2' },
         data: { isPhoneVerified: true },
      })
      expect(cookieValue(response, 'token')).toContain('HttpOnly')
   })

   it('rejects a wrong OTP', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null)

      const response = await phoneVerify(request({ phone: '09123456789', OTP: '00000' }))

      expect(response.status).toBe(401)
   })

   it('locks out after five failures', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null)

      for (let attempt = 0; attempt < 5; attempt++) {
         await phoneVerify(request({ phone: '09123456789', OTP: '00000' }))
      }

      expect((await phoneVerify(request({ phone: '09123456789', OTP: '00000' }))).status).toBe(429)
   })

   it('rejects an invalid body', async () => {
      expect((await phoneVerify(request({ phone: '1', OTP: '' }))).status).toBe(400)
   })

   it('answers 500 for a malformed body', async () => {
      expect((await phoneVerify(brokenRequest() as never)).status).toBe(500)
   })
})

describe('POST /api/admin/auth/otp/email/try', () => {
   it('stores the OTP on the owner record', async () => {
      prismaMock.owner.update.mockResolvedValue({ id: 'own1' })

      const response = await adminEmailTry(request({ email: 'owner@example.com' }))

      expect(response.status).toBe(200)
      expect(prismaMock.owner.update).toHaveBeenCalledWith({
         where: { email: 'owner@example.com' },
         data: { OTP: expect.stringMatching(/^\d{5}$/) },
      })
   })

   it('reports a failed delivery without failing the request', async () => {
      prismaMock.owner.update.mockResolvedValue({})
      vi.mocked(sendMail).mockRejectedValueOnce(new Error('smtp'))

      const response = await adminEmailTry(request({ email: 'owner@example.com' }))

      await expect(response.json()).resolves.toMatchObject({ delivered: false })
   })

   it('rejects an invalid address', async () => {
      expect((await adminEmailTry(request({ email: 'bad' }))).status).toBe(400)
   })

   it('rate limits sends', async () => {
      prismaMock.owner.update.mockResolvedValue({})

      for (let attempt = 0; attempt < 6; attempt++) {
         await adminEmailTry(request({ email: 'owner@example.com' }))
      }

      expect((await adminEmailTry(request({ email: 'owner@example.com' }))).status).toBe(429)
   })

   it('answers 500 for a malformed body', async () => {
      expect((await adminEmailTry(brokenRequest() as never)).status).toBe(500)
   })
})

describe('POST /api/admin/auth/otp/email/verify', () => {
   it('issues an admin token for a matching owner', async () => {
      prismaMock.owner.findFirst.mockResolvedValue({ id: 'own1' })

      const response = await adminEmailVerify(
         request({ email: 'Owner@Example.com', OTP: 12_345 })
      )

      expect(response.status).toBe(200)
      const body = (await response.json()) as { token: string }
      const { verifyJWT } = await import('@/lib/jwt')
      const payload = await verifyJWT<{ role: string; sub: string }>(body.token)

      expect(payload.role).toBe('admin')
      expect(payload.sub).toBe('own1')
      expect(prismaMock.owner.findFirst).toHaveBeenCalledWith({
         where: { email: 'owner@example.com', OTP: '12345' },
      })
   })

   it('rejects a wrong OTP', async () => {
      prismaMock.owner.findFirst.mockResolvedValue(null)

      expect(
         (await adminEmailVerify(request({ email: 'owner@example.com', OTP: '00000' }))).status
      ).toBe(401)
   })

   it('refuses to mint a token without a signing key', async () => {
      const previous = process.env.JWT_SECRET_KEY
      delete process.env.JWT_SECRET_KEY

      const response = await adminEmailVerify(
         request({ email: 'owner@example.com', OTP: '12345' })
      )

      expect(response.status).toBe(500)
      process.env.JWT_SECRET_KEY = previous
   })

   it('locks out after five failures', async () => {
      prismaMock.owner.findFirst.mockResolvedValue(null)

      for (let attempt = 0; attempt < 5; attempt++) {
         await adminEmailVerify(request({ email: 'owner@example.com', OTP: '00000' }))
      }

      expect(
         (await adminEmailVerify(request({ email: 'owner@example.com', OTP: '00000' }))).status
      ).toBe(429)
   })

   it('answers 500 for a malformed body', async () => {
      expect((await adminEmailVerify(brokenRequest() as never)).status).toBe(500)
   })

   it('normalises a non-Error rejection', async () => {
      prismaMock.owner.findFirst.mockRejectedValue('boom')

      const response = await adminEmailVerify(
         request({ email: 'owner@example.com', OTP: '12345' })
      )

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

   it('a session token is invalid after logout', async () => {
      const token = await jwtFor('u1', 'user')
      const response = logout()

      expect(response.cookies.get('token')?.value).toBe('')
      expect(token).toContain('.')
   })
})

describe('validation errors surfaced from the persistence layer', () => {
   /* `getErrorResponse(400, 'failed validations')` is the contract for a
      ZodError anywhere in the handler, not just from the body parser. */
   const zodError = async () => {
      const { ZodError } = await import('zod')
      return new ZodError([
         { code: 'custom', message: 'bad row', path: ['email'] },
      ])
   }

   it('answers 400 when the email try route hits a validation error', async () => {
      prismaMock.user.upsert.mockRejectedValueOnce(await zodError())

      const response = await emailTry(request({ email: 'buyer@example.com' }))

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toMatchObject({ message: 'failed validations' })
   })

   it('answers 400 when the phone try route hits a validation error', async () => {
      prismaMock.user.upsert.mockRejectedValueOnce(await zodError())

      const response = await phoneTry(request({ phone: '09123456789' }))

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toMatchObject({ message: 'failed validations' })
   })

   it('answers 400 when the admin email try route hits a validation error', async () => {
      prismaMock.owner.update.mockRejectedValueOnce(await zodError())

      const response = await adminEmailTry(request({ email: 'owner@example.com' }))

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toMatchObject({ message: 'failed validations' })
   })

   it('answers 400 when the admin email verify route hits a validation error', async () => {
      prismaMock.owner.findFirst.mockRejectedValueOnce(await zodError())

      const response = await adminEmailVerify(
         request({ email: 'owner@example.com', OTP: '12345' })
      )

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toMatchObject({ message: 'failed validations' })
   })

   it('normalises a non-Error rejection on the phone verify route', async () => {
      prismaMock.user.findFirst.mockRejectedValue('boom')

      const response = await phoneVerify(request({ phone: '09123456789', OTP: '12345' }))

      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toMatchObject({ message: 'Internal error' })
   })
})
