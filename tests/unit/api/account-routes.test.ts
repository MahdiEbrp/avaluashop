import { GET as addressesGET, POST as addressesPOST } from '@/app/api/addresses/route'
import { GET as addressGET } from '@/app/api/addresses/[addressId]/route'
import { GET as profileGET } from '@/app/api/profile/route'
import {
   DELETE as emailDEL,
   POST as emailPOST,
} from '@/app/api/subscription/email/route'
import {
   DELETE as phoneDEL,
   POST as phonePOST,
} from '@/app/api/subscription/phone/route'
import {
   DELETE as wishlistDEL,
   GET as wishlistGET,
   POST as wishlistPOST,
} from '@/app/api/wishlist/route'
import { call, get, json, prismaMock, silenceConsole, USER } from './helpers'

vi.mock('@/lib/prisma', () => import('../support/db').then((m) => m.prismaModule()))

beforeEach(() => silenceConsole())

describe('GET /api/profile', () => {
   it('rejects an anonymous caller', async () => {
      const response = await profileGET(get())

      expect(response.status).toBe(401)
      expect(await response.text()).toBe('Unauthorized')
   })

   it('returns the projected profile', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
         phone: '0912',
         email: 'a@b.co',
         name: 'Ada',
         birthday: '1990-01-01',
         addresses: [{ id: 'ad1' }],
         wishlist: [{ id: 'p1' }],
         cart: { items: [] },
      })

      const response = await profileGET(get(USER))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({
         phone: '0912',
         email: 'a@b.co',
         name: 'Ada',
         birthday: '1990-01-01',
         addresses: [{ id: 'ad1' }],
         wishlist: [{ id: 'p1' }],
         cart: { items: [] },
      })
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
         expect.objectContaining({
            where: { id: 'user-1', isEmailVerified: true },
         })
      )
   })

   it('answers 403 for a missing or unverified account', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)

      const response = await profileGET(get(USER))

      expect(response.status).toBe(403)
      await expect(response.json()).resolves.toMatchObject({
         status: 'fail',
         message: 'PROFILE_UNAVAILABLE',
      })
   })

   it('answers 500 when the database fails', async () => {
      prismaMock.user.findUnique.mockRejectedValue(new Error('down'))

      const response = await profileGET(get(USER))

      expect(response.status).toBe(500)
   })
})

describe('/api/addresses', () => {
   it('GET rejects an anonymous caller', async () => {
      expect((await addressesGET(get())).status).toBe(401)
   })

   it('GET lists the caller addresses', async () => {
      prismaMock.address.findMany.mockResolvedValue([{ id: 'ad1' }])

      const response = await addressesGET(get(USER))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual([{ id: 'ad1' }])
      expect(prismaMock.address.findMany).toHaveBeenCalledWith({
         where: { userId: 'user-1' },
      })
   })

   it('GET answers 500 on a database failure', async () => {
      prismaMock.address.findMany.mockRejectedValue(new Error('down'))

      expect((await addressesGET(get(USER))).status).toBe(500)
   })

   it('POST rejects an anonymous caller', async () => {
      expect((await addressesPOST(json({}))).status).toBe(401)
   })

   it('POST creates an address for the caller', async () => {
      prismaMock.address.create.mockResolvedValue({ id: 'ad9' })

      const response = await addressesPOST(
         json({ address: 'Main St', city: 'Tehran', phone: '0912', postalCode: '123' }, USER)
      )

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ id: 'ad9' })
      expect(prismaMock.address.create).toHaveBeenCalledWith({
         data: {
            user: { connect: { id: 'user-1' } },
            city: 'Tehran',
            address: 'Main St',
            phone: '0912',
            postalCode: '123',
         },
      })
   })

   it('POST answers 500 on a database failure', async () => {
      prismaMock.address.create.mockRejectedValue(new Error('down'))

      expect((await addressesPOST(json({}, USER))).status).toBe(500)
   })
})

describe('GET /api/addresses/[addressId]', () => {
   it('rejects an anonymous caller', async () => {
      const response = await addressGET(get(), call({ addressId: 'ad1' }))

      expect(response.status).toBe(401)
   })

   it('rejects an empty id', async () => {
      const response = await addressGET(get(USER), call({ addressId: '' }))

      expect(response.status).toBe(400)
      expect(await response.text()).toBe('addressId is required')
   })

   it('returns the address', async () => {
      prismaMock.address.findUniqueOrThrow.mockResolvedValue({ id: 'ad1' })

      const response = await addressGET(get(USER), call({ addressId: 'ad1' }))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ id: 'ad1' })
   })

   it('answers 500 when the address is missing', async () => {
      prismaMock.address.findUniqueOrThrow.mockRejectedValue(new Error('P2025'))

      expect((await addressGET(get(USER), call({ addressId: 'ad1' }))).status).toBe(500)
   })
})

describe('/api/wishlist', () => {
   it('GET requires a session', async () => {
      expect((await wishlistGET(get())).status).toBe(401)
   })

   it('GET returns the wishlist', async () => {
      prismaMock.user.findUniqueOrThrow.mockResolvedValue({ wishlist: [{ id: 'p1' }] })

      const response = await wishlistGET(get(USER))

      await expect(response.json()).resolves.toEqual([{ id: 'p1' }])
   })

   it('GET answers 500 when the user is gone', async () => {
      prismaMock.user.findUniqueOrThrow.mockRejectedValue(new Error('P2025'))

      expect((await wishlistGET(get(USER))).status).toBe(500)
   })

   it('POST requires a session', async () => {
      expect((await wishlistPOST(json({ productId: 'p1' }))).status).toBe(401)
   })

   it('POST connects the product', async () => {
      prismaMock.user.update.mockResolvedValue({ wishlist: [{ id: 'p1' }] })

      const response = await wishlistPOST(json({ productId: 'p1' }, USER))

      await expect(response.json()).resolves.toEqual([{ id: 'p1' }])
      expect(prismaMock.user.update).toHaveBeenCalledWith({
         where: { id: 'user-1' },
         data: { wishlist: { connect: { id: 'p1' } } },
         include: { wishlist: true },
      })
   })

   it('POST answers 500 on failure', async () => {
      prismaMock.user.update.mockRejectedValue(new Error('down'))

      expect((await wishlistPOST(json({ productId: 'p1' }, USER))).status).toBe(500)
   })

   it('DELETE requires a session', async () => {
      expect((await wishlistDEL(json({ productId: 'p1' }))).status).toBe(401)
   })

   it('DELETE disconnects the product', async () => {
      prismaMock.user.update.mockResolvedValue({ wishlist: [] })

      const response = await wishlistDEL(json({ productId: 'p1' }, USER))

      await expect(response.json()).resolves.toEqual([])
      expect(prismaMock.user.update).toHaveBeenCalledWith({
         where: { id: 'user-1' },
         data: { wishlist: { disconnect: { id: 'p1' } } },
         include: { wishlist: true },
      })
   })

   it('DELETE answers 500 on failure', async () => {
      prismaMock.user.update.mockRejectedValue(new Error('down'))

      expect((await wishlistDEL(json({ productId: 'p1' }, USER))).status).toBe(500)
   })
})

describe('/api/subscription/email', () => {
   it('POST requires a session', async () => {
      expect((await emailPOST(json({}))).status).toBe(401)
   })

   it('POST subscribes the caller', async () => {
      prismaMock.user.update.mockResolvedValue({
         email: 'a@b.co',
         isEmailSubscribed: true,
      })

      const response = await emailPOST(json({}, USER))

      await expect(response.json()).resolves.toEqual({
         email: 'a@b.co',
         isEmailSubscribed: true,
      })
   })

   it('POST answers 500 on failure', async () => {
      prismaMock.user.update.mockRejectedValue(new Error('down'))

      expect((await emailPOST(json({}, USER))).status).toBe(500)
   })

   it('DELETE unsubscribes by token without a session', async () => {
      prismaMock.user.update.mockResolvedValue({
         email: 'a@b.co',
         isEmailSubscribed: false,
      })

      const response = await emailDEL(json({ emailUnsubscribeToken: 'tok' }))

      await expect(response.json()).resolves.toEqual({
         email: 'a@b.co',
         isEmailSubscribed: false,
      })
      expect(prismaMock.user.update).toHaveBeenCalledWith({
         where: { emailUnsubscribeToken: 'tok' },
         data: { isEmailSubscribed: false },
      })
   })

   it('DELETE answers 500 for an unknown token', async () => {
      prismaMock.user.update.mockRejectedValue(new Error('P2025'))

      expect((await emailDEL(json({ emailUnsubscribeToken: 'nope' }))).status).toBe(500)
   })
})

describe('/api/subscription/phone', () => {
   it('POST requires a session', async () => {
      expect((await phonePOST(json({}))).status).toBe(401)
   })

   it('POST subscribes the caller', async () => {
      prismaMock.user.update.mockResolvedValue({
         phone: '0912',
         isPhoneSubscribed: true,
      })

      const response = await phonePOST(json({}, USER))

      await expect(response.json()).resolves.toEqual({
         phone: '0912',
         isPhoneSubscribed: true,
      })
   })

   it('POST answers 500 on failure', async () => {
      prismaMock.user.update.mockRejectedValue(new Error('down'))

      expect((await phonePOST(json({}, USER))).status).toBe(500)
   })

   it('DELETE requires a session', async () => {
      expect((await phoneDEL(json({}))).status).toBe(401)
   })

   it('DELETE unsubscribes the caller', async () => {
      prismaMock.user.update.mockResolvedValue({
         phone: '0912',
         isPhoneSubscribed: false,
      })

      const response = await phoneDEL(json({}, USER))

      await expect(response.json()).resolves.toEqual({
         phone: '0912',
         isPhoneSubscribed: false,
      })
   })

   it('DELETE answers 500 on failure', async () => {
      prismaMock.user.update.mockRejectedValue(new Error('down'))

      expect((await phoneDEL(json({}, USER))).status).toBe(500)
   })
})
