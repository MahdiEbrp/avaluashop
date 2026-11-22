import { prismaMock } from '../support/db'

vi.mock('@/lib/prisma', () => import('../support/db').then((m) => m.prismaModule()))

import { PATCH as adminRefundPATCH } from '@/app/api/admin/orders/[orderId]/refund/route'
import { POST as customerRefundPOST } from '@/app/api/orders/[orderId]/refund/route'

const USER = 'user-1'
const ADMIN = 'admin-1'

async function statusOf(promise: Promise<Response>) {
   const response = await promise
   return response.status
}

function call(orderId: string) {
   return { params: Promise.resolve({ orderId }) }
}

function json(body: unknown, userId?: string): Request {
   const headers: Record<string, string> = {
      'content-type': 'application/json',
   }
   if (userId) headers['X-USER-ID'] = userId
   return new Request('http://localhost/api/orders/o1/refund', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
   })
}

describe('POST /api/orders/[orderId]/refund', () => {
   it('requires authentication and a non-empty orderId', async () => {
      expect(await statusOf(customerRefundPOST(json({ reason: 'valid reason' }), call('o1')))).toBe(401)
      expect(
         await statusOf(customerRefundPOST(json({ reason: 'valid reason' }, USER), call('')))
      ).toBe(400)
   })

   it('validates the request payload and returns 404 when the order is not owned by the caller', async () => {
      const badPayload = await customerRefundPOST(
         json({ reason: 'no' }, USER),
         call('o1')
      )
      expect(badPayload.status).toBe(400)

      prismaMock.order.findFirst.mockResolvedValue(null)
      const missing = await customerRefundPOST(
         json({ reason: 'کالای آسیب‌دیده در ارسال' }, USER),
         call('o1')
      )
      expect(missing.status).toBe(404)
   })

   it('rejects duplicate refund requests, unpaid orders, ineligible statuses, and excessive amounts', async () => {
      prismaMock.order.findFirst.mockResolvedValueOnce({
         id: 'o1',
         status: 'Delivered',
         isPaid: true,
         payable: 200,
         refund: { id: 'r1' },
      })
      expect(
         await statusOf(customerRefundPOST(
               json({ reason: 'کالای معیوب است' }, USER),
               call('o1')
            ))
      ).toBe(409)

      prismaMock.order.findFirst.mockResolvedValueOnce({
         id: 'o1',
         status: 'RefundProcessing',
         isPaid: true,
         payable: 200,
         refund: null,
      })
      expect(
         await statusOf(customerRefundPOST(
               json({ reason: 'کالای معیوب است' }, USER),
               call('o1')
            ))
      ).toBe(409)

      prismaMock.order.findFirst.mockResolvedValueOnce({
         id: 'o1',
         status: 'RefundCompleted',
         isPaid: true,
         payable: 200,
         refund: null,
      })
      expect(
         await statusOf(customerRefundPOST(
               json({ reason: 'کالای معیوب است' }, USER),
               call('o1')
            ))
      ).toBe(409)

      prismaMock.order.findFirst.mockResolvedValueOnce({
         id: 'o1',
         status: 'Delivered',
         isPaid: false,
         payable: 200,
         refund: null,
      })
      expect(
         await statusOf(customerRefundPOST(
               json({ reason: 'کالای معیوب است' }, USER),
               call('o1')
            ))
      ).toBe(409)

      prismaMock.order.findFirst.mockResolvedValueOnce({
         id: 'o1',
         status: 'Cancelled',
         isPaid: true,
         payable: 200,
         refund: null,
      })
      expect(
         await statusOf(customerRefundPOST(
               json({ reason: 'کالای معیوب است' }, USER),
               call('o1')
            ))
      ).toBe(409)

      prismaMock.order.findFirst.mockResolvedValueOnce({
         id: 'o1',
         status: 'Delivered',
         isPaid: true,
         payable: 200,
         refund: null,
      })
      expect(
         await statusOf(customerRefundPOST(
               json({ reason: 'کالای معیوب است', amount: 250 }, USER),
               call('o1')
            ))
      ).toBe(400)
   })

   it('creates a refund request and transitions the order to RefundProcessing', async () => {
      prismaMock.order.findFirst.mockResolvedValue({
         id: 'o1',
         status: 'Delivered',
         isPaid: true,
         payable: 200,
         refund: null,
      })
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
      prismaMock.refund.create.mockResolvedValue({
         id: 'ref-1',
         orderId: 'o1',
         amount: 200,
         reason: 'کالای آسیب‌دیده',
         createdAt: new Date('2026-11-21T12:00:00.000Z'),
      })

      const response = await customerRefundPOST(
         json({ reason: '  کالای آسیب‌دیده  ' }, USER),
         call('o1')
      )

      expect(response.status).toBe(201)
      expect(response.headers.get('cache-control')).toBe('private, no-store')
      expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
         where: {
            id: 'o1',
            userId: USER,
            isPaid: true,
            status: 'Delivered',
         },
         data: { status: 'RefundProcessing' },
      })
      expect(prismaMock.refund.create).toHaveBeenCalledWith(
         expect.objectContaining({
            data: {
               orderId: 'o1',
               amount: 200,
               reason: 'کالای آسیب‌دیده',
            },
         })
      )
   })

   it('handles concurrent state conflicts, P2002, and unexpected DB errors', async () => {
      prismaMock.order.findFirst.mockResolvedValue({
         id: 'o1',
         status: 'Delivered',
         isPaid: true,
         payable: 200,
         refund: null,
      })
      prismaMock.order.updateMany.mockResolvedValueOnce({ count: 0 })

      const conflict = await customerRefundPOST(
         json({ reason: 'کالای آسیب‌دیده' }, USER),
         call('o1')
      )
      expect(conflict.status).toBe(409)

      prismaMock.order.updateMany.mockResolvedValueOnce({ count: 1 })
      prismaMock.refund.create.mockRejectedValueOnce(
         Object.assign(new Error('unique'), { code: 'P2002' })
      )
      const uniqueRace = await customerRefundPOST(
         json({ reason: 'کالای آسیب‌دیده' }, USER),
         call('o1')
      )
      expect(uniqueRace.status).toBe(409)

      prismaMock.order.findFirst.mockRejectedValueOnce(new Error('db down'))
      const serverErr = await customerRefundPOST(
         json({ reason: 'کالای آسیب‌دیده' }, USER),
         call('o1')
      )
      expect(serverErr.status).toBe(500)
   })
})

describe('PATCH /api/admin/orders/[orderId]/refund', () => {
   it('requires authentication and validates the decision payload', async () => {
      expect(
         await statusOf(adminRefundPATCH(
               json({ action: 'deny', note: 'رد شد' }),
               call('o1')
            ))
      ).toBe(401)

      expect(
         await statusOf(adminRefundPATCH(
               json({ action: 'complete', note: 'missing confirmation' }, ADMIN),
               call('o1')
            ))
      ).toBe(400)
   })

   it('returns 404 when the order or refund is missing and 409 when not in RefundProcessing', async () => {
      prismaMock.order.findUnique.mockResolvedValueOnce(null)
      expect(
         await statusOf(adminRefundPATCH(
               json({ action: 'deny', note: 'خارج از مهلت' }, ADMIN),
               call('o1')
            ))
      ).toBe(404)

      prismaMock.order.findUnique.mockResolvedValueOnce({
         id: 'o1',
         status: 'Delivered',
         isPaid: true,
         refund: { id: 'r1', amount: 200, reason: 'درخواست مشتری' },
      })
      expect(
         await statusOf(adminRefundPATCH(
               json({ action: 'deny', note: 'خارج از مهلت' }, ADMIN),
               call('o1')
            ))
      ).toBe(409)
   })

   it('completes or denies a refund request with an audit note and handles conflicts/errors', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
         id: 'o1',
         status: 'RefundProcessing',
         isPaid: true,
         refund: { id: 'r1', amount: 200, reason: 'درخواست مشتری' },
      })
      prismaMock.order.updateMany.mockResolvedValueOnce({ count: 1 })
      prismaMock.refund.update.mockResolvedValueOnce({
         id: 'r1',
         orderId: 'o1',
         amount: 200,
         reason: 'درخواست مشتری | [COMPLETED] واریز بانکی انجام شد',
      })

      const completed = await adminRefundPATCH(
         json(
            {
               action: 'complete',
               manualConfirmation: true,
               note: 'واریز بانکی انجام شد',
            },
            ADMIN
         ),
         call('o1')
      )
      expect(completed.status).toBe(200)
      await expect(completed.json()).resolves.toMatchObject({
         orderId: 'o1',
         status: 'RefundCompleted',
      })

      prismaMock.order.updateMany.mockResolvedValueOnce({ count: 1 })
      prismaMock.refund.update.mockResolvedValueOnce({
         id: 'r1',
         orderId: 'o1',
         amount: 200,
         reason: 'درخواست مشتری | [DENIED] کالای بازگشتی تایید نشد',
      })
      const denied = await adminRefundPATCH(
         json({ action: 'deny', note: 'کالای بازگشتی تایید نشد' }, ADMIN),
         call('o1')
      )
      expect(denied.status).toBe(200)
      await expect(denied.json()).resolves.toMatchObject({
         orderId: 'o1',
         status: 'Denied',
      })

      prismaMock.order.updateMany.mockResolvedValueOnce({ count: 0 })
      const conflict = await adminRefundPATCH(
         json({ action: 'deny', note: 'تداخل هم‌زمان' }, ADMIN),
         call('o1')
      )
      expect(conflict.status).toBe(409)

      prismaMock.order.findUnique.mockRejectedValueOnce(new Error('db down'))
      const failure = await adminRefundPATCH(
         json({ action: 'deny', note: 'خطای سرور' }, ADMIN),
         call('o1')
      )
      expect(failure.status).toBe(500)
   })
})
