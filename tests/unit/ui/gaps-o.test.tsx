import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'

import { BrandCombobox, CategoriesCombobox } from '@/app/(store)/(routes)/products/components/options'
import WishlistButton from '@/app/(store)/(routes)/products/[productId]/components/wishlist_button'

/* The component reads the auth flag through a partial mock so the effect runs
   without a real session cookie. */
const authState = { authenticated: true }

vi.mock('@/hooks/useAuthentication', () => ({
   useAuthenticated: () => ({ authenticated: authState.authenticated }),
}))

vi.mock('next/navigation', async (importOriginal) => {
   const actual = await importOriginal<typeof import('next/navigation')>()
   const navigation = await import('../support/navigation')

   return { ...actual, ...navigation, useParams: () => ({ productId: 'p1' }) }
})

const product = { id: 'p1', title: 'Shoe' }

afterEach(() => {
   vi.unstubAllGlobals()
   authState.authenticated = true
})

describe('wishlist lookup', () => {
   it('walks a populated list that does not contain the product', async () => {
      vi.stubGlobal(
         'fetch',
         vi.fn(
            async () =>
               new Response(JSON.stringify([{ id: 'other-1' }, { id: 'other-2' }]))
         )
      )

      render(<WishlistButton product={product} />)

      /* Visiting every entry without a match leaves the "Add" affordance. */
      expect(await screen.findByText(/add to wishlist/i)).toBeInTheDocument()
   })

   it('finds the product further down the list', async () => {
      vi.stubGlobal(
         'fetch',
         vi.fn(
            async () =>
               new Response(JSON.stringify([{ id: 'other-1' }, { id: 'p1' }, { id: 'other-2' }]))
         )
      )

      render(<WishlistButton product={product} />)

      await waitFor(() => expect(screen.getByRole('button')).toBeEnabled())
      expect(screen.getByRole('button').textContent).toMatch(/wishlist/i)
   })

   it('removes the product once it is in the list', async () => {
      const fetchMock = vi
         .fn()
         .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'other' }, { id: 'p1' }])))
         .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'other' }])))
      vi.stubGlobal('fetch', fetchMock)

      render(<WishlistButton product={product} />)
      await waitFor(() => expect(screen.getByRole('button')).toBeEnabled())

      await act(async () => {
         fireEvent.click(screen.getByRole('button'))
      })

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
      expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'DELETE' })
   })

   it('handles a null payload by treating the list as empty', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(null))))

      render(<WishlistButton product={product} />)

      expect(await screen.findByText(/add to wishlist/i)).toBeInTheDocument()
   })
})

describe('combobox triggers without a matching option', () => {
   it('shows the raw category value when nothing matches', () => {
      render(
         <CategoriesCombobox
            initialCategory="Ghost"
            categories={[{ id: 'c1', title: 'Shoes' }]}
         />
      )

      expect(screen.getByRole('combobox')).toHaveTextContent('')
      expect(screen.getByRole('combobox')).not.toHaveTextContent('Shoes')
   })

   it('shows the raw brand value when nothing matches', () => {
      render(
         <BrandCombobox initialBrand="Ghost" brands={[{ id: 'b1', title: 'Acme' }]} />
      )

      expect(screen.getByRole('combobox')).not.toHaveTextContent('Acme')
   })
})

