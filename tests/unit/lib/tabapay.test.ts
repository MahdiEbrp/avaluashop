import {
   TABAPAY_PROVIDER_CODE,
   createTabapayPayment,
   providerSettings,
   validateTabapayConfiguration,
   verifyTabapayPayment,
} from '@/lib/payments/tabapay'
import { encryptSettingSecret } from '@/lib/settings-crypto'
import { prismaMock, resetPrismaMock } from '../support/db'

vi.mock('@/lib/prisma', () => import('../support/db').then((m) => m.prismaModule()))

const merchantKey = 'test-merchant-key'

function providerRow(overrides: Record<string, unknown> = {}) {
   return {
      isActive: true,
      settings: { sandbox: true },
      credentialsEncrypted: encryptSettingSecret(merchantKey),
      ...overrides,
   }
}

function gatewayResponse(body: unknown) {
   return Response.json(body)
}

beforeEach(() => {
   process.env.APP_SETTINGS_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString('base64')
   process.env.APP_URL = 'https://avaluashop.vercel.app'
   resetPrismaMock()
   prismaMock.paymentProvider.findUnique.mockResolvedValue(providerRow())
})

afterEach(() => {
   delete process.env.APP_SETTINGS_ENCRYPTION_KEY
   delete process.env.APP_URL
   delete process.env.NEXT_PUBLIC_APP_URL
   vi.unstubAllGlobals()
})

describe('Tabapay adapter configuration', () => {
   it('resolves the gateway by its stable code', async () => {
      await validateTabapayConfiguration()

      expect(prismaMock.paymentProvider.findUnique).toHaveBeenCalledWith(
         expect.objectContaining({ where: { code: TABAPAY_PROVIDER_CODE } })
      )
   })

   it('refuses to run when no provider row exists', async () => {
      prismaMock.paymentProvider.findUnique.mockResolvedValue(null)

      await expect(
         createTabapayPayment({ amountRial: 250_000, orderNumber: 1 })
      ).rejects.toThrow('TABAPAY_NOT_CONFIGURED')
   })

   it('refuses to run when the provider holds no credentials', async () => {
      prismaMock.paymentProvider.findUnique.mockResolvedValue(
         providerRow({ credentialsEncrypted: null })
      )

      await expect(
         createTabapayPayment({ amountRial: 250_000, orderNumber: 1 })
      ).rejects.toThrow('TABAPAY_NOT_CONFIGURED')
   })

   it('refuses to start new payments while the provider is switched off', async () => {
      prismaMock.paymentProvider.findUnique.mockResolvedValue(
         providerRow({ isActive: false })
      )

      await expect(validateTabapayConfiguration()).rejects.toThrow(
         'PAYMENT_PROVIDER_DISABLED'
      )
   })

   it('still settles in-flight payments after the provider is switched off', async () => {
      /* Verification must not be blocked by `isActive`: the callback has to
         finish or release a reservation that already exists. */
      prismaMock.paymentProvider.findUnique.mockResolvedValue(
         providerRow({ isActive: false })
      )
      vi.stubGlobal(
         'fetch',
         vi.fn(() =>
            gatewayResponse({
               responseCode: 1,
               status: 'success',
               token: 'tabapay-token-1',
               amount: 100_000,
            })
         )
      )

      await expect(
         verifyTabapayPayment({ token: 'tabapay-token-1', amountRial: 100_000 })
      ).resolves.toBe(true)
   })

   it('surfaces an unreadable credential blob without contacting the gateway', async () => {
      prismaMock.paymentProvider.findUnique.mockResolvedValue(
         providerRow({ credentialsEncrypted: 'v1.AAAA.BBBB.CCCC' })
      )
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      await expect(
         createTabapayPayment({ amountRial: 250_000, orderNumber: 1 })
      ).rejects.toThrow()
      expect(fetchMock).not.toHaveBeenCalled()
   })

   it('refuses to run without an application URL', async () => {
      /* All three fallbacks have to be clear before the config gives up. */
      delete process.env.APP_URL
      delete process.env.NEXT_PUBLIC_APP_URL
      delete process.env.NEXT_PUBLIC_URL

      await expect(
         createTabapayPayment({ amountRial: 250_000, orderNumber: 1 })
      ).rejects.toThrow('APP_URL_NOT_CONFIGURED')
   })

   it('falls back to the public URL variables and strips a trailing slash', async () => {
      delete process.env.APP_URL
      process.env.NEXT_PUBLIC_APP_URL = 'https://avaluashop.vercel.app/'
      const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
         gatewayResponse({
            responseCode: 1,
            status: 'success',
            token: 't1',
            url: 'https://api.tabapay.ir/pay/t1',
         })
      )
      vi.stubGlobal('fetch', fetchMock)

      await createTabapayPayment({ amountRial: 250_000, orderNumber: 1 })

      const form = fetchMock.mock.calls[0][1]?.body as FormData
      expect(form.get('callbackURL')).toBe(
         'https://avaluashop.vercel.app/api/payments/tabapay/callback'
      )
   })

   it('uses the live endpoints when sandbox is explicitly off in the database', async () => {
      prismaMock.paymentProvider.findUnique.mockResolvedValue(
         providerRow({ settings: { sandbox: false } })
      )
      const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
         gatewayResponse({
            responseCode: 1,
            status: 'success',
            token: 't1',
            url: 'https://api.tabapay.ir/pay/t1',
         })
      )
      vi.stubGlobal('fetch', fetchMock)

      await createTabapayPayment({ amountRial: 250_000, orderNumber: 1 })

      expect(fetchMock.mock.calls[0][0]).toBe('https://api.tabapay.ir/v1/create')
   })

   it.each([
      ['null', null],
      ['an array', []],
      ['a string', 'sandbox'],
   ])('defaults to sandbox when settings is %s', async (_label, settings) => {
      prismaMock.paymentProvider.findUnique.mockResolvedValue(
         providerRow({ settings })
      )
      const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
         gatewayResponse({
            responseCode: 1,
            status: 'success',
            token: 't1',
            url: 'https://api.tabapay.ir/pay/t1',
         })
      )
      vi.stubGlobal('fetch', fetchMock)

      await createTabapayPayment({ amountRial: 250_000, orderNumber: 1 })

      expect(fetchMock.mock.calls[0][0]).toBe(
         'https://api.tabapay.ir/v1/sandbox/create'
      )
   })

   it('reads known keys out of a free-form settings object', () => {
      expect(providerSettings({ sandbox: false, other: 'kept' })).toEqual({
         sandbox: false,
         other: 'kept',
      })
   })
})

describe('Tabapay adapter', () => {
   it('creates a sandbox transaction in Rial and returns only a trusted HTTPS URL', async () => {
      const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
         gatewayResponse({
            responseCode: 1,
            status: 'success',
            token: 'tabapay-token-1',
            url: 'https://api.tabapay.ir/sandbox/pay/tabapay-token-1',
         })
      )
      vi.stubGlobal('fetch', fetchMock)

      await expect(
         createTabapayPayment({ amountRial: 250_000, orderNumber: 42, mobile: '09120000000' })
      ).resolves.toEqual({
         token: 'tabapay-token-1',
         paymentUrl: 'https://api.tabapay.ir/sandbox/pay/tabapay-token-1',
      })

      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://api.tabapay.ir/v1/sandbox/create')
      expect(new Headers(init?.headers).get('authorization')).toBe(
         `Bearer ${merchantKey}`
      )
      const form = init?.body as FormData
      expect(form.get('amount')).toBe('250000')
      expect(form.get('callbackURL')).toBe(
         'https://avaluashop.vercel.app/api/payments/tabapay/callback'
      )
      expect(form.get('mobile')).toBe('09120000000')
   })

   it('omits the mobile field when the number is not Iranian', async () => {
      const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
         gatewayResponse({
            responseCode: 1,
            status: 'success',
            token: 't1',
            url: 'https://api.tabapay.ir/pay/t1',
         })
      )
      vi.stubGlobal('fetch', fetchMock)

      await createTabapayPayment({ amountRial: 250_000, orderNumber: 1, mobile: '+1 555 0100' })

      const form = fetchMock.mock.calls[0][1]?.body as FormData
      expect(form.get('mobile')).toBeNull()
   })

   it('surfaces a non-2xx gateway response', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Response.json({ message: 'boom' }, { status: 500 })))

      await expect(
         createTabapayPayment({ amountRial: 250_000, orderNumber: 1 })
      ).rejects.toThrow('TABAPAY_HTTP_ERROR')
   })

   it('reports the gateway message when creation fails', async () => {
      vi.stubGlobal(
         'fetch',
         vi.fn(() => gatewayResponse({ status: 'failed', message: 'MERCHANT_INACTIVE' }))
      )

      await expect(
         createTabapayPayment({ amountRial: 250_000, orderNumber: 1 })
      ).rejects.toThrow('MERCHANT_INACTIVE')
   })

   it('falls back to a generic message when creation fails without one', async () => {
      vi.stubGlobal('fetch', vi.fn(() => gatewayResponse({ status: 'failed' })))

      await expect(
         createTabapayPayment({ amountRial: 250_000, orderNumber: 1 })
      ).rejects.toThrow('TABAPAY_CREATE_FAILED')
   })

   it('reports an unconfirmed create result separately from an explicit rejection', async () => {
      /* `responseCode` 0 means the gateway neither confirmed nor rejected, so
         the caller keeps the reservation instead of releasing stock. */
      vi.stubGlobal(
         'fetch',
         vi.fn(() =>
            gatewayResponse({ status: 'success', responseCode: 0, token: 't1' })
         )
      )

      await expect(
         createTabapayPayment({ amountRial: 250_000, orderNumber: 1 })
      ).rejects.toThrow('TABAPAY_CREATE_UNCONFIRMED')
   })

   it('rejects amounts outside Tabapay limits without making a request', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      await expect(
         createTabapayPayment({ amountRial: 99_999, orderNumber: 1 })
      ).rejects.toThrow('TABAPAY_AMOUNT_OUT_OF_RANGE')
      expect(fetchMock).not.toHaveBeenCalled()
   })

   it.each([
      // eslint-disable-next-line sonarjs/no-clear-text-protocols, unicorn/prefer-https -- the adapter must reject a non-HTTPS URL
      ['plain http', 'http://api.tabapay.ir/pay/t1'],
      ['a foreign host', 'https://evil.example.com/pay/t1'],
   ])('rejects a payment URL on %s', async (_label, url) => {
      vi.stubGlobal(
         'fetch',
         vi.fn(() =>
            gatewayResponse({ responseCode: 1, status: 'success', token: 't1', url })
         )
      )

      await expect(
         createTabapayPayment({ amountRial: 250_000, orderNumber: 1 })
      ).rejects.toThrow('TABAPAY_INVALID_PAYMENT_URL')
   })

   it('accepts only a successful verification with the exact token and amount', async () => {
      vi.stubGlobal(
         'fetch',
         vi.fn(() =>
            gatewayResponse({
               responseCode: 1,
               status: 'success',
               token: 'tabapay-token-1',
               amount: 100_000,
            })
         )
      )

      await expect(
         verifyTabapayPayment({ token: 'tabapay-token-1', amountRial: 100_000 })
      ).resolves.toBe(true)
   })

   it('treats a successful but mismatched verification as a reconciliation case', async () => {
      vi.stubGlobal(
         'fetch',
         vi.fn(() =>
            gatewayResponse({
               responseCode: 1,
               status: 'success',
               token: 'another-token',
               amount: 100_000,
            })
         )
      )

      await expect(
         verifyTabapayPayment({ token: 'tabapay-token-1', amountRial: 100_000 })
      ).rejects.toThrow('TABAPAY_VERIFICATION_MISMATCH')
   })

   it('keeps ambiguous verification responses pending for reconciliation', async () => {
      vi.stubGlobal(
         'fetch',
         vi.fn(() =>
            gatewayResponse({
               responseCode: -101,
               status: 'error',
               token: 'tabapay-token-1',
               amount: 100_000,
            })
         )
      )

      await expect(
         verifyTabapayPayment({ token: 'tabapay-token-1', amountRial: 100_000 })
      ).rejects.toThrow('TABAPAY_VERIFICATION_UNCONFIRMED')
   })

   it('returns false for an explicit unsuccessful transaction', async () => {
      vi.stubGlobal(
         'fetch',
         vi.fn(() =>
            gatewayResponse({
               responseCode: -101,
               status: 'failed',
               token: 'tabapay-token-1',
               amount: 100_000,
            })
         )
      )

      await expect(
         verifyTabapayPayment({ token: 'tabapay-token-1', amountRial: 100_000 })
      ).resolves.toBe(false)
   })
})
