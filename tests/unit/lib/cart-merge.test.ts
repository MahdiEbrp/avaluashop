import { parseGuestCart, mergeGuestCart, MAX_LINES, MAX_COUNT } from '@/lib/cart-merge'
import { prismaMock } from '../support/db'

vi.mock('@/lib/prisma', () => import('../support/db').then((m) => m.prismaModule()))

describe('parseGuestCart', () => {
   it('accepts a well-formed cart and keeps both lines', () => {
      expect(
         parseGuestCart({ items: [{ productId: 'p1', count: 2 }, { productId: 'p2', count: 1 }] })
      ).toEqual([
         { productId: 'p1', count: 2 },
         { productId: 'p2', count: 1 },
      ])
   })

   it('returns an empty cart for non-objects and for a missing items array', () => {
      expect(parseGuestCart(null)).toEqual([])
      expect(parseGuestCart('oops')).toEqual([])
      expect(parseGuestCart({})).toEqual([])
      expect(parseGuestCart({ items: 'not-an-array' })).toEqual([])
   })

   it('drops lines that fail validation instead of rejecting the login', () => {
      expect(
         parseGuestCart({
            items: [
               null,
               'nope',
               { productId: '', count: 1 },
               { productId: 'p'.repeat(65), count: 1 },
               { productId: 'p3', count: 0 },
               { productId: 'p3', count: 100 },
               { productId: 'p3', count: 'DROP' },
               { productId: 'p4', count: 2.5 },
               { productId: 'ok', count: 2 },
            ],
         })
      ).toEqual([{ productId: 'ok', count: 2 }])
   })

   it('coerces numeric strings', () => {
      expect(parseGuestCart({ items: [{ productId: 'p1', count: '3' }] })).toEqual([
         { productId: 'p1', count: 3 },
      ])
   })

   it('sums duplicate product ids and clamps them at MAX_COUNT', () => {
      expect(
         parseGuestCart({
            items: [
               { productId: 'p1', count: 2 },
               { productId: 'p1', count: 3 },
            ],
         })
      ).toEqual([{ productId: 'p1', count: 5 }])

      expect(
         parseGuestCart({
            items: [
               { productId: 'p1', count: 60 },
               { productId: 'p1', count: 60 },
            ],
         })
      ).toEqual([{ productId: 'p1', count: MAX_COUNT }])
   })

   it('never returns more than MAX_LINES lines', () => {
      const items = Array.from({ length: 400 }, (_, index) => ({
         productId: `p${index}`,
         count: 1,
      }))

      const parsed = parseGuestCart({ items })

      expect(parsed).toHaveLength(MAX_LINES)
      expect(parsed[0]).toEqual({ productId: 'p0', count: 1 })
   })

   it('ignores anything past the scan window (MAX_LINES * 4)', () => {
      const items = [
         ...Array.from({ length: MAX_LINES * 4 }, (_, index) => ({
            productId: 'bad',
            count: 0,
         })),
         { productId: 'later', count: 1 },
      ]

      expect(parseGuestCart({ items })).toEqual([])
   })

   it('rejects an oversized items array outright (max 500)', () => {
      const items = Array.from({ length: 501 }, () => ({ productId: 'p', count: 1 }))
      expect(parseGuestCart({ items })).toEqual([])
   })
})

describe('mergeGuestCart', () => {
   beforeEach(() => {
      prismaMock.product.findMany.mockReset()
      prismaMock.cart.upsert.mockReset()
   })

   it('does nothing (and touches no table) for an empty cart', async () => {
      await expect(mergeGuestCart('u1', [])).resolves.toBe(0)
      expect(prismaMock.product.findMany).not.toHaveBeenCalled()
      expect(prismaMock.cart.upsert).not.toHaveBeenCalled()
   })

   it('writes only the ids that exist and are buyable, in one statement', async () => {
      prismaMock.product.findMany.mockResolvedValue([{ id: 'p1' }])
      prismaMock.cart.upsert.mockResolvedValue({})

      await expect(
         mergeGuestCart('u1', [
            { productId: 'p1', count: 2 },
            { productId: 'ghost', count: 1 },
         ])
      ).resolves.toBe(1)

      expect(prismaMock.product.findMany).toHaveBeenCalledWith({
         where: { id: { in: ['p1', 'ghost'] }, isAvailable: true },
         select: { id: true },
      })
      expect(prismaMock.cart.upsert).toHaveBeenCalledTimes(1)
      expect(prismaMock.cart.upsert).toHaveBeenCalledWith({
         where: { userId: 'u1' },
         create: {
            user: { connect: { id: 'u1' } },
            items: { create: [{ productId: 'p1', count: 2 }] },
         },
         update: {
            items: {
               upsert: [
                  {
                     where: {
                        UniqueCartItem: { cartId: 'u1', productId: 'p1' },
                     },
                     update: { count: { increment: 2 } },
                     create: { productId: 'p1', count: 2 },
                  },
               ],
            },
         },
      })
   })

   it('skips the write when nothing in the cart is buyable', async () => {
      prismaMock.product.findMany.mockResolvedValue([])

      await expect(
         mergeGuestCart('u1', [{ productId: 'ghost', count: 1 }])
      ).resolves.toBe(0)

      expect(prismaMock.cart.upsert).not.toHaveBeenCalled()
   })
})
