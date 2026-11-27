import { GET, PUT } from '@/app/api/admin/settings/route'
import { encryptSettingSecret } from '@/lib/settings-crypto'
import { get, json, prismaMock, silenceConsole, ADMIN } from './helpers'

vi.mock('@/lib/prisma', () => import('../support/db').then((m) => m.prismaModule()))

const store = {
   id: 'default',
   taxEnabled: true,
   taxRate: 0.09,
   taxLabel: 'مالیات بر ارزش افزوده',
   currency: 'IRT',
}

const validBody = {
   taxEnabled: true,
   taxRate: 0.09,
   taxLabel: 'مالیات',
   currency: 'IRT',
   gatewayActive: false,
   sandbox: true,
}

function providerRow(overrides: Record<string, unknown> = {}) {
   return {
      id: 'provider-1',
      code: 'tabapay',
      title: 'TabaPay',
      isActive: true,
      settings: { sandbox: true },
      credentialsEncrypted: encryptSettingSecret('merchant-key'),
      ...overrides,
   }
}

interface SettingsBody {
   gateway: Record<string, string | boolean>
   taxRate: number
   taxEnabled: boolean
   taxLabel: string
   currency: string
}

async function settingsOf(response: Response) {
   return (await response.json()) as SettingsBody
}

async function messageOf(response: Response) {
   const body = (await response.json()) as { message: string }
   return body.message
}

beforeEach(() => {
   process.env.APP_SETTINGS_ENCRYPTION_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
   silenceConsole()
   prismaMock.storeSetting.upsert.mockResolvedValue(store)
   prismaMock.paymentProvider.findUnique.mockResolvedValue(providerRow())
   prismaMock.paymentProvider.findFirst.mockResolvedValue(null)
   prismaMock.paymentProvider.update.mockResolvedValue(
      providerRow({ isActive: false, credentialsEncrypted: encryptSettingSecret('k') })
   )
   prismaMock.paymentProvider.create.mockResolvedValue(
      providerRow({ isActive: true, credentialsEncrypted: encryptSettingSecret('k') })
   )
   prismaMock.payment.count.mockResolvedValue(0)
})

afterEach(() => {
   delete process.env.APP_SETTINGS_ENCRYPTION_KEY
})

describe('GET /api/admin/settings', () => {
   it('rejects a request without the verified user header', async () => {
      const response = await GET(get())

      expect(response.status).toBe(401)
      await expect(response.json()).resolves.toEqual({ message: 'UNAUTHORIZED' })
   })

   it('reports tax as a percentage and the gateway without any secret', async () => {
      const response = await GET(get(ADMIN))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body).toEqual({
         taxEnabled: true,
         taxRate: 9,
         taxLabel: 'مالیات بر ارزش افزوده',
         currency: 'IRT',
         gateway: {
            code: 'tabapay',
            title: 'TabaPay',
            isActive: true,
            sandbox: true,
            credentialsConfigured: true,
         },
      })
      /* The ciphertext itself must never reach the browser. */
      expect(JSON.stringify(body)).not.toContain('v1.')
   })

   it('creates the singleton row on first read', async () => {
      await GET(get(ADMIN))

      expect(prismaMock.storeSetting.upsert).toHaveBeenCalledWith(
         expect.objectContaining({ where: { id: 'default' } })
      )
   })

   it('falls back to defaults when no gateway row exists yet', async () => {
      prismaMock.paymentProvider.findUnique.mockResolvedValue(null)

      const body = await settingsOf(await GET(get(ADMIN)))

      expect(body.gateway).toEqual({
         code: 'tabapay',
         title: 'TabaPay',
         isActive: false,
         sandbox: true,
         credentialsConfigured: false,
      })
   })

   it('adopts a legacy row that has no code yet', async () => {
      prismaMock.paymentProvider.findUnique.mockResolvedValue(null)
      prismaMock.paymentProvider.findFirst.mockResolvedValue(
         providerRow({ code: null, title: 'Tabapay' })
      )

      const body = await settingsOf(await GET(get(ADMIN)))

      expect(prismaMock.paymentProvider.findFirst).toHaveBeenCalledWith(
         expect.objectContaining({ where: { title: { in: ['TabaPay', 'Tabapay'] } } })
      )
      expect(body.gateway.title).toBe('Tabapay')
      expect(body.gateway.credentialsConfigured).toBe(true)
   })

   it('reports stored isActive even when the credential cannot be decrypted', async () => {
      /* Masking it made saving the page silently deactivate the gateway. */
      prismaMock.paymentProvider.findUnique.mockResolvedValue(
         providerRow({ credentialsEncrypted: 'v1.AAAA.BBBB.CCCC' })
      )

      const body = await settingsOf(await GET(get(ADMIN)))

      expect(body.gateway.isActive).toBe(true)
      expect(body.gateway.credentialsConfigured).toBe(false)
   })

   it('treats a missing credential blob as not configured', async () => {
      prismaMock.paymentProvider.findUnique.mockResolvedValue(
         providerRow({ credentialsEncrypted: null })
      )

      const body = await settingsOf(await GET(get(ADMIN)))

      expect(body.gateway.credentialsConfigured).toBe(false)
   })

   it('reports sandbox off when the stored setting says so', async () => {
      prismaMock.paymentProvider.findUnique.mockResolvedValue(
         providerRow({ settings: { sandbox: false } })
      )

      const body = await settingsOf(await GET(get(ADMIN)))

      expect(body.gateway.sandbox).toBe(false)
   })

   it('reports sandbox on when settings is not an object', async () => {
      prismaMock.paymentProvider.findUnique.mockResolvedValue(
         providerRow({ settings: [] })
      )

      const body = await settingsOf(await GET(get(ADMIN)))

      expect(body.gateway.sandbox).toBe(true)
   })

   it('answers 500 when the store row cannot be read', async () => {
      prismaMock.storeSetting.upsert.mockRejectedValue(new Error('db down'))

      const response = await GET(get(ADMIN))

      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toEqual({ message: 'SETTINGS_READ_FAILED' })
   })
})

describe('PUT /api/admin/settings', () => {
   it('rejects a request without the verified user header', async () => {
      const response = await PUT(json(validBody))

      expect(response.status).toBe(401)
      await expect(response.json()).resolves.toEqual({ message: 'UNAUTHORIZED' })
   })

   it.each([
      ['a tax rate above 1', { taxRate: 9 }],
      ['a negative tax rate', { taxRate: -0.1 }],
      ['an empty tax label', { taxLabel: ' '.repeat(3) }],
      ['an unsupported currency', { currency: 'USD' }],
      ['a missing gateway flag', { gatewayActive: undefined }],
   ])('rejects %s', async (_label, patch) => {
      const response = await PUT(json({ ...validBody, ...patch }, ADMIN))

      expect(response.status).toBe(400)
      expect(await messageOf(response)).toBe('INVALID_SETTINGS')
   })

   it('saves tax settings and merges the gateway settings object', async () => {
      prismaMock.paymentProvider.findUnique.mockResolvedValue(
         providerRow({ settings: { sandbox: true, extra: 'kept' } })
      )

      const response = await PUT(json({ ...validBody, sandbox: false }, ADMIN))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({
         saved: true,
         gatewayActive: false,
         credentialsConfigured: true,
      })
      expect(prismaMock.storeSetting.upsert).toHaveBeenCalledWith(
         expect.objectContaining({
            where: { id: 'default' },
            update: expect.objectContaining({ taxRate: 0.09, taxLabel: 'مالیات' }),
         })
      )
      expect(prismaMock.paymentProvider.update).toHaveBeenCalledWith(
         expect.objectContaining({
            where: { id: 'provider-1' },
            data: expect.objectContaining({
               code: 'tabapay',
               settings: { sandbox: false, extra: 'kept' },
            }),
         })
      )
   })

   it('encrypts a new merchant key and stamps the update time', async () => {
      await PUT(json({ ...validBody, gatewayActive: true, merchantKey: 'new-key' }, ADMIN))

      const call = prismaMock.paymentProvider.update.mock.calls[0][0] as {
         data: { credentialsEncrypted: string; credentialsUpdatedAt: Date }
      }

      expect(call.data.credentialsEncrypted.startsWith('v1.')).toBe(true)
      expect(call.data.credentialsEncrypted).not.toContain('new-key')
      expect(call.data.credentialsUpdatedAt).toBeInstanceOf(Date)
   })

   it('creates the provider row on first save', async () => {
      prismaMock.paymentProvider.findUnique.mockResolvedValue(null)
      prismaMock.paymentProvider.findFirst.mockResolvedValue(null)

      const response = await PUT(json({ ...validBody, gatewayActive: true, merchantKey: 'k' }, ADMIN))

      expect(response.status).toBe(200)
      expect(prismaMock.paymentProvider.create).toHaveBeenCalledWith(
         expect.objectContaining({
            data: expect.objectContaining({
               code: 'tabapay',
               title: 'TabaPay',
               isActive: true,
            }),
         })
      )
      expect(prismaMock.paymentProvider.update).not.toHaveBeenCalled()
   })

   it('adopts a legacy row instead of creating a duplicate', async () => {
      prismaMock.paymentProvider.findUnique.mockResolvedValue(null)
      prismaMock.paymentProvider.findFirst.mockResolvedValue(providerRow({ code: null }))

      await PUT(json({ ...validBody, merchantKey: 'k' }, ADMIN))

      expect(prismaMock.paymentProvider.update).toHaveBeenCalled()
      expect(prismaMock.paymentProvider.create).not.toHaveBeenCalled()
   })

   it('refuses to enable the gateway without readable credentials', async () => {
      prismaMock.paymentProvider.findUnique.mockResolvedValue(
         providerRow({ credentialsEncrypted: null })
      )

      const response = await PUT(json({ ...validBody, gatewayActive: true }, ADMIN))

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
         message: 'GATEWAY_CREDENTIALS_REQUIRED_OR_ENCRYPTION_KEY_INVALID',
      })
   })

   it('refuses to enable the gateway when the encryption key is missing', async () => {
      delete process.env.APP_SETTINGS_ENCRYPTION_KEY

      const response = await PUT(json({ ...validBody, merchantKey: 'k' }, ADMIN))

      expect(response.status).toBe(503)
      await expect(response.json()).resolves.toEqual({
         message: 'APP_SETTINGS_ENCRYPTION_KEY_REQUIRED',
      })
   })

   it('refuses to enable the gateway when the stored key no longer decrypts', async () => {
      prismaMock.paymentProvider.findUnique.mockResolvedValue(
         providerRow({ credentialsEncrypted: 'v1.AAAA.BBBB.CCCC' })
      )

      const response = await PUT(json({ ...validBody, gatewayActive: true }, ADMIN))

      expect(response.status).toBe(400)
   })

   it('blocks a gateway change while recent payments are still processing', async () => {
      prismaMock.payment.count.mockResolvedValue(2)

      const response = await PUT(json({ ...validBody, sandbox: false }, ADMIN))

      expect(response.status).toBe(409)
      await expect(response.json()).resolves.toEqual({
         message: 'GATEWAY_HAS_PENDING_TRANSACTIONS',
      })
      expect(prismaMock.paymentProvider.update).not.toHaveBeenCalled()
   })

   it('counts only recent processing payments so an abandoned one cannot freeze settings', async () => {
      await PUT(json({ ...validBody, sandbox: false }, ADMIN))

      const guard = prismaMock.payment.count.mock.calls[0][0] as {
         where: { status: string; createdAt: { gte: Date } }
      }

      expect(guard.where.status).toBe('Processing')
      expect(guard.where.createdAt.gte).toBeInstanceOf(Date)
   })

   it('skips the guard when nothing about the gateway changed', async () => {
      /* Body matches the stored row exactly, so no gateway field moved. */
      await PUT(json({ ...validBody, gatewayActive: true }, ADMIN))

      expect(prismaMock.payment.count).not.toHaveBeenCalled()
   })

   it('compares against an inactive default when no provider row exists', async () => {
      /* No existing row and nothing else changed: the `?? false` fallback is
         what decides the comparison. */
      prismaMock.paymentProvider.findUnique.mockResolvedValue(null)
      prismaMock.paymentProvider.findFirst.mockResolvedValue(null)

      await PUT(json(validBody, ADMIN))

      expect(prismaMock.payment.count).not.toHaveBeenCalled()
   })

   it('skips the guard when no provider row exists yet', async () => {
      prismaMock.paymentProvider.findUnique.mockResolvedValue(null)
      prismaMock.paymentProvider.findFirst.mockResolvedValue(null)

      await PUT(json({ ...validBody, sandbox: false }, ADMIN))

      expect(prismaMock.payment.count).not.toHaveBeenCalled()
   })

   it('answers 500 when the write transaction fails', async () => {
      prismaMock.paymentProvider.update.mockRejectedValue(new Error('db down'))

      const response = await PUT(json(validBody, ADMIN))

      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toEqual({ message: 'SETTINGS_SAVE_FAILED' })
   })

   it('answers 400 when the request body is not JSON', async () => {
      /* A malformed body must not surface as a server error. */
      const request = new Request('http://localhost/api/admin/settings', {
         method: 'PUT',
         headers: { 'content-type': 'application/json', ...ADMIN },
         body: '{not json',
      })

      const response = await PUT(request)

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({ message: 'INVALID_SETTINGS' })
   })
})
