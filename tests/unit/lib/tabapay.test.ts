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
      const fetchMock = vi.fn(async () =>
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
