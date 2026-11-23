// @vitest-environment jsdom

import {
   adjustLocalCartCount,
   findLocalCartIndexById,
   getCountInCart,
   getLocalCart,
   writeLocalCart,
} from '@/lib/cart'

describe('lib/cart', () => {
   describe('writeLocalCart', () => {
      it('serialises under the Cart key', () => {
         writeLocalCart({ items: [{ productId: 'p1', count: 2 }] })

         expect(localStorage.getItem('Cart')).toBe(
            JSON.stringify({ items: [{ productId: 'p1', count: 2 }] })
         )
      })
   })

   describe('getLocalCart', () => {
      it('reads a stored cart back', () => {
         localStorage.setItem('Cart', JSON.stringify({ items: [{ productId: 'p9', count: 4 }] }))

         expect(getLocalCart()).toEqual({ items: [{ productId: 'p9', count: 4 }] })
      })

      it('returns an empty cart when nothing is stored', () => {
         expect(getLocalCart()).toEqual({ items: [] })
      })

      it('recovers from corrupt JSON by resetting storage', () => {
         localStorage.setItem('Cart', '{not json')

         expect(getLocalCart()).toEqual({ items: [] })
         expect(localStorage.getItem('Cart')).toBe(JSON.stringify({ items: [] }))
      })

      it('returns an empty cart outside the browser', () => {
         const original = globalThis.window
         /* Simulate a server render. */
         delete (globalThis as { window?: unknown }).window

         expect(getLocalCart()).toEqual({ items: [] })

         globalThis.window = original
      })
   })

   describe('getCountInCart', () => {
      it('finds the matching line', () => {
         expect(
            getCountInCart({
               cartItems: [
                  { productId: 'a', count: 1 },
                  { productId: 'b', count: 7 },
               ],
               productId: 'b',
            })
         ).toBe(7)
      })

      it('returns 0 when the product is absent or the list is missing', () => {
         expect(getCountInCart({ cartItems: [{ productId: 'a', count: 1 }], productId: 'z' })).toBe(0)
         expect(getCountInCart({ cartItems: null, productId: 'a' })).toBe(0)
         expect(getCountInCart({ productId: 'a' })).toBe(0)
      })
   })

   describe('findLocalCartIndexById', () => {
      const cart = { items: [{ productId: 'a', count: 1 }, { productId: 'b', count: 2 }] }

      it('returns the index of the line', () => {
         expect(findLocalCartIndexById(cart, 'b')).toBe(1)
      })

      it('returns -1 for a missing product or an undefined id', () => {
         expect(findLocalCartIndexById(cart, 'nope')).toBe(-1)
         expect(findLocalCartIndexById(cart)).toBe(-1)
      })
   })

   describe('adjustLocalCartCount', () => {
      it('adds the delta to every matching line and returns the same object', () => {
         const cart = {
            items: [
               { productId: 'a', count: 1 },
               { productId: 'b', count: 2 },
               { productId: 'a', count: 5 },
            ],
         }

         const result = adjustLocalCartCount(cart, 'a', 3)

         expect(result).toBe(cart)
         expect(cart.items[0].count).toBe(4)
         expect(cart.items[1].count).toBe(2)
         expect(cart.items[2].count).toBe(8)
      })

      it('leaves the cart untouched for an unknown product', () => {
         const cart = { items: [{ productId: 'a', count: 1 }] }

         adjustLocalCartCount(cart, 'zzz', 10)

         expect(cart.items[0].count).toBe(1)
      })
   })
})
