import { POST as tabapayPOST } from '@/app/api/payments/tabapay/route'
import { GET as tabapayCallbackGET } from '@/app/api/payments/tabapay/callback/route'
import {
   completePendingOrder,
   releasePendingOrder,
} from '@/lib/payments/order-lifecycle'
import {
   createTabapayPayment,
   verifyTabapayPayment,
} from '@/lib/payments/tabapay'
import { get, json, prismaMock, silenceConsole, USER } from './helpers'

vi.mock('@/lib/prisma', () => import('../support/db').then((m) => m.prismaModule()))
vi.mock('@/lib/payments/tabapay', () => ({
   createTabapayPayment: vi.fn(),
   verifyTabapayPayment: vi.fn(),
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
   silenceConsole()
   prismaMock.order.findFirst.mockResolvedValue(order)
   prismaMock.payment.findFirst.mockResolvedValue(null)
   prismaMock.paymentProvider.upsert.mockResolvedValue({ id: 'provider-1', isActive: true })
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
})

describe('GET /api/payments/tabapay/callback', () => {
   const callback = () =>
      get(
         {},
         'https://avaluashop.vercel.app/api/payments/tabapay/callback?token=tabapay-token'
      )

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
         'https://avaluashop.vercel.app/checkout?payment=success'
      )
      expect(verifyTabapayPayment).toHaveBeenCalledWith({
         token: 'tabapay-token',
         amountRial: 100_000,
      })
      expect(completePendingOrder).toHaveBeenCalledWith('order-1', 'payment-1')
      expect(releasePendingOrder).not.toHaveBeenCalled()
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

      expect(response.headers.get('location')).toContain('/checkout?payment=pending')
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
