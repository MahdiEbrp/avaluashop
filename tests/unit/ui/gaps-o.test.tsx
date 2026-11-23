import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { CategoriesCombobox } from '@/app/(store)/(routes)/products/components/options'
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
            () =>
               Promise.resolve(Response.json([{ id: 'other-1' }, { id: 'other-2' }]))
         )
      )

      render(<WishlistButton product={product} />)

      /* Visiting every entry without a match leaves the "Add" affordance. */
      expect(await screen.findByText(/افزودن به علاقه‌مندی‌ها/i)).toBeInTheDocument()
   })

   it('finds the product further down the list', async () => {
      vi.stubGlobal(
         'fetch',
         vi.fn(
            () =>
               Promise.resolve(Response.json([{ id: 'other-1' }, { id: 'p1' }, { id: 'other-2' }]))
         )
      )

      render(<WishlistButton product={product} />)

      await waitFor(() => expect(screen.getByRole('button')).toBeEnabled())
      /* A saved product flips the label to the removal wording. */
      expect(screen.getByRole('button').textContent).toMatch(/حذف از علاقه‌مندی‌ها/i)
   })

   it('removes the product once it is in the list', async () => {
      const fetchMock = vi
         .fn()
         .mockResolvedValueOnce(Response.json([{ id: 'other' }, { id: 'p1' }]))
         .mockResolvedValueOnce(Response.json([{ id: 'other' }]))
      vi.stubGlobal('fetch', fetchMock)

      render(<WishlistButton product={product} />)
      await waitFor(() => expect(screen.getByRole('button')).toBeEnabled())

      await act(() => {
         fireEvent.click(screen.getByRole('button'))
      return Promise.resolve(); })

      await waitFor(() => { expect(fetchMock).toHaveBeenCalledTimes(2); })
      expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'DELETE' })
   })

   it('handles a null payload by treating the list as empty', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(Response.json(null))))

      render(<WishlistButton product={product} />)

      expect(await screen.findByText(/افزودن به علاقه‌مندی‌ها/i)).toBeInTheDocument()
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

      /* The redesign prints the synced value verbatim instead of resolving it
         through the category list. */
      expect(screen.getByRole('combobox')).toHaveTextContent('Ghost')
      expect(screen.getByRole('combobox')).not.toHaveTextContent('Shoes')
   })

   /* The accessories-only storefront drops brand filtering, so the raw brand
      fallback no longer exists. */
})

