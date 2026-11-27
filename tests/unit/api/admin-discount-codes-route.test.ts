import { DELETE, PATCH } from '@/app/api/admin/codes/[codeId]/route'
import { GET, POST } from '@/app/api/admin/codes/route'
import { call, get, json, prismaMock, silenceConsole, ADMIN } from './helpers'

vi.mock('@/lib/prisma', () =>
   import('../support/db').then((m) => m.prismaModule())
)

const startDate = '2026-11-01T00:00:00.000Z'
const endDate = '2026-12-01T00:00:00.000Z'
const validCode = {
   code: 'winter-20',
   description: 'تخفیف زمستانی',
   percent: 20,
   stock: 50,
   maxDiscountAmount: 500_000,
   startDate,
   endDate,
}

beforeEach(() => {
   silenceConsole()
})

describe('/api/admin/codes', () => {
   it('rejects unauthenticated list and create requests', async () => {
      const getRes = await GET(get())
      const postRes = await POST(json(validCode))
      expect(getRes.status).toBe(401)
      expect(postRes.status).toBe(401)
   })

   it('lists only the admin-facing discount fields without caching', async () => {
      prismaMock.discountCode.findMany.mockResolvedValue([
         { id: 'code-1', code: 'WINTER-20' },
      ])

      const response = await GET(get(ADMIN))

      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('private, no-store')
      expect(prismaMock.discountCode.findMany).toHaveBeenCalledWith(
         expect.objectContaining({
            orderBy: { createdAt: 'desc' },
            select: expect.objectContaining({
               code: true,
               _count: { select: { order: true } },
            }),
         })
      )
   })

   it('normalizes the code and creates a validated discount', async () => {
      prismaMock.discountCode.create.mockResolvedValue({
         id: 'code-1',
         code: 'WINTER-20',
      })

      const response = await POST(json(validCode, ADMIN))

      expect(response.status).toBe(201)
      expect(prismaMock.discountCode.create).toHaveBeenCalledWith(
         expect.objectContaining({
            data: expect.objectContaining({
               code: 'WINTER-20',
               percent: 20,
               startDate: new Date(startDate),
               endDate: new Date(endDate),
            }),
         })
      )
   })

   it.each([
      ['percent above 100', { percent: 101 }],
      ['negative stock', { stock: -1 }],
      ['invalid code characters', { code: 'winter sale' }],
      ['end date before start date', { startDate: endDate, endDate: startDate }],
      ['zero maximum discount', { maxDiscountAmount: 0 }],
   ])('rejects %s', async (_label, patch) => {
      const response = await POST(json({ ...validCode, ...patch }, ADMIN))
      expect(response.status).toBe(400)
   })

   it('returns conflict for a duplicate code', async () => {
      prismaMock.discountCode.create.mockRejectedValue({ code: 'P2002' })

      const response = await POST(json(validCode, ADMIN))

      expect(response.status).toBe(409)
   })

   it('handles GET and POST database failures and optional description', async () => {
      prismaMock.discountCode.findMany.mockRejectedValueOnce(new Error('down'))
      const failedGet = await GET(get(ADMIN))
      expect(failedGet.status).toBe(500)

      prismaMock.discountCode.create.mockResolvedValueOnce({
         id: 'code-2',
         code: 'WINTER-20',
      })
      const createdWithoutDesc = await POST(
         json({ ...validCode, description: undefined }, ADMIN)
      )
      expect(createdWithoutDesc.status).toBe(201)

      prismaMock.discountCode.create.mockRejectedValueOnce(new Error('down'))
      const failedPost = await POST(json(validCode, ADMIN))
      expect(failedPost.status).toBe(500)
   })

   it('rejects malformed JSON', async () => {
      const response = await POST(
         new Request('http://localhost/api/admin/codes', {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...ADMIN },
            body: '{',
         })
      )

      expect(response.status).toBe(400)
   })
})

describe('/api/admin/codes/[codeId]', () => {
   it('rejects an unauthenticated update', async () => {
      const res = await PATCH(json({ stock: 10 }), call({ codeId: 'code-1' }))
      expect(res.status).toBe(401)
   })

   it('updates permitted fields and preserves the date range', async () => {
      prismaMock.discountCode.findUnique.mockResolvedValue({
         id: 'code-1',
         startDate: new Date(startDate),
         endDate: new Date(endDate),
      })
      prismaMock.discountCode.update.mockResolvedValue({
         id: 'code-1',
         stock: 10,
      })

      const response = await PATCH(
         json({ stock: 10 }, ADMIN),
         call({ codeId: 'code-1' })
      )

      expect(response.status).toBe(200)
      expect(prismaMock.discountCode.update).toHaveBeenCalledWith(
         expect.objectContaining({
            where: { id: 'code-1' },
            data: { stock: 10 },
         })
      )
   })

   it('rejects a date range that becomes invalid', async () => {
      prismaMock.discountCode.findUnique.mockResolvedValue({
         id: 'code-1',
         startDate: new Date(startDate),
         endDate: new Date(endDate),
      })

      const response = await PATCH(
         json({ startDate: endDate }, ADMIN),
         call({ codeId: 'code-1' })
      )

      expect(response.status).toBe(400)
   })

   it('returns 404 when the code to update is missing', async () => {
      prismaMock.discountCode.findUnique.mockResolvedValue(null)

      const response = await PATCH(
         json({ stock: 10 }, ADMIN),
         call({ codeId: 'missing' })
      )

      expect(response.status).toBe(404)
   })

   it('prevents deleting a code referenced by an order', async () => {
      prismaMock.discountCode.findUnique.mockResolvedValue({ id: 'code-1' })
      prismaMock.order.count.mockResolvedValue(1)

      const response = await DELETE(get(ADMIN), call({ codeId: 'code-1' }))

      expect(response.status).toBe(409)
      expect(prismaMock.discountCode.delete).not.toHaveBeenCalled()
   })

   it('covers PATCH validation, endDate update, and 500 failure, plus DELETE 401/404/500 paths', async () => {
      const emptyPatch = await PATCH(
         json({}, ADMIN),
         call({ codeId: 'code-1' })
      )
      expect(emptyPatch.status).toBe(400)

      prismaMock.discountCode.findUnique.mockResolvedValueOnce({
         id: 'code-1',
         startDate: new Date(startDate),
         endDate: new Date(endDate),
      })
      prismaMock.discountCode.update.mockResolvedValueOnce({ id: 'code-1' })
      const updatedEnd = await PATCH(
         json({ endDate: '2026-12-15T00:00:00.000Z' }, ADMIN),
         call({ codeId: 'code-1' })
      )
      expect(updatedEnd.status).toBe(200)

      prismaMock.discountCode.findUnique.mockRejectedValueOnce(new Error('down'))
      const failedPatch = await PATCH(
         json({ stock: 5 }, ADMIN),
         call({ codeId: 'code-1' })
      )
      expect(failedPatch.status).toBe(500)

      const unauthDelete = await DELETE(get(), call({ codeId: 'code-1' }))
      expect(unauthDelete.status).toBe(401)

      prismaMock.discountCode.findUnique.mockResolvedValueOnce(null)
      const missingDelete = await DELETE(
         get(ADMIN),
         call({ codeId: 'missing' })
      )
      expect(missingDelete.status).toBe(404)

      prismaMock.discountCode.findUnique.mockRejectedValueOnce(new Error('down'))
      const failedDelete = await DELETE(get(ADMIN), call({ codeId: 'code-1' }))
      expect(failedDelete.status).toBe(500)
   })

   it('deletes an unused code', async () => {
      prismaMock.discountCode.findUnique.mockResolvedValue({ id: 'code-1' })
      prismaMock.order.count.mockResolvedValue(0)
      prismaMock.discountCode.delete.mockResolvedValue({ id: 'code-1' })

      const response = await DELETE(get(ADMIN), call({ codeId: 'code-1' }))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ deleted: true })
   })
})
