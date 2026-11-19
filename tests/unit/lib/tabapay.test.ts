import { createTabapayPayment, verifyTabapayPayment } from '@/lib/payments/tabapay'

const merchantKey = 'test-merchant-key'

beforeEach(() => {
   process.env.TABAPAY_MERCHANT_KEY = merchantKey
   process.env.TABAPAY_SANDBOX = 'true'
   process.env.APP_URL = 'https://avaluashop.vercel.app'
})

afterEach(() => {
   delete process.env.TABAPAY_MERCHANT_KEY
   delete process.env.TABAPAY_SANDBOX
   delete process.env.APP_URL
   vi.unstubAllGlobals()
})

describe('Tabapay adapter', () => {
   it('creates a sandbox transaction in Rial and returns only a trusted HTTPS URL', async () => {
      const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
         new Response(
            JSON.stringify({
               responseCode: 1,
               status: 'success',
               token: 'tabapay-token-1',
               url: 'https://api.tabapay.ir/sandbox/pay/tabapay-token-1',
            }),
            { status: 200 }
         )
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

   it('refuses to run without a merchant key', async () => {
      delete process.env.TABAPAY_MERCHANT_KEY

      await expect(
         createTabapayPayment({ amountRial: 250_000, orderNumber: 1 })
      ).rejects.toThrow('TABAPAY_NOT_CONFIGURED')
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

      const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
         new Response(
            JSON.stringify({
               responseCode: 1,
               status: 'success',
               token: 't1',
               url: 'https://api.tabapay.ir/pay/t1',
            }),
            { status: 200 }
         )
      )
      vi.stubGlobal('fetch', fetchMock)

      await createTabapayPayment({ amountRial: 250_000, orderNumber: 1 })

      const form = fetchMock.mock.calls[0][1]?.body as FormData
      expect(form.get('callbackURL')).toBe(
         'https://avaluashop.vercel.app/api/payments/tabapay/callback'
      )
      delete process.env.NEXT_PUBLIC_APP_URL
   })

   it('uses the live endpoints when the sandbox flag is explicitly off', async () => {
      process.env.TABAPAY_SANDBOX = 'false'
      const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
         new Response(
            JSON.stringify({
               responseCode: 1,
               status: 'success',
               token: 't1',
               url: 'https://api.tabapay.ir/pay/t1',
            }),
            { status: 200 }
         )
      )
      vi.stubGlobal('fetch', fetchMock)

      await createTabapayPayment({ amountRial: 250_000, orderNumber: 1 })

      expect(fetchMock.mock.calls[0][0]).toBe('https://api.tabapay.ir/v1/create')
   })

   it('defaults to sandbox when the flag is absent', async () => {
      delete process.env.TABAPAY_SANDBOX
      const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
         new Response(
            JSON.stringify({
               responseCode: 1,
               status: 'success',
               token: 't1',
               url: 'https://api.tabapay.ir/pay/t1',
            }),
            { status: 200 }
         )
      )
      vi.stubGlobal('fetch', fetchMock)

      await createTabapayPayment({ amountRial: 250_000, orderNumber: 1 })

      expect(fetchMock.mock.calls[0][0]).toBe(
         'https://api.tabapay.ir/v1/sandbox/create'
      )
   })

   it('omits the mobile field when the number is not Iranian', async () => {
      const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
         new Response(
            JSON.stringify({
               responseCode: 1,
               status: 'success',
               token: 't1',
               url: 'https://api.tabapay.ir/pay/t1',
            }),
            { status: 200 }
         )
      )
      vi.stubGlobal('fetch', fetchMock)

      await createTabapayPayment({
         amountRial: 250_000,
         orderNumber: 1,
         mobile: '+1 555 0100',
      })

      const form = fetchMock.mock.calls[0][1]?.body as FormData
      expect(form.get('mobile')).toBeNull()
   })

   it('surfaces a non-2xx gateway response', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })))

      await expect(
         createTabapayPayment({ amountRial: 250_000, orderNumber: 1 })
      ).rejects.toThrow('TABAPAY_HTTP_ERROR')
   })

   it('reports the gateway message when creation fails', async () => {
      vi.stubGlobal(
         'fetch',
         vi.fn(async () =>
            new Response(
               JSON.stringify({ status: 'failed', message: 'MERCHANT_INACTIVE' }),
               { status: 200 }
            )
         )
      )

      await expect(
         createTabapayPayment({ amountRial: 250_000, orderNumber: 1 })
      ).rejects.toThrow('MERCHANT_INACTIVE')
   })

   it('falls back to a generic message when creation fails without one', async () => {
      vi.stubGlobal(
         'fetch',
         vi.fn(async () =>
            new Response(JSON.stringify({ status: 'failed' }), { status: 200 })
         )
      )

      await expect(
         createTabapayPayment({ amountRial: 250_000, orderNumber: 1 })
      ).rejects.toThrow('TABAPAY_CREATE_FAILED')
   })

   it.each([
      ['plain http', 'http://api.tabapay.ir/pay/t1'],
      ['a foreign host', 'https://evil.example.com/pay/t1'],
   ])('rejects a payment URL on %s', async (_label, url) => {
      vi.stubGlobal(
         'fetch',
         vi.fn(async () =>
            new Response(
               JSON.stringify({
                  responseCode: 1,
                  status: 'success',
                  token: 't1',
                  url,
               }),
               { status: 200 }
            )
         )
      )

      await expect(
         createTabapayPayment({ amountRial: 250_000, orderNumber: 1 })
      ).rejects.toThrow('TABAPAY_INVALID_PAYMENT_URL')
   })

   it('rejects amounts outside Tabapay limits without making a request', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      await expect(
         createTabapayPayment({ amountRial: 99_999, orderNumber: 1 })
      ).rejects.toThrow('TABAPAY_AMOUNT_OUT_OF_RANGE')
      expect(fetchMock).not.toHaveBeenCalled()
   })

   it('rejects a payment URL outside the Tabapay HTTPS host', async () => {
      vi.stubGlobal(
         'fetch',
         vi.fn(async () =>
            new Response(
               JSON.stringify({
                  responseCode: 1,
                  status: 'success',
                  token: 'tabapay-token-1',
                  url: 'https://evil.example/pay',
               }),
               { status: 200 }
            )
         )
      )

      await expect(
         createTabapayPayment({ amountRial: 100_000, orderNumber: 1 })
      ).rejects.toThrow('TABAPAY_INVALID_PAYMENT_URL')
   })

   it('accepts only a successful verification with the exact token and amount', async () => {
      vi.stubGlobal(
         'fetch',
         vi.fn(async () =>
            new Response(
               JSON.stringify({
                  responseCode: 1,
                  status: 'success',
                  token: 'tabapay-token-1',
                  amount: 100_000,
               }),
               { status: 200 }
            )
         )
      )

      await expect(
         verifyTabapayPayment({ token: 'tabapay-token-1', amountRial: 100_000 })
      ).resolves.toBe(true)
   })

   it('treats a successful but mismatched verification as a reconciliation case', async () => {
      vi.stubGlobal(
         'fetch',
         vi.fn(async () =>
            new Response(
               JSON.stringify({
                  responseCode: 1,
                  status: 'success',
                  token: 'another-token',
                  amount: 100_000,
               }),
               { status: 200 }
            )
         )
      )

      await expect(
         verifyTabapayPayment({ token: 'tabapay-token-1', amountRial: 100_000 })
      ).rejects.toThrow('TABAPAY_VERIFICATION_MISMATCH')
   })

   it('returns false for an explicit unsuccessful transaction', async () => {
      vi.stubGlobal(
         'fetch',
         vi.fn(async () =>
            new Response(
               JSON.stringify({
                  responseCode: -101,
                  status: 'error',
                  token: 'tabapay-token-1',
                  amount: 100_000,
               }),
               { status: 200 }
            )
         )
      )

      await expect(
         verifyTabapayPayment({ token: 'tabapay-token-1', amountRial: 100_000 })
      ).resolves.toBe(false)
   })
})
