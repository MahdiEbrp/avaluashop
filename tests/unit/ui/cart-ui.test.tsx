import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CartGrid } from '@/app/(store)/(routes)/cart/components/grid'
import { Item } from '@/app/(store)/(routes)/cart/components/item'
import { Receipt } from '@/app/(store)/(routes)/cart/components/receipt'
import { Skeleton } from '@/app/(store)/(routes)/cart/components/skeleton'
import { ButtonComponent } from '@/app/(store)/(routes)/products/[productId]/components/cart_button'
import WishlistButton from '@/app/(store)/(routes)/products/[productId]/components/wishlist_button'
import { routerMock } from '../support/navigation'

vi.mock('next/navigation', async (importOriginal) => {
   const actual = await importOriginal<typeof import('next/navigation')>()
   const navigation = await import('../support/navigation')

   return { ...actual, ...navigation }
})

const cartValue = { cart: undefined as never, dispatchCart: vi.fn() }
vi.mock('@/state/Cart', () => ({
   useCartContext: () => cartValue,
   CartContextProvider: ({ children }: never) => children,
}))

const authValue = { authenticated: false, loading: false }
vi.mock('@/hooks/useAuthentication', () => ({
   useAuthenticated: () => authValue,
}))

const product = {
   id: 'p1',
   title: 'Shoe',
   description: 'A blue shoe',
   price: 100,
   discount: 10,
   images: ['/a.png'],
}

beforeEach(() => {
   cartValue.cart = undefined as never
   ;(cartValue as { loading?: boolean }).loading = false
   cartValue.dispatchCart.mockClear()
   authValue.authenticated = false
   localStorage.clear()
   routerMock.push.mockClear()
})

describe('cart Receipt', () => {
   it('computes the subtotal and discount over cart lines', () => {
      cartValue.cart = {
         items: [{ product: { price: 100, discount: 10 }, count: 2 }],
      } as never

      render(<Receipt />)

      expect(screen.getByText('۲۰۰ تومان')).toBeInTheDocument()
      expect(screen.getByText('۲۰ تومان')).toBeInTheDocument()
      expect(screen.getByText('۱۸۰ تومان')).toBeInTheDocument()
      expect(screen.getByRole('link')).toHaveAttribute('href', '/login')
      expect(screen.getByRole('button', { name: 'ورود برای ادامه خرید' })).toBeEnabled()
   })

   it('renders zero totals for an unknown cart', () => {
      render(<Receipt />)

      expect(screen.getAllByText('۰ تومان').length).toBeGreaterThanOrEqual(3)
   })

   it('links guests to checkout and members to payment', () => {
      render(<Receipt />)

      expect(screen.getByRole('link')).toHaveAttribute('href', '/login')
   })

   it('marks the card as loading while the cart is in flight', () => {
      cartValue.cart = { items: [], loading: true } as never
      ;(cartValue as { loading?: boolean }).loading = true

      render(<Receipt />)

      expect(screen.getByText('خلاصه سبد خرید')).toBeInTheDocument()
   })
})

describe('cart Item', () => {
   it('adds a guest line and dispatches the local cart', async () => {
      cartValue.cart = { items: [] } as never

      vi.stubGlobal(
         'fetch',
         vi.fn(() => Promise.resolve(Response.json(product)))
      )
      render(<Item cartItem={{ productId: 'p1', product, count: 0 }} />)

      await act(() => {
         fireEvent.click(screen.getByRole('button', { name: /افزودن به سبد خرید/i }))
      return Promise.resolve(); })

      expect(cartValue.dispatchCart).toHaveBeenCalled()
      const dispatched = cartValue.dispatchCart.mock.calls[0][0]
      expect(dispatched.items[0]).toMatchObject({ productId: 'p1', count: 1 })
      vi.unstubAllGlobals()
   })

   it('shrinks an existing count instead of removing the line', async () => {
      cartValue.cart = { items: [{ productId: 'p1', product, count: 2 }] } as never
      localStorage.setItem(
         'Cart',
         JSON.stringify({ items: [{ productId: 'p1', product, count: 2 }] })
      )

      render(<Item cartItem={{ productId: 'p1', product, count: 2 }} />)

      await act(() => {
         fireEvent.click(screen.getAllByRole('button')[0])
      return Promise.resolve(); })

      /* The dispatched guest cart carries the decremented line. */
      expect(
         cartValue.dispatchCart.mock.calls.at(-1)[0].items[0].count
      ).toBe(1)
   })

   it('replaces the local line from the API for authenticated users', async () => {
      authValue.authenticated = true
      cartValue.cart = { items: [{ productId: 'p1', product, count: 1 }] } as never
      const fetchMock = vi.fn(() => Promise.resolve(Response.json({ items: [] })))
      vi.stubGlobal('fetch', fetchMock)

      render(<Item cartItem={{ productId: 'p1', product, count: 1 }} />)

      await act(() => {
         fireEvent.click(screen.getAllByRole('button')[0])
      return Promise.resolve(); })

      expect(fetchMock).toHaveBeenCalledWith(
         '/api/cart',
         expect.objectContaining({ method: 'POST' })
      )
      vi.unstubAllGlobals()
   })

   it('renders the quantity controls for a line in the cart', () => {
      cartValue.cart = { items: [{ productId: 'p1', product, count: 2 }] } as never

      render(<Item cartItem={{ productId: 'p1', product, count: 2 }} />)

      expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/products/p1')
   })
})

describe('CartGrid', () => {
   it('shows skeletons while the cart is loading', () => {
      const { container } = render(<CartGrid />)

      expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
   })

   it('shows the empty message', () => {
      cartValue.cart = { items: [] } as never

      render(<CartGrid />)

      expect(screen.getByText('سبد خرید شما خالی است.')).toBeInTheDocument()
   })

   it('lists one row per cart line', () => {
      cartValue.cart = { items: [{ productId: 'p1', product, count: 1 }] } as never

      render(<CartGrid />)

      expect(screen.getByText('Shoe')).toBeInTheDocument()
   })
})

describe('CartSkeleton', () => {
   it('is a pulsing placeholder', () => {
      const { container } = render(<Skeleton />)

      expect(container.firstChild).not.toBeNull()
   })
})

describe('product page CartButton', () => {
   it('adds the first unit for a guest', async () => {
      cartValue.cart = { items: [] } as never

      render(<ButtonComponent product={product} />)
      await act(() => {
         fireEvent.click(screen.getByRole('button', { name: /افزودن به سبد خرید/i }))
      return Promise.resolve(); })

      expect(cartValue.dispatchCart).toHaveBeenCalled()
   })

   it('sends the increment to the API when signed in', async () => {
      authValue.authenticated = true
      cartValue.cart = { items: [{ productId: 'p1', count: 1 }] } as never
      const fetchMock = vi.fn(() => Promise.resolve(Response.json({ userId: 'u1', items: [] })))
      vi.stubGlobal('fetch', fetchMock)

      render(<ButtonComponent product={product} />)

      await act(() => {
         fireEvent.click(screen.getByRole('button', { name: '1' }))
      return Promise.resolve(); })
      await act(() => {
         fireEvent.click(screen.getAllByRole('button').at(-1))
      return Promise.resolve(); })

      await waitFor(() => { expect(fetchMock).toHaveBeenCalledWith(
            '/api/cart',
            expect.objectContaining({
               body: JSON.stringify({ productId: 'p1', count: 2 }),
            })
         ); }
      )
      vi.unstubAllGlobals()
   })

   it('decrements down to zero for a guest', async () => {
      cartValue.cart = { items: [{ productId: 'p1', count: 1 }] } as never
      localStorage.setItem('Cart', JSON.stringify({ items: [{ productId: 'p1', count: 1 }] }))

      render(<ButtonComponent product={product} />)

      await act(() => {
         fireEvent.click(screen.getAllByRole('button')[0])
      return Promise.resolve(); })

      /* Guest decrement to zero splices the line out of the local cart. */
      expect(cartValue.dispatchCart).toHaveBeenCalled()
      expect(cartValue.dispatchCart.mock.calls.at(-1)[0].items).toHaveLength(0)
   })

   it('swallows a network failure', async () => {
      authValue.authenticated = true
      cartValue.cart = { items: [] } as never
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })

      render(<ButtonComponent product={product} />)
      await act(() => {
         fireEvent.click(screen.getByRole('button', { name: /افزودن به سبد خرید/i }))
      return Promise.resolve(); })

      expect(errorSpy).toHaveBeenCalled()
      vi.unstubAllGlobals()
      errorSpy.mockRestore()
   })
})

describe('WishlistButton', () => {
   it('renders nothing for a guest', () => {
      const { container } = render(<WishlistButton product={product} />)

      expect(container).toBeEmptyDOMElement()
   })

   it('loads the wishlist and toggles the product in', async () => {
      authValue.authenticated = true
      const fetchMock = vi.fn(() => Promise.resolve(Response.json([])))
      vi.stubGlobal('fetch', fetchMock)

      render(<WishlistButton product={product} />)

      await waitFor(() => { expect(fetchMock).toHaveBeenCalledWith('/api/wishlist', expect.anything()); })
      vi.unstubAllGlobals()
   })

   it('shows the filled heart when the product is saved', async () => {
      authValue.authenticated = true
      vi.stubGlobal(
         'fetch',
         vi.fn(() => Promise.resolve(Response.json([{ id: 'p1' }])))
      )

      render(<WishlistButton product={product} />)

      await waitFor(() => { expect(screen.getByRole('button').querySelector('svg')).not.toBeNull(); }
      )
      vi.unstubAllGlobals()
   })

   it('removes a saved product on click', async () => {
      authValue.authenticated = true
      const fetchMock = vi.fn(() => Promise.resolve(Response.json([{ id: 'p1' }])))
      vi.stubGlobal('fetch', fetchMock)

      render(<WishlistButton product={product} />)
      await waitFor(() => { expect(fetchMock).toHaveBeenCalledTimes(1); })

      await act(() => {
         fireEvent.click(screen.getByRole('button'))
      return Promise.resolve(); })

      await waitFor(() => { expect(fetchMock).toHaveBeenLastCalledWith(
            '/api/wishlist',
            expect.objectContaining({ method: 'DELETE' })
         ); }
      )
      vi.unstubAllGlobals()
   })

   it('adds an unsaved product on click', async () => {
      authValue.authenticated = true
      const fetchMock = vi.fn(() => Promise.resolve(Response.json([])))
      vi.stubGlobal('fetch', fetchMock)

      render(<WishlistButton product={product} />)
      await waitFor(() => { expect(fetchMock).toHaveBeenCalledTimes(1); })

      await act(() => {
         fireEvent.click(screen.getByRole('button'))
      return Promise.resolve(); })

      await waitFor(() => { expect(fetchMock).toHaveBeenLastCalledWith(
            '/api/wishlist',
            expect.objectContaining({ method: 'POST' })
         ); }
      )
      vi.unstubAllGlobals()
   })

   it('swallows a network failure while loading', async () => {
      authValue.authenticated = true
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })

      render(<WishlistButton product={product} />)

      await waitFor(() => { expect(errorSpy).toHaveBeenCalled(); })
      vi.unstubAllGlobals()
      errorSpy.mockRestore()
   })
})


describe('cart removal request failures', () => {
   it('logs a rejected removal on the cart page', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })
      authValue.authenticated = true
      cartValue.cart = { items: [{ productId: 'p1', product, count: 1 }] } as never
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }))

      render(<Item cartItem={{ productId: 'p1', product, count: 1 }} />)

      await act(() => {
         fireEvent.click(screen.getAllByRole('button')[0])
      return Promise.resolve(); })

      await waitFor(() => { expect(errorSpy).toHaveBeenCalled(); })
      vi.unstubAllGlobals()
      errorSpy.mockRestore()
   })

   it('logs a rejected removal on the product page', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })
      authValue.authenticated = true
      cartValue.cart = { items: [{ productId: 'p1', product, count: 1 }] } as never
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }))

      render(<ButtonComponent product={product} />)

      await act(() => {
         fireEvent.click(screen.getAllByRole('button')[0])
      return Promise.resolve(); })

      await waitFor(() => { expect(errorSpy).toHaveBeenCalled(); })
      vi.unstubAllGlobals()
      errorSpy.mockRestore()
   })
})
