import { prismaMock } from '../support/db'

vi.mock('@/lib/prisma', () => import('../support/db').then((m) => m.prismaModule()))

import { POST as reconcilePOST } from '@/app/api/internal/orders/reconcile-pending/route'
import { reconcilePendingOrders } from '@/lib/payments/reconcile-pending-orders'

const VALID_SECRET = 'super-secret-cron-token-123456'

function makeRequest(
   body?: string,
   headers: Record<string, string> = {}
): Request {
   return new Request('http://localhost/api/internal/orders/reconcile-pending', {
      method: 'POST',
      headers,
      body,
   })
}

describe('reconcilePendingOrders & POST /api/internal/orders/reconcile-pending', () => {
   const originalSecret = process.env.CRON_SECRET

   afterEach(() => {
      if (originalSecret === undefined) {
         delete process.env.CRON_SECRET
      } else {
         process.env.CRON_SECRET = originalSecret
      }
   })

   it('returns 503 when CRON_SECRET is missing or too short', async () => {
      delete process.env.CRON_SECRET

      const response = await reconcilePOST(
         makeRequest('', { authorization: `Bearer ${VALID_SECRET}` })
      )

      expect(response.status).toBe(503)
      await expect(response.json()).resolves.toEqual({
         message: 'CRON_SECRET_NOT_CONFIGURED',
      })
   })

   it('returns 401 when the secret header is missing, wrong length, or mismatched', async () => {
      process.env.CRON_SECRET = VALID_SECRET

      const missing = await reconcilePOST(makeRequest(''))
      expect(missing.status).toBe(401)

      const wrongLength = await reconcilePOST(
         makeRequest('', { 'x-cron-secret': 'short-secret-12345' })
      )
      expect(wrongLength.status).toBe(401)

      const mismatch = await reconcilePOST(
         makeRequest('', {
            authorization: 'Bearer super-secret-cron-token-999999',
         })
      )
      expect(mismatch.status).toBe(401)
   })

   it('rejects malformed JSON or non-object bodies with 400', async () => {
      process.env.CRON_SECRET = VALID_SECRET

      const badJson = await reconcilePOST(
         makeRequest('{bad', { 'x-cron-secret': VALID_SECRET })
      )
      expect(badJson.status).toBe(400)

      const arrayBody = await reconcilePOST(
         makeRequest('[]', { 'x-cron-secret': VALID_SECRET })
      )
      expect(arrayBody.status).toBe(400)

      const outOfRange = await reconcilePOST(
         makeRequest(JSON.stringify({ expiryMinutes: 2 }), {
            'x-cron-secret': VALID_SECRET,
         })
      )
      expect(outOfRange.status).toBe(400)
   })

   it('releases stale uninitialized and pending: reservations while skipping paid and real-token orders', async () => {
      process.env.CRON_SECRET = VALID_SECRET
      const now = new Date('2026-11-21T12:00:00.000Z')

      prismaMock.order.findMany.mockResolvedValue([
         {
            id: 'o-no-payment',
            isPaid: false,
            payments: [],
         },
         {
            id: 'o-stale-local',
            isPaid: false,
            payments: [
               {
                  id: 'pay-local',
                  status: 'Processing',
                  isSuccessful: false,
                  refId: 'pending:pay-local',
               },
            ],
         },
         {
            id: 'o-race-already-cancelled',
            isPaid: false,
            payments: [],
         },
         {
            id: 'o-paid-flag',
            isPaid: true,
            payments: [],
         },
         {
            id: 'o-paid-payment',
            isPaid: false,
            payments: [
               {
                  id: 'pay-paid',
                  status: 'Paid',
                  isSuccessful: true,
                  refId: 'tok-paid',
               },
            ],
         },
         {
            id: 'o-status-paid-only',
            isPaid: false,
            payments: [
               {
                  id: 'pay-status-paid',
                  status: 'Paid',
                  isSuccessful: false,
                  refId: 'tok-status-paid',
               },
            ],
         },
         {
            id: 'o-provider-token',
            isPaid: false,
            payments: [
               {
                  id: 'pay-flight',
                  status: 'Processing',
                  isSuccessful: false,
                  refId: 'tabapay-token-123',
               },
            ],
         },
      ])

      prismaMock.order.findUnique
         .mockResolvedValueOnce({
            id: 'o-no-payment',
            isPaid: false,
            status: 'PendingPayment',
            discountCodeId: null,
            orderItems: [{ productId: 'p1', count: 2 }],
         })
         .mockResolvedValueOnce({
            id: 'o-stale-local',
            isPaid: false,
            status: 'PendingPayment',
            discountCodeId: 'dc1',
            orderItems: [{ productId: 'p2', count: 1 }],
         })
         .mockResolvedValueOnce({
            id: 'o-race-already-cancelled',
            isPaid: false,
            status: 'Cancelled',
            discountCodeId: null,
            orderItems: [],
         })

      prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
      prismaMock.payment.updateMany.mockResolvedValue({ count: 1 })

      const result = await reconcilePendingOrders({
         now,
         expiryMinutes: 30,
         limit: 25,
      })

      expect(result).toEqual({
         cutoffIso: '2026-11-21T11:30:00.000Z',
         scannedCount: 7,
         releasedOrderIds: ['o-no-payment', 'o-stale-local'],
         skippedPaidOrderIds: [
            'o-paid-flag',
            'o-paid-payment',
            'o-status-paid-only',
         ],
         manualReconciliationOrderIds: ['o-provider-token'],
      })

      const apiResponse = await reconcilePOST(
         makeRequest('', { authorization: `Bearer ${VALID_SECRET}` })
      )
      expect(apiResponse.status).toBe(200)
   })

   it('returns 500 when the database fails during reconciliation', async () => {
      process.env.CRON_SECRET = VALID_SECRET
      prismaMock.order.findMany.mockRejectedValue(new Error('db failure'))

      const response = await reconcilePOST(
         makeRequest(JSON.stringify({ expiryMinutes: 30, limit: 10 }), {
            'x-cron-secret': VALID_SECRET,
         })
      )

      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toEqual({
         message: 'INTERNAL_ERROR',
      })
   })
})

describe('GET /api/internal/orders/reconcile-pending (Vercel Cron)', () => {
   it('runs the same bearer-authenticated handler as POST', async () => {
      const { GET: reconcileGET } = await import('@/app/api/internal/orders/reconcile-pending/route')

      expect(reconcileGET).toBe(reconcilePOST)

      vi.stubEnv('CRON_SECRET', 'x'.repeat(16))
      const response = await reconcileGET(
         new Request('http://localhost/api/internal/orders/reconcile-pending', {
            method: 'GET',
            headers: { authorization: `Bearer ${'y'.repeat(16)}` },
         })
      )

      expect(response.status).toBe(401)
      vi.unstubAllEnvs()
   })
})
