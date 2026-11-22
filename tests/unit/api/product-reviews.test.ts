import { prismaMock } from '../support/db'

vi.mock('@/lib/prisma', () =>
   import('../support/db').then((m) => m.prismaModule())
)

import {
   DELETE as reviewsDELETE,
   GET as reviewsGET,
   POST as reviewsPOST,
} from '@/app/api/products/[productId]/reviews/route'

const USER = 'user-1'

async function statusOf(promise: Promise<Response>) {
   const response = await promise
   return response.status
}

function call(productId: string) {
   return { params: Promise.resolve({ productId }) }
}

function getReq(userId?: string): Request {
   const headers: Record<string, string> = {}
   if (userId) headers['X-USER-ID'] = userId
   return new Request('http://localhost/api/products/p1/reviews', { headers })
}

function jsonReq(body: unknown, userId?: string): Request {
   const headers: Record<string, string> = {
      'content-type': 'application/json',
   }
   if (userId) headers['X-USER-ID'] = userId
   return new Request('http://localhost/api/products/p1/reviews', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
   })
}

describe('/api/products/[productId]/reviews', () => {
   it('GET validates productId, computes summary, and handles empty or error states', async () => {
      expect(await statusOf(reviewsGET(getReq(), call('')))).toBe(400)

      prismaMock.productReview.findMany.mockResolvedValueOnce([])
      const emptyRes = await reviewsGET(getReq(), call('p1'))
      expect(emptyRes.status).toBe(200)
      await expect(emptyRes.json()).resolves.toEqual({
         reviews: [],
         summary: { count: 0, averageRating: 0 },
      })

      prismaMock.productReview.findMany.mockResolvedValueOnce([
         {
            id: 'rev1',
            rating: 5,
            text: 'عالی بود',
            createdAt: new Date('2026-11-21T10:00:00.000Z'),
            user: { name: 'سارا' },
         },
         {
            id: 'rev2',
            rating: 4,
            text: 'خوب بود',
            createdAt: new Date('2026-11-20T10:00:00.000Z'),
            user: { name: 'علی' },
         },
      ])
      const populated = await reviewsGET(getReq(), call('p1'))
      expect(populated.status).toBe(200)
      await expect(populated.json()).resolves.toMatchObject({
         summary: { count: 2, averageRating: 4.5 },
      })

      prismaMock.productReview.findMany.mockRejectedValueOnce(new Error('down'))
      expect(await statusOf(reviewsGET(getReq(), call('p1')))).toBe(500)
   })

   it('POST enforces auth, productId, payload bounds, product existence, verified purchase, and uniqueness', async () => {
      expect(
         await statusOf(
            reviewsPOST(jsonReq({ rating: 5, text: 'عالی' }), call('p1'))
         )
      ).toBe(401)
      expect(
         await statusOf(
            reviewsPOST(jsonReq({ rating: 5, text: 'عالی' }, USER), call(''))
         )
      ).toBe(400)
      expect(
         await statusOf(
            reviewsPOST(jsonReq({ rating: 6, text: 'no' }, USER), call('p1'))
         )
      ).toBe(400)

      prismaMock.product.findUnique.mockResolvedValueOnce(null)
      expect(
         await statusOf(
            reviewsPOST(
               jsonReq({ rating: 5, text: 'کیفیت ساخت بالا' }, USER),
               call('p1')
            )
         )
      ).toBe(404)

      prismaMock.product.findUnique.mockResolvedValue({ id: 'p1' })
      prismaMock.order.findFirst.mockResolvedValueOnce(null)
      const unverified = await reviewsPOST(
         jsonReq({ rating: 5, text: 'کیفیت ساخت بالا' }, USER),
         call('p1')
      )
      expect(unverified.status).toBe(403)
      await expect(unverified.json()).resolves.toEqual({
         message: 'VERIFIED_PURCHASE_REQUIRED',
      })

      prismaMock.order.findFirst.mockResolvedValue({ id: 'o1' })
      prismaMock.productReview.findUnique.mockResolvedValueOnce({
         id: 'rev-existing',
      })
      const duplicate = await reviewsPOST(
         jsonReq({ rating: 5, text: 'کیفیت ساخت بالا' }, USER),
         call('p1')
      )
      expect(duplicate.status).toBe(409)

      prismaMock.productReview.findUnique.mockResolvedValue(null)
      prismaMock.productReview.create.mockResolvedValueOnce({
         id: 'rev-new',
         productId: 'p1',
         rating: 5,
         text: 'کیفیت ساخت بالا',
         createdAt: new Date('2026-11-21T12:00:00.000Z'),
      })
      const created = await reviewsPOST(
         jsonReq({ rating: 5, text: '  کیفیت ساخت بالا  ' }, USER),
         call('p1')
      )
      expect(created.status).toBe(201)

      prismaMock.productReview.create.mockRejectedValueOnce(
         Object.assign(new Error('unique'), { code: 'P2002' })
      )
      expect(
         await statusOf(
            reviewsPOST(
               jsonReq({ rating: 5, text: 'کیفیت ساخت بالا' }, USER),
               call('p1')
            )
         )
      ).toBe(409)

      prismaMock.productReview.create.mockRejectedValueOnce(
         new Error('db down')
      )
      expect(
         await statusOf(
            reviewsPOST(
               jsonReq({ rating: 5, text: 'کیفیت ساخت بالا' }, USER),
               call('p1')
            )
         )
      ).toBe(500)
   })

   it('DELETE enforces auth, productId, ownership 404, success, and 500 error', async () => {
      expect(await statusOf(reviewsDELETE(getReq(), call('p1')))).toBe(401)
      expect(await statusOf(reviewsDELETE(getReq(USER), call('')))).toBe(400)

      prismaMock.productReview.deleteMany.mockResolvedValueOnce({ count: 0 })
      expect(await statusOf(reviewsDELETE(getReq(USER), call('p1')))).toBe(404)

      prismaMock.productReview.deleteMany.mockResolvedValueOnce({ count: 1 })
      const deleted = await reviewsDELETE(getReq(USER), call('p1'))
      expect(deleted.status).toBe(200)
      await expect(deleted.json()).resolves.toEqual({ deleted: true })

      prismaMock.productReview.deleteMany.mockRejectedValueOnce(
         new Error('db down')
      )
      expect(await statusOf(reviewsDELETE(getReq(USER), call('p1')))).toBe(500)
   })
})
