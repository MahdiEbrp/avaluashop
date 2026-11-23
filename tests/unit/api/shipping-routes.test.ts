import { DELETE as methodDELETE, PATCH as methodPATCH } from '@/app/api/admin/shipping-methods/[methodId]/route'
import { GET as adminGET, POST as adminPOST } from '@/app/api/admin/shipping-methods/route'
import { GET as shippingGET } from '@/app/api/shipping-methods/route'
import { GET as settingsGET } from '@/app/api/store-settings/route'
import { call, get, json, prismaMock, silenceConsole, USER } from './helpers'

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
      expect((await shippingGET(get())).status).toBe(500)
   })
})

describe('GET /api/store-settings', () => {
   it('returns persisted tax settings', async () => {
      prismaMock.storeSetting.findUnique.mockResolvedValue({
         taxEnabled: false, taxRate: 0.12, taxLabel: 'مالیات', currency: 'IRT',
      })

      await expect((await settingsGET()).json()).resolves.toEqual({
         taxEnabled: false, taxRate: 0.12, taxLabel: 'مالیات', currency: 'IRT',
      })
   })

   it('returns safe defaults before settings are initialized', async () => {
      prismaMock.storeSetting.findUnique.mockResolvedValue(null)

      await expect((await settingsGET()).json()).resolves.toMatchObject({
         taxEnabled: true, taxRate: 0.09, currency: 'IRT',
      })
   })

   it('answers 500 when the database is unavailable', async () => {
      prismaMock.storeSetting.findUnique.mockRejectedValue(new Error('down'))
      expect((await settingsGET()).status).toBe(500)
   })
})

describe('admin shipping method routes', () => {
   it('requires a verified admin session', async () => {
      expect((await adminGET(get())).status).toBe(401)
      expect((await adminPOST(json({}))).status).toBe(401)
      expect((await methodPATCH(json({ isActive: false }), call({ methodId: 'sm1' }))).status).toBe(401)
      expect((await methodDELETE(get(), call({ methodId: 'sm1' }))).status).toBe(401)
   })

   it('lists methods in display order', async () => {
      prismaMock.shippingMethod.findMany.mockResolvedValue([{ id: 'sm1' }])
      expect((await adminGET(get(USER))).status).toBe(200)
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
      }, USER))

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
      expect((await adminPOST(json({ code: 'Bad Code', title: 'x', type: 'FlatRate', amount: 1 }, USER))).status).toBe(400)
      const malformed = new Request('http://localhost/api/admin/shipping-methods', {
         method: 'POST', headers: USER, body: '{',
      })
      expect((await adminPOST(malformed)).status).toBe(400)
   })

   it('rejects duplicate codes', async () => {
      prismaMock.shippingMethod.create.mockRejectedValue({ code: 'P2002' })
      const response = await adminPOST(json({
         code: 'post-standard', title: 'پست', type: 'FlatRate', amount: 10,
      }, USER))
      expect(response.status).toBe(409)
   })

   it('patches a method and rejects a missing method', async () => {
      prismaMock.shippingMethod.findUnique.mockResolvedValue({ id: 'sm1', type: 'FlatRate', freeAbove: null })
      prismaMock.shippingMethod.update.mockResolvedValue({ id: 'sm1', isActive: false })
      const response = await methodPATCH(json({ isActive: false }, USER), call({ methodId: 'sm1' }))
      expect(response.status).toBe(200)

      prismaMock.shippingMethod.findUnique.mockResolvedValue(null)
      expect((await methodPATCH(json({ isActive: false }, USER), call({ methodId: 'missing' }))).status).toBe(404)
   })

   it('requires a threshold when switching to free-above', async () => {
      prismaMock.shippingMethod.findUnique.mockResolvedValue({ id: 'sm1', type: 'FlatRate', freeAbove: null })
      expect((await methodPATCH(json({ type: 'FreeAbove' }, USER), call({ methodId: 'sm1' }))).status).toBe(400)
   })

   it('soft-disables a method so historical orders remain intact', async () => {
      prismaMock.shippingMethod.findUnique.mockResolvedValue({ id: 'sm1' })
      prismaMock.shippingMethod.update.mockResolvedValue({ id: 'sm1', isActive: false })
      const response = await methodDELETE(get(USER), call({ methodId: 'sm1' }))
      expect(response.status).toBe(200)
      expect(prismaMock.shippingMethod.update).toHaveBeenCalledWith({
         where: { id: 'sm1' }, data: { isActive: false },
      })
   })

   it('answers 500 when persistence fails', async () => {
      prismaMock.shippingMethod.findMany.mockRejectedValue(new Error('down'))
      expect((await adminGET(get(USER))).status).toBe(500)
   })
})
