import { GET } from '@/app/api/orders/[orderId]/route'
import { prismaMock } from '../support/db'

vi.mock('@/lib/prisma', () => import('../support/db').then((m) => m.prismaModule()))

describe('customer order detail API', () => {
   it('requires authentication', async () => {
      const response = await GET(
         new Request('http://localhost/api/orders/order-1'),
         { params: Promise.resolve({ orderId: 'order-1' }) }
      )

      expect(response.status).toBe(401)
      expect(prismaMock.order.findFirst).not.toHaveBeenCalled()
   })

   it('returns order tracking and summary fields only for the owning customer', async () => {
      prismaMock.order.findFirst.mockResolvedValue({
         id: 'order-1',
         number: 12,
         status: 'Shipped',
         isPaid: true,
         payable: 250000,
         shipping: 30000,
         createdAt: new Date('2026-01-01T00:00:00.000Z'),
         shippingTrackingNumber: 'TRACK-123',
         shippingCarrierName: 'پست',
         shippingMethodName: 'ارسال عادی',
         orderItems: [{ count: 1, price: 220000, discount: 0, product: { title: 'کیف' } }],
      })

      const response = await GET(
         new Request('http://localhost/api/orders/order-1', {
            headers: { 'X-USER-ID': 'user-1' },
         }),
         { params: Promise.resolve({ orderId: 'order-1' }) }
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('Cache-Control')).toBe('private, no-store')
      expect(prismaMock.order.findFirst).toHaveBeenCalledWith({
         where: { userId: 'user-1', id: 'order-1' },
         select: expect.objectContaining({
            number: true,
            isPaid: true,
            payable: true,
            orderItems: expect.any(Object),
         }),
      })
   })

   it('returns 404 for an order outside the current user scope', async () => {
      prismaMock.order.findFirst.mockResolvedValue(null)

      const response = await GET(
         new Request('http://localhost/api/orders/order-2', {
            headers: { 'X-USER-ID': 'user-1' },
         }),
         { params: Promise.resolve({ orderId: 'order-2' }) }
      )

      expect(response.status).toBe(404)
   })
})
