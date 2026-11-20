import { GET, POST } from '@/app/api/admin/shipping-methods/route'
import { DELETE, PATCH } from '@/app/api/admin/shipping-methods/[methodId]/route'
import { call, get, json, prismaMock, silenceConsole, USER } from './helpers'

vi.mock('@/lib/prisma', () => import('../support/db').then((m) => m.prismaModule()))

const method = {
   id: 'sm1',
   code: 'post-pishtaz',
   title: 'پست پیشتاز',
   description: null,
   type: 'FlatRate',
   amount: 45_000,
   freeAbove: null,
   isActive: true,
   sortOrder: 0,
   allowedCities: [],
   carrierId: null,
}

const validBody = {
   code: 'post-pishtaz',
   title: 'پست پیشتاز',
   type: 'FlatRate',
   amount: 45_000,
}

beforeEach(() => {
   silenceConsole()
   prismaMock.shippingMethod.findMany.mockResolvedValue([method])
   prismaMock.shippingMethod.create.mockResolvedValue(method)
   prismaMock.shippingMethod.findUnique.mockResolvedValue(method)
   prismaMock.shippingMethod.update.mockResolvedValue(method)
})

describe('GET /api/admin/shipping-methods', () => {
   it('rejects a caller without the verified user header', async () => {
      const response = await GET(get())

      expect(response.status).toBe(401)
      await expect(response.json()).resolves.toEqual({ message: 'UNAUTHORIZED' })
   })

   it('lists every method, active or not, with its order count', async () => {
      const response = await GET(get(USER))

      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(prismaMock.shippingMethod.findMany).toHaveBeenCalledWith(
         expect.objectContaining({
            include: expect.objectContaining({ _count: { select: { orders: true } } }),
         })
      )
   })

   it('answers 500 when the list cannot be read', async () => {
      prismaMock.shippingMethod.findMany.mockRejectedValue(new Error('down'))

      const response = await GET(get(USER))

      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toEqual({ message: 'SHIPPING_METHODS_READ_FAILED' })
   })
})

describe('POST /api/admin/shipping-methods', () => {
   it('rejects a caller without the verified user header', async () => {
      const response = await POST(json(validBody))

      expect(response.status).toBe(401)
   })

   it.each([
      ['a missing title', { title: undefined }],
      ['a code with capitals', { code: 'Post-Pishtaz' }],
      ['a negative amount', { amount: -1 }],
      ['an unsupported type', { type: 'Teleport' }],
   ])('rejects %s', async (_label, patch) => {
      const response = await POST(json({ ...validBody, ...patch }, USER))

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({ message: 'INVALID_SHIPPING_METHOD' })
   })

   it('rejects a malformed body', async () => {
      const request = new Request('http://localhost/api/admin/shipping-methods', {
         method: 'POST',
         headers: { 'content-type': 'application/json', ...USER },
         body: '{not json',
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
   })

   it('rejects a free threshold on a type that cannot use it', async () => {
      const response = await POST(json({ ...validBody, freeAbove: 100_000 }, USER))

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
         message: 'FREE_THRESHOLD_NOT_APPLICABLE',
      })
   })

   it('requires a threshold when the type is FreeAbove', async () => {
      const response = await POST(json({ ...validBody, type: 'FreeAbove' }, USER))

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({ message: 'INVALID_SHIPPING_METHOD' })
   })

   it('stores a free method at zero cost', async () => {
      await POST(json({ ...validBody, type: 'Free', amount: 9_000 }, USER))

      expect(prismaMock.shippingMethod.create).toHaveBeenCalledWith({
         data: expect.objectContaining({ amount: 0, freeAbove: null }),
      })
   })

   it('stores a free-above method with its threshold', async () => {
      await POST(json({ ...validBody, type: 'FreeAbove', freeAbove: 500_000 }, USER))

      expect(prismaMock.shippingMethod.create).toHaveBeenCalledWith({
         data: expect.objectContaining({ type: 'FreeAbove', freeAbove: 500_000 }),
      })
   })

   it('deduplicates and trims the allowed cities', async () => {
      await POST(
         json({ ...validBody, allowedCities: [' تهران ', 'تهران', 'کرج'] }, USER)
      )

      expect(prismaMock.shippingMethod.create).toHaveBeenCalledWith({
         data: expect.objectContaining({ allowedCities: ['تهران', 'کرج'] }),
      })
   })

   it('turns an empty description into null', async () => {
      await POST(json({ ...validBody, description: '' }, USER))

      expect(prismaMock.shippingMethod.create).toHaveBeenCalledWith({
         data: expect.objectContaining({ description: null }),
      })
   })

   it('answers 409 when the code is already taken', async () => {
      prismaMock.shippingMethod.create.mockRejectedValue({ code: 'P2002' })

      const response = await POST(json(validBody, USER))

      expect(response.status).toBe(409)
      await expect(response.json()).resolves.toEqual({ message: 'SHIPPING_METHOD_CODE_EXISTS' })
   })

   it('answers 500 for an unexpected failure', async () => {
      prismaMock.shippingMethod.create.mockRejectedValue(new Error('down'))

      const response = await POST(json(validBody, USER))

      expect(response.status).toBe(500)
   })
})

describe('PATCH /api/admin/shipping-methods/[methodId]', () => {
   it('rejects a caller without the verified user header', async () => {
      const response = await PATCH(json({ title: 'جدید' }), call({ methodId: 'sm1' }))

      expect(response.status).toBe(401)
   })

   it('rejects an empty patch', async () => {
      const response = await PATCH(json({}, USER), call({ methodId: 'sm1' }))

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({ message: 'INVALID_SHIPPING_METHOD' })
   })

   it('answers 404 for an unknown method', async () => {
      prismaMock.shippingMethod.findUnique.mockResolvedValue(null)

      const response = await PATCH(json({ title: 'جدید' }, USER), call({ methodId: 'nope' }))

      expect(response.status).toBe(404)
      await expect(response.json()).resolves.toEqual({ message: 'SHIPPING_METHOD_NOT_FOUND' })
   })

   it('updates a title', async () => {
      const response = await PATCH(json({ title: 'جدید' }, USER), call({ methodId: 'sm1' }))

      expect(response.status).toBe(200)
      expect(prismaMock.shippingMethod.update).toHaveBeenCalledWith({
         where: { id: 'sm1' },
         data: expect.objectContaining({ title: 'جدید' }),
      })
   })

   it('requires a threshold when switching to FreeAbove', async () => {
      const response = await PATCH(
         json({ type: 'FreeAbove' }, USER),
         call({ methodId: 'sm1' })
      )

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({ message: 'FREE_THRESHOLD_REQUIRED' })
   })

   it('clears the threshold when leaving FreeAbove', async () => {
      prismaMock.shippingMethod.findUnique.mockResolvedValue({
         ...method,
         type: 'FreeAbove',
         freeAbove: 100_000,
      })

      await PATCH(json({ type: 'FlatRate' }, USER), call({ methodId: 'sm1' }))

      expect(prismaMock.shippingMethod.update).toHaveBeenCalledWith({
         where: { id: 'sm1' },
         data: expect.objectContaining({ freeAbove: null }),
      })
   })

   it('rejects a threshold on a type that cannot use it', async () => {
      const response = await PATCH(json({ freeAbove: 5_000 }, USER), call({ methodId: 'sm1' }))

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
         message: 'FREE_THRESHOLD_NOT_APPLICABLE',
      })
   })

   it('zeroes the amount a method becomes free', async () => {
      await PATCH(json({ type: 'Free' }, USER), call({ methodId: 'sm1' }))

      expect(prismaMock.shippingMethod.update).toHaveBeenCalledWith({
         where: { id: 'sm1' },
         data: expect.objectContaining({ amount: 0 }),
      })
   })

   it('deduplicates the allowed cities', async () => {
      await PATCH(json({ allowedCities: ['تهران', ' تهران '] }, USER), call({ methodId: 'sm1' }))

      expect(prismaMock.shippingMethod.update).toHaveBeenCalledWith({
         where: { id: 'sm1' },
         data: expect.objectContaining({ allowedCities: ['تهران'] }),
      })
   })

   it('answers 409 when the new code is taken', async () => {
      prismaMock.shippingMethod.update.mockRejectedValue({ code: 'P2002' })

      const response = await PATCH(json({ code: 'taken' }, USER), call({ methodId: 'sm1' }))

      expect(response.status).toBe(409)
   })

   it('answers 500 for an unexpected failure', async () => {
      prismaMock.shippingMethod.update.mockRejectedValue(new Error('down'))

      const response = await PATCH(json({ title: 'جدید' }, USER), call({ methodId: 'sm1' }))

      expect(response.status).toBe(500)
   })

   it('answers 400 for a malformed body', async () => {
      const request = new Request('http://localhost/api/admin/shipping-methods/sm1', {
         method: 'PATCH',
         headers: { 'content-type': 'application/json', ...USER },
         body: '{not json',
      })

      const response = await PATCH(request, call({ methodId: 'sm1' }))

      expect(response.status).toBe(400)
   })
})

describe('DELETE /api/admin/shipping-methods/[methodId]', () => {
   it('rejects a caller without the verified user header', async () => {
      const response = await DELETE(get(), call({ methodId: 'sm1' }))

      expect(response.status).toBe(401)
   })

   it('answers 404 for an unknown method', async () => {
      prismaMock.shippingMethod.findUnique.mockResolvedValue(null)

      const response = await DELETE(get(USER), call({ methodId: 'nope' }))

      expect(response.status).toBe(404)
   })

   it('disables instead of deleting so old orders keep their method', async () => {
      const response = await DELETE(get(USER), call({ methodId: 'sm1' }))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({ deleted: true })
      expect(prismaMock.shippingMethod.update).toHaveBeenCalledWith({
         where: { id: 'sm1' },
         data: { isActive: false },
      })
      expect(prismaMock.shippingMethod.delete).not.toHaveBeenCalled()
   })

   it('answers 500 when the disable fails', async () => {
      prismaMock.shippingMethod.update.mockRejectedValue(new Error('down'))

      const response = await DELETE(get(USER), call({ methodId: 'sm1' }))

      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toEqual({ message: 'SHIPPING_METHOD_DELETE_FAILED' })
   })
})
