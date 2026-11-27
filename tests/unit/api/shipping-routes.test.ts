import { DELETE as methodDELETE, PATCH as methodPATCH } from '@/app/api/admin/shipping-methods/[methodId]/route'
import { GET as adminGET, POST as adminPOST } from '@/app/api/admin/shipping-methods/route'
import { GET as shippingGET } from '@/app/api/shipping-methods/route'
import { GET as settingsGET } from '@/app/api/store-settings/route'
import { call, get, json, prismaMock, silenceConsole, ADMIN } from './helpers'

vi.mock('@/lib/prisma', () => import('../support/db').then((m) => m.prismaModule()))

beforeEach(() => { silenceConsole(); })

describe('GET /api/shipping-methods', () => {
   it('returns active methods and only safe carrier fields', async () => {
      prismaMock.shippingMethod.findMany.mockResolvedValue([{
         id: 'sm1',
         code: 'post-standard',
         title: 'پست',
         description: null,
         type: 'FlatRate',
         amount: 30,
         freeAbove: null,
         allowedCities: [],
         carrier: { id: 'c1', code: 'Post', title: 'پست', isActive: false, credentialsEncrypted: 'secret' },
      }])

      const response = await shippingGET(get({}, 'http://localhost/api/shipping-methods?city=تهران'))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body[0]).toMatchObject({ id: 'sm1', available: true, amount: 30 })
      expect(JSON.stringify(body)).not.toContain('credentialsEncrypted')
      expect(prismaMock.shippingMethod.findMany).toHaveBeenCalledWith(
         expect.objectContaining({ where: { isActive: true } })
      )
   })

   it('marks methods outside their city and live carrier quotes as unavailable', async () => {
      prismaMock.shippingMethod.findMany.mockResolvedValue([
         { id: 'sm1', type: 'FlatRate', amount: 10, freeAbove: null, allowedCities: ['تهران'], carrier: null },
         { id: 'sm2', type: 'CarrierCalculated', amount: 0, freeAbove: null, allowedCities: [], carrier: null },
      ])

      const response = await shippingGET(get({}, 'http://localhost/api/shipping-methods?city=کرج'))
      const body = await response.json()

      expect(body[0].unavailableReason).toBe('CITY_NOT_SUPPORTED')
      expect(body[1].unavailableReason).toBe('CARRIER_QUOTE_UNAVAILABLE')
   })

   it('answers 500 when the database is unavailable', async () => {
      prismaMock.shippingMethod.findMany.mockRejectedValue(new Error('down'))
      const shippingGETResult = await shippingGET(get())
      expect(shippingGETResult.status).toBe(500)
   })
})

describe('GET /api/store-settings', () => {
   it('returns persisted tax settings', async () => {
      prismaMock.storeSetting.findUnique.mockResolvedValue({
         taxEnabled: false, taxRate: 0.12, taxLabel: 'مالیات', currency: 'IRT',
      })

      const settingsGETResult = await settingsGET()
      await expect(settingsGETResult.json()).resolves.toEqual({
         taxEnabled: false, taxRate: 0.12, taxLabel: 'مالیات', currency: 'IRT',
      })
   })

   it('returns safe defaults before settings are initialized', async () => {
      prismaMock.storeSetting.findUnique.mockResolvedValue(null)

      const settingsGETResult2 = await settingsGET()
      await expect(settingsGETResult2.json()).resolves.toMatchObject({
         taxEnabled: true, taxRate: 0.09, currency: 'IRT',
      })
   })

   it('answers 500 when the database is unavailable', async () => {
      prismaMock.storeSetting.findUnique.mockRejectedValue(new Error('down'))
      const settingsGETResult3 = await settingsGET()
      expect(settingsGETResult3.status).toBe(500)
   })
})

describe('admin shipping method routes', () => {
   it('requires a verified admin session', async () => {
      const adminGETResult = await adminGET(get())
      expect(adminGETResult.status).toBe(401)
      const adminPOSTResult = await adminPOST(json({}))
      expect(adminPOSTResult.status).toBe(401)
      const methodPATCHResult = await methodPATCH(json({ isActive: false }), call({ methodId: 'sm1' }))
      expect(methodPATCHResult.status).toBe(401)
      const methodDELETEResult = await methodDELETE(get(), call({ methodId: 'sm1' }))
      expect(methodDELETEResult.status).toBe(401)
   })

   it('lists methods in display order', async () => {
      prismaMock.shippingMethod.findMany.mockResolvedValue([{ id: 'sm1' }])
      const adminGETResult2 = await adminGET(get(ADMIN))
      expect(adminGETResult2.status).toBe(200)
      expect(prismaMock.shippingMethod.findMany).toHaveBeenCalledWith(
         expect.objectContaining({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] })
      )
   })

   it('validates and creates a normalized method', async () => {
      prismaMock.shippingMethod.create.mockResolvedValue({ id: 'sm1' })
      const response = await adminPOST(json({
         code: 'post-standard',
         title: 'پست پیشتاز',
         type: 'FlatRate',
         amount: 25_000,
         allowedCities: [' تهران ', 'تهران'],
      }, ADMIN))

      expect(response.status).toBe(201)
      expect(prismaMock.shippingMethod.create).toHaveBeenCalledWith({
         data: expect.objectContaining({
            code: 'post-standard',
            amount: 25_000,
            allowedCities: ['تهران'],
            isActive: true,
            sortOrder: 0,
         }),
      })
   })

   it('rejects invalid or malformed method data', async () => {
      const adminPOSTResult2 = await adminPOST(json({ code: 'Bad Code', title: 'x', type: 'FlatRate', amount: 1 }, ADMIN))
      expect(adminPOSTResult2.status).toBe(400)
      const malformed = new Request('http://localhost/api/admin/shipping-methods', {
         method: 'POST', headers: ADMIN, body: '{',
      })
      const adminPOSTResult3 = await adminPOST(malformed)
      expect(adminPOSTResult3.status).toBe(400)
   })

   it('rejects duplicate codes', async () => {
      prismaMock.shippingMethod.create.mockRejectedValue({ code: 'P2002' })
      const response = await adminPOST(json({
         code: 'post-standard', title: 'پست', type: 'FlatRate', amount: 10,
      }, ADMIN))
      expect(response.status).toBe(409)
   })

   it('patches a method and rejects a missing method', async () => {
      prismaMock.shippingMethod.findUnique.mockResolvedValue({ id: 'sm1', type: 'FlatRate', freeAbove: null })
      prismaMock.shippingMethod.update.mockResolvedValue({ id: 'sm1', isActive: false })
      const response = await methodPATCH(json({ isActive: false }, ADMIN), call({ methodId: 'sm1' }))
      expect(response.status).toBe(200)

      prismaMock.shippingMethod.findUnique.mockResolvedValue(null)
      const methodPATCHResult2 = await methodPATCH(json({ isActive: false }, ADMIN), call({ methodId: 'missing' }))
      expect(methodPATCHResult2.status).toBe(404)
   })

   it('requires a threshold when switching to free-above', async () => {
      prismaMock.shippingMethod.findUnique.mockResolvedValue({ id: 'sm1', type: 'FlatRate', freeAbove: null })
      const methodPATCHResult3 = await methodPATCH(json({ type: 'FreeAbove' }, ADMIN), call({ methodId: 'sm1' }))
      expect(methodPATCHResult3.status).toBe(400)
   })

   it('soft-disables a method so historical orders remain intact', async () => {
      prismaMock.shippingMethod.findUnique.mockResolvedValue({ id: 'sm1' })
      prismaMock.shippingMethod.update.mockResolvedValue({ id: 'sm1', isActive: false })
      const response = await methodDELETE(get(ADMIN), call({ methodId: 'sm1' }))
      expect(response.status).toBe(200)
      expect(prismaMock.shippingMethod.update).toHaveBeenCalledWith({
         where: { id: 'sm1' }, data: { isActive: false },
      })
   })

   it('answers 500 when persistence fails', async () => {
      prismaMock.shippingMethod.findMany.mockRejectedValue(new Error('down'))
      const adminGETResult3 = await adminGET(get(ADMIN))
      expect(adminGETResult3.status).toBe(500)
   })
})
