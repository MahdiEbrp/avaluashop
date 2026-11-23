import { POST as tabapayPOST } from '@/app/api/payments/tabapay/route'
import { GET as tabapayCallbackGET } from '@/app/api/payments/tabapay/callback/route'
import {
   completePendingOrder,
   releasePendingOrder,
} from '@/lib/payments/order-lifecycle'
import {
   createTabapayPayment,
   verifyTabapayPayment,
   validateTabapayConfiguration,
   isTabapayAmountValid,
} from '@/lib/payments/tabapay'
import { get, json, prismaMock, silenceConsole, USER } from './helpers'

vi.mock('@/lib/prisma', () => import('../support/db').then((m) => m.prismaModule()))
vi.mock('@/lib/payments/tabapay', () => ({
   TABAPAY_PROVIDER_CODE: 'tabapay',
   providerSettings: vi.fn(() => ({})),
   createTabapayPayment: vi.fn(),
   verifyTabapayPayment: vi.fn(),
   validateTabapayConfiguration: vi.fn(),
   isTabapayAmountValid: vi.fn(() => true),
}))
vi.mock('@/lib/payments/order-lifecycle', () => ({
   completePendingOrder: vi.fn(),
   releasePendingOrder: vi.fn(),
}))

const order = {
   id: 'order-1',
   number: 42,
   userId: 'user-1',
   payable: 12_000,
   status: 'PendingPayment',
   isPaid: false,
   address: { phone: '09120000000' },
}

beforeEach(() => {
   process.env.APP_URL = 'https://avaluashop.vercel.app'
   vi.mocked(validateTabapayConfiguration).mockReturnValue({} as never)
   vi.mocked(isTabapayAmountValid).mockReturnValue(true)
   silenceConsole()
   prismaMock.order.findFirst.mockResolvedValue(order)
   prismaMock.payment.findFirst.mockResolvedValue(null)
   prismaMock.paymentProvider.findUnique.mockResolvedValue({ id: 'provider-1', isActive: true })
   prismaMock.payment.create.mockResolvedValue({ id: 'payment-1' })
   prismaMock.payment.update.mockResolvedValue({})
   vi.mocked(createTabapayPayment).mockResolvedValue({
      token: 'tabapay-token',
      paymentUrl: 'https://api.tabapay.ir/pay/tabapay-token',
   })
   vi.mocked(verifyTabapayPayment).mockResolvedValue(true)
   vi.mocked(completePendingOrder).mockResolvedValue(true)
   vi.mocked(releasePendingOrder).mockResolvedValue(true)
})

describe('POST /api/payments/tabapay', () => {
   it('requires an authenticated customer', async () => {
      const response = await tabapayPOST(json({ orderId: 'order-1' }))

      expect(response.status).toBe(401)
      expect(createTabapayPayment).not.toHaveBeenCalled()
   })

   it('creates a Tabapay payment using the server-owned order amount in Rial', async () => {
      const response = await tabapayPOST(json({ orderId: 'order-1' }, USER))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({
         paymentUrl: 'https://api.tabapay.ir/pay/tabapay-token',
      })
      expect(prismaMock.$queryRaw).toHaveBeenCalled()
      expect(createTabapayPayment).toHaveBeenCalledWith({
         amountRial: 120_000,
         orderNumber: 42,
         mobile: '09120000000',
      })
      expect(prismaMock.payment.update).toHaveBeenCalledWith({
         where: { id: 'payment-1' },
         data: {
            refId: 'tabapay-token',
            paymentUrl: 'https://api.tabapay.ir/pay/tabapay-token',
         },
      })
   })

   it('rejects a body without an order id', async () => {
      const response = await tabapayPOST(json({}, USER))

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({ message: 'ORDER_ID_REQUIRED' })
      expect(createTabapayPayment).not.toHaveBeenCalled()
   })

   it('ignores a non-string order id', async () => {
      const response = await tabapayPOST(json({ orderId: 42 }, USER))

      expect(response.status).toBe(400)
   })

   it('answers 404 for an order that belongs to someone else', async () => {
      prismaMock.order.findFirst.mockResolvedValue(null)

      const response = await tabapayPOST(json({ orderId: 'order-1' }, USER))

      expect(response.status).toBe(404)
      await expect(response.json()).resolves.toEqual({ message: 'ORDER_NOT_FOUND' })
      /* Ownership is part of the query. */
      expect(prismaMock.order.findFirst).toHaveBeenCalledWith({
         where: { id: 'order-1', userId: 'user-1' },
         include: { address: true },
      })
   })

   it('answers 409 for an order that is already paid', async () => {
      prismaMock.order.findFirst.mockResolvedValue({ ...order, isPaid: true })

      const response = await tabapayPOST(json({ orderId: 'order-1' }, USER))

      expect(response.status).toBe(409)
      await expect(response.json()).resolves.toEqual({ message: 'ORDER_NOT_PAYABLE' })
   })

   it('answers 409 for an order that is not pending payment', async () => {
      prismaMock.order.findFirst.mockResolvedValue({ ...order, status: 'Processing' })

      const tabapayPOSTResult = await tabapayPOST(json({ orderId: 'order-1' }, USER))
      expect(tabapayPOSTResult.status).toBe(409)
   })

   it('re-checks the order under the lock when it changed after the snapshot', async () => {
      /* The snapshot check is only a fast path. Another request can pay or
         cancel the order between that read and the advisory lock, so the
         transaction must re-read and refuse rather than create a payment. */
      prismaMock.order.findFirst
         .mockResolvedValueOnce(order)
         .mockResolvedValueOnce({ ...order, isPaid: true })

      const response = await tabapayPOST(json({ orderId: 'order-1' }, USER))

      expect(response.status).toBe(409)
      await expect(response.json()).resolves.toEqual({ message: 'ORDER_NOT_PAYABLE' })
      expect(prismaMock.order.findFirst).toHaveBeenCalledTimes(2)
      expect(prismaMock.payment.create).not.toHaveBeenCalled()
   })

   it('answers 503 and releases when the gateway loses its configuration mid-request', async () => {
      /* Configuration can disappear between the pre-check and the locked
         section; the row is not created yet, so only the order is released. */
      vi.mocked(validateTabapayConfiguration).mockImplementation(() => {
         throw new Error('TABAPAY_NOT_CONFIGURED')
      })

      const response = await tabapayPOST(json({ orderId: 'order-1' }, USER))

      expect(response.status).toBe(503)
      await expect(response.json()).resolves.toEqual({
         message: 'TABAPAY_NOT_CONFIGURED',
      })
      expect(releasePendingOrder).toHaveBeenCalledWith('order-1')
      expect(prismaMock.payment.create).not.toHaveBeenCalled()
      expect(createTabapayPayment).not.toHaveBeenCalled()
   })

   it('refuses a half-initialized payment instead of starting a second one', async () => {
      prismaMock.payment.findFirst.mockResolvedValue({
         id: 'payment-1',
         refId: 'pending:abc',
         paymentUrl: null,
      })

      const response = await tabapayPOST(json({ orderId: 'order-1' }, USER))

      expect(response.status).toBe(202)
      await expect(response.json()).resolves.toEqual({
         message: 'PAYMENT_ALREADY_INITIALIZED',
      })
      expect(createTabapayPayment).not.toHaveBeenCalled()
   })

   it('does not reuse a placeholder refId that has no redirect yet', async () => {
      prismaMock.payment.findFirst.mockResolvedValue({
         id: 'payment-1',
         refId: 'pending:abc',
         paymentUrl: 'https://api.tabapay.ir/pay/abc',
      })

      /* A `pending:` refId is a row that never finished initializing. */
      const response = await tabapayPOST(json({ orderId: 'order-1' }, USER))

      expect(response.status).toBe(202)
      await expect(response.json()).resolves.toEqual({
         message: 'PAYMENT_ALREADY_INITIALIZED',
      })
   })

   it('answers 503 when no provider row matches the gateway code', async () => {
      prismaMock.paymentProvider.findUnique.mockResolvedValue(null)

      const response = await tabapayPOST(json({ orderId: 'order-1' }, USER))

      expect(response.status).toBe(503)
      await expect(response.json()).resolves.toEqual({ message: 'TABAPAY_NOT_CONFIGURED' })
   })

   it('resolves the provider by its stable code, never by title', async () => {
      await tabapayPOST(json({ orderId: 'order-1' }, USER))

      expect(prismaMock.paymentProvider.findUnique).toHaveBeenCalledWith(
         expect.objectContaining({ where: { code: 'tabapay' } })
      )
      expect(prismaMock.paymentProvider.upsert).not.toHaveBeenCalled()
   })

   it('answers 503 when the provider is switched off', async () => {
      prismaMock.paymentProvider.findUnique.mockResolvedValue({
         id: 'provider-1',
         isActive: false,
      })

      const response = await tabapayPOST(json({ orderId: 'order-1' }, USER))

      expect(response.status).toBe(503)
      await expect(response.json()).resolves.toEqual({
         message: 'PAYMENT_PROVIDER_DISABLED',
      })
   })

   it('answers 400 when the amount is outside the gateway limits', async () => {
      vi.mocked(isTabapayAmountValid).mockReturnValue(false)

      const response = await tabapayPOST(json({ orderId: 'order-1' }, USER))

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
         message: 'TABAPAY_AMOUNT_OUT_OF_RANGE',
      })
      expect(createTabapayPayment).not.toHaveBeenCalled()
   })

   it('keeps the reservation when the gateway create result is ambiguous', async () => {
      vi.mocked(createTabapayPayment).mockRejectedValue(new Error('TABAPAY_HTTP_ERROR'))

      const response = await tabapayPOST(json({ orderId: 'order-1' }, USER))

      expect(response.status).toBe(202)
      await expect(response.json()).resolves.toEqual({
         message: 'PAYMENT_INITIALIZATION_PENDING_RECONCILIATION',
      })
      expect(releasePendingOrder).not.toHaveBeenCalled()
   })

   it('releases the reservation after an explicit gateway rejection', async () => {
      vi.mocked(createTabapayPayment).mockRejectedValue(
         new Error('TABAPAY_CREATE_REJECTED:MERCHANT_INACTIVE')
      )

      const response = await tabapayPOST(json({ orderId: 'order-1' }, USER))

      expect(response.status).toBe(502)
      expect(releasePendingOrder).toHaveBeenCalledWith('order-1', 'payment-1')
   })

   it('tolerates the compensating release failing after an explicit rejection', async () => {
      vi.mocked(createTabapayPayment).mockRejectedValue(
         new Error('TABAPAY_CREATE_REJECTED:MERCHANT_INACTIVE')
      )
      vi.mocked(releasePendingOrder).mockRejectedValue(new Error('release down'))

      const response = await tabapayPOST(json({ orderId: 'order-1' }, USER))

      expect(response.status).toBe(502)
      await expect(response.json()).resolves.toEqual({
         message: 'PAYMENT_INITIALIZATION_FAILED',
      })
      expect(releasePendingOrder).toHaveBeenCalledWith('order-1', 'payment-1')
   })

   it('does not release stock after a gateway timeout, even if reconciliation is needed', async () => {
      vi.mocked(createTabapayPayment).mockRejectedValue(new Error('TABAPAY_HTTP_ERROR'))
      vi.mocked(releasePendingOrder).mockRejectedValue(new Error('release down'))

      const response = await tabapayPOST(json({ orderId: 'order-1' }, USER))

      expect(response.status).toBe(202)
      expect(releasePendingOrder).not.toHaveBeenCalled()
   })

   it('does not attempt a release when the request never named an order', async () => {
      /* An unparseable body leaves `orderId` undefined, so the catch block has
         nothing to compensate. */
      const response = await tabapayPOST(
         new Request('http://localhost/api/payments/tabapay', {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...USER },
            body: 'not json',
         })
      )

      expect(response.status).toBe(502)
      expect(releasePendingOrder).not.toHaveBeenCalled()
   })

   it('reuses an initialized redirect rather than creating a second transaction', async () => {
      prismaMock.payment.findFirst.mockResolvedValue({
         id: 'payment-1',
         refId: 'existing-token',
         paymentUrl: 'https://api.tabapay.ir/pay/existing-token',
      })

      const response = await tabapayPOST(json({ orderId: 'order-1' }, USER))

      await expect(response.json()).resolves.toEqual({
         paymentUrl: 'https://api.tabapay.ir/pay/existing-token',
      })
      expect(createTabapayPayment).not.toHaveBeenCalled()
   })

   it('reuses an existing redirect even if gateway configuration is now missing', async () => {
      prismaMock.payment.findFirst.mockResolvedValue({
         id: 'payment-1',
         refId: 'existing-token',
         paymentUrl: 'https://api.tabapay.ir/pay/existing-token',
      })
      vi.mocked(validateTabapayConfiguration).mockImplementation(() => {
         throw new Error('TABAPAY_NOT_CONFIGURED')
      })

      const response = await tabapayPOST(json({ orderId: 'order-1' }, USER))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({
         paymentUrl: 'https://api.tabapay.ir/pay/existing-token',
      })
      expect(releasePendingOrder).not.toHaveBeenCalled()
      expect(createTabapayPayment).not.toHaveBeenCalled()
   })
})

const callback = () =>
   get(
      {},
      'https://avaluashop.vercel.app/api/payments/tabapay/callback?token=tabapay-token'
   )

describe('GET /api/payments/tabapay/callback', () => {
   it('verifies the exact stored amount before marking an order paid', async () => {
      prismaMock.payment.findUnique.mockResolvedValue({
         id: 'payment-1',
         refId: 'tabapay-token',
         status: 'Processing',
         isSuccessful: false,
         payable: 10_000,
         orderId: 'order-1',
         order: { id: 'order-1' },
      })

      const response = await tabapayCallbackGET(callback())

      expect(response.status).toBe(303)
      expect(response.headers.get('location')).toBe(
         'https://avaluashop.vercel.app/checkout?payment=success&orderId=order-1'
      )
      expect(verifyTabapayPayment).toHaveBeenCalledWith({
         token: 'tabapay-token',
         amountRial: 100_000,
      })
      expect(completePendingOrder).toHaveBeenCalledWith('order-1', 'payment-1')
      expect(releasePendingOrder).not.toHaveBeenCalled()
   })

   it('redirects to a failure page when the token is missing', async () => {
      const response = await tabapayCallbackGET(
         get({}, 'https://avaluashop.vercel.app/api/payments/tabapay/callback')
      )

      expect(response.status).toBe(303)
      expect(response.headers.get('location')).toBe(
         'https://avaluashop.vercel.app/checkout?payment=failed'
      )
   })

   it('rejects an absurdly long token before touching the database', async () => {
      const response = await tabapayCallbackGET(
         get(
            {},
            `https://avaluashop.vercel.app/api/payments/tabapay/callback?token=${'a'.repeat(129)}`
         )
      )

      expect(response.headers.get('location')).toContain('payment=failed')
      expect(prismaMock.payment.findUnique).not.toHaveBeenCalled()
   })

   it('answers 503 rather than redirecting when no origin is configured', async () => {
      delete process.env.APP_URL
      delete process.env.NEXT_PUBLIC_APP_URL
      delete process.env.NEXT_PUBLIC_URL

      const response = await tabapayCallbackGET(
         get(
            {},
            'https://avaluashop.vercel.app/api/payments/tabapay/callback?token=tabapay-token'
         )
      )

      expect(response.status).toBe(503)

      process.env.APP_URL = 'https://avaluashop.vercel.app'
   })

   it('redirects to a failure page for an unknown token', async () => {
      prismaMock.payment.findUnique.mockResolvedValue(null)

      const response = await tabapayCallbackGET(
         get(
            {},
            'https://avaluashop.vercel.app/api/payments/tabapay/callback?token=unknown'
         )
      )

      expect(response.headers.get('location')).toBe(
         'https://avaluashop.vercel.app/checkout?payment=failed'
      )
   })

   it('sends an already-paid callback straight to the receipt', async () => {
      prismaMock.payment.findUnique.mockResolvedValue({
         id: 'payment-1',
         refId: 'tabapay-token',
         status: 'Paid',
         isSuccessful: true,
         payable: 10_000,
         orderId: 'order-1',
         order: { id: 'order-1' },
      })

      const response = await tabapayCallbackGET(
         get(
            {},
            'https://avaluashop.vercel.app/api/payments/tabapay/callback?token=tabapay-token'
         )
      )

      expect(response.headers.get('location')).toBe(
         'https://avaluashop.vercel.app/checkout?payment=success&orderId=order-1'
      )
      expect(verifyTabapayPayment).not.toHaveBeenCalled()
   })

   it('refuses a payment that is no longer processing', async () => {
      prismaMock.payment.findUnique.mockResolvedValue({
         id: 'payment-1',
         refId: 'tabapay-token',
         status: 'Failed',
         isSuccessful: false,
         payable: 10_000,
         orderId: 'order-1',
         order: { id: 'order-1' },
      })

      const response = await tabapayCallbackGET(
         get(
            {},
            'https://avaluashop.vercel.app/api/payments/tabapay/callback?token=tabapay-token'
         )
      )

      expect(response.headers.get('location')).toContain('payment=failed')
      expect(verifyTabapayPayment).not.toHaveBeenCalled()
   })

   it('releases the reserved stock after an explicitly unsuccessful verification', async () => {
      prismaMock.payment.findUnique.mockResolvedValue({
         id: 'payment-1',
         refId: 'tabapay-token',
         status: 'Processing',
         isSuccessful: false,
         payable: 10_000,
         orderId: 'order-1',
         order: { id: 'order-1' },
      })
      vi.mocked(verifyTabapayPayment).mockResolvedValue(false)

      const response = await tabapayCallbackGET(callback())

      expect(response.headers.get('location')).toContain('/checkout?payment=failed')
      expect(releasePendingOrder).toHaveBeenCalledWith('order-1', 'payment-1')
      expect(completePendingOrder).not.toHaveBeenCalled()
   })

   it('does not release stock when verification cannot be reached', async () => {
      prismaMock.payment.findUnique.mockResolvedValue({
         id: 'payment-1',
         refId: 'tabapay-token',
         status: 'Processing',
         isSuccessful: false,
         payable: 10_000,
         orderId: 'order-1',
         order: { id: 'order-1' },
      })
      vi.mocked(verifyTabapayPayment).mockRejectedValue(new Error('network timeout'))

      const response = await tabapayCallbackGET(callback())

      expect(response.headers.get('location')).toContain('/checkout?payment=pending&orderId=order-1')
      expect(releasePendingOrder).not.toHaveBeenCalled()
      expect(completePendingOrder).not.toHaveBeenCalled()
   })

   it('treats a repeated successful callback as already settled', async () => {
      prismaMock.payment.findUnique.mockResolvedValue({
         id: 'payment-1',
         refId: 'tabapay-token',
         status: 'Paid',
         isSuccessful: true,
         payable: 10_000,
         orderId: 'order-1',
         order: { id: 'order-1' },
      })

      const response = await tabapayCallbackGET(callback())

      expect(response.headers.get('location')).toContain('/checkout?payment=success')
      expect(verifyTabapayPayment).not.toHaveBeenCalled()
      expect(completePendingOrder).not.toHaveBeenCalled()
   })
})
