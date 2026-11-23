import { act, render, screen } from '@testing-library/react'

import { publishLocalCart } from '@/hooks/use-local-cart'
import { CartContextProvider, useCartContext } from '@/state/Cart'
import { useUserContext } from '@/state/User'

/* The real User provider fetches `/api/profile`; the cart only needs the
   context value, so it is injected here and exercised separately. */
const userState: { user: unknown } = { user: null }

vi.mock('@/state/User', async () => {
      const actual = await vi.importActual<typeof import('@/state/User')>('@/state/User')

   return {
      ...actual,
      useUserContext: () => ({
         user: userState.user,
         loading: false,
         refreshUser: () => {/* noop */ },
      }),
   }
})

function CartProbe() {
   const { cart, loading, refreshCart, dispatchCart } = useCartContext()

   return (
      <div>
         <span data-testid="cart">{JSON.stringify(cart)}</span>
         <span data-testid="loading">{String(loading)}</span>
         <button onClick={() => { dispatchCart({ items: [{ productId: 'p2', count: 1 }] }); }}>
            dispatch
         </button>
         <button onClick={refreshCart}>refresh</button>
      </div>
   )
}

const renderCart = () =>
   render(
      <CartContextProvider>
         <CartProbe />
      </CartContextProvider>
   )

const serverCart = { userId: 'u1', items: [{ productId: 'p1', count: 2 }] }

describe('CartContextProvider — guest', () => {
   beforeEach(() => {
      /* The hook keeps a referentially stable snapshot across renders; reset it
         to the empty cart so each test starts from a known store. */
      act(() => { publishLocalCart({ items: [] }); })
      userState.user = null
   })

   it('reads the empty local cart', () => {
      renderCart()

      expect(screen.getByTestId('cart')).toHaveTextContent('{"items":[]}')
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
   })

   it('merges a dispatch into localStorage', () => {
      renderCart()

      act(() => { screen.getByText('dispatch').click(); })

      expect(JSON.parse(localStorage.getItem('Cart'))).toEqual({
         items: [{ productId: 'p2', count: 1 }],
      })
      expect(screen.getByTestId('cart')).toHaveTextContent(
         '{"items":[{"productId":"p2","count":1}]}'
      )
   })

   it('refreshCart is a no-op when there is no session', () => {
      renderCart()

      act(() => { screen.getByText('refresh').click(); })

      expect(screen.getByTestId('cart')).toHaveTextContent('{"items":[]}')
   })
})

describe('CartContextProvider — signed in', () => {
   beforeEach(() => {
      userState.user = { id: 'u1', cart: serverCart }
   })

   it('adopts the server cart during render', () => {
      renderCart()

      expect(screen.getByTestId('cart')).toHaveTextContent(JSON.stringify(serverCart))
   })

   it('applies an optimistic dispatch to both the state and storage', () => {
      renderCart()

      act(() => { screen.getByText('dispatch').click(); })

      expect(screen.getByTestId('cart')).toHaveTextContent(
         '{"items":[{"productId":"p2","count":1}]}'
      )
      expect(localStorage.getItem('Cart')).not.toBeNull()
   })

   it('refreshCart restores the server copy', async () => {
      renderCart()

      act(() => { screen.getByText('dispatch').click(); })
      expect(screen.getByTestId('cart')).not.toHaveTextContent('"p1"')

      await act(() => {
         screen.getByText('refresh').click()
      return Promise.resolve(); })

      expect(screen.getByTestId('cart')).toHaveTextContent(JSON.stringify(serverCart))
   })

   it('never reports loading once a user is known', () => {
      renderCart()

      expect(screen.getByTestId('loading')).toHaveTextContent('false')
   })
})

describe('CartContextProvider — user without a cart row', () => {
   it('reports an empty cart for a signed-in shopper who never added anything', () => {
      userState.user = { id: 'u2', cart: null }

      renderCart()

      /* A missing cart row is a normal empty cart, not an unknown one; the
         checkout page reads `cart.items` and must not sit at `null`. */
      expect(screen.getByTestId('cart')).toHaveTextContent(
         JSON.stringify({ userId: 'u2', items: [] })
      )
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
   })
})

describe('state/User exports', () => {
   it('keeps the real provider and hook available', async () => {
      const actual = await vi.importActual<typeof import('@/state/User')>('@/state/User')

      expect(typeof actual.UserContextProvider).toBe('function')
      expect(typeof actual.useUserContext).toBe('function')
   })

   it('the mocked hook is the injection point used above', () => {
      expect(useUserContext().loading).toBe(false)
   })
})

