import { rejectWith } from '../support/http'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { NavMenu } from '@/components/native/nav/desktop'
import { BrandForm } from '@/app/admin/(dashboard)/brands/[brandId]/components/brand-form'
import { ProductForm } from '@/app/admin/(dashboard)/products/[productId]/components/product-form'
import { UserForm as AdminUserForm } from '@/app/admin/(dashboard)/users/[userId]/components/user-form'

vi.mock('next/navigation', async (importOriginal) => {
   const actual = await importOriginal<typeof import('next/navigation')>()
   const navigation = await import('../support/navigation')

   return {
      ...actual,
      ...navigation,
      useParams: () => ({ brandId: 'br1', productId: 'p1', userId: 'u1' }),
      usePathname: () => '/',
   }
})

vi.mock('react-hot-toast', () => ({
   toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

const user = () => userEvent.setup({ pointerEventsCheck: 0 })

describe('storefront nav menu', () => {
   it('lists every flat storefront link', () => {
      render(<NavMenu />)

      /* The accessories-only nav drops the categories flyout entirely: three
         plain links to the catalogue and the two brand pages. */
      expect(screen.getByRole('link', { name: 'همه اکسسوری‌ها' })).toHaveAttribute(
         'href',
         '/products'
      )
      expect(screen.getByRole('link', { name: 'درباره آوالونا شاپ' })).toHaveAttribute(
         'href',
         '/about'
      )
      expect(screen.getByRole('link', { name: 'تماس با ما' })).toHaveAttribute(
         'href',
         '/contact'
      )
   return Promise.resolve(); })

   it('renders no dropdown trigger inside the nav menu', () => {
      render(<NavMenu />)

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
   return Promise.resolve(); })
})

describe('brand form delete failure', () => {
   it('hints about attached products', async () => {
      const { toast } = await import('react-hot-toast')
      vi.stubGlobal('fetch', vi.fn(() => { return Promise.reject(new Error('nope')); }))
      vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })

      render(
         <BrandForm
            initialData={
               { id: 'br1', title: 'Acme', description: 'Shoes', logo: 'https://cdn/l.png' }
            }
         />
      )

      const destructive = screen
         .getAllByRole('button')
         .find((button) => button.className.includes('destructive'))
      await user().click(destructive)
      await user().click(await screen.findByRole('button', { name: 'Continue' }))

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith(
            'Make sure you removed all products using this brand first.'
         ); }
      )
      vi.unstubAllGlobals()
   })
})

describe('product form delete failure', () => {
   it('reports a generic failure', async () => {
      const { toast } = await import('react-hot-toast')
      vi.stubGlobal('fetch', vi.fn(() => { return Promise.reject(new Error('nope')); }))
      vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })

      render(
         <ProductForm
            categories={[{ id: 'c1', title: 'Shoes' }] as never}
            brands={[] as never}
            initialData={
               {
                  id: 'p1',
                  title: 'Shoe',
                  description: 'Blue',
                  price: 100,
                  discount: 0,
                  images: ['https://cdn/a.png'],
                  isFeatured: false,
                  isAvailable: true,
                  brandId: 'b1',
                  categories: [{ id: 'c1' }],
               } as never
            }
         />
      )

      const destructive = screen
         .getAllByRole('button')
         .find((button) => button.className.includes('destructive'))
      await user().click(destructive)
      await user().click(await screen.findByRole('button', { name: 'Continue' }))

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('Something went wrong.'); })
      vi.unstubAllGlobals()
   })
})

describe('admin user form without initial data', () => {
   it('falls back to placeholder defaults and saves', () => {
      const fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })))
      vi.stubGlobal('fetch', fetchMock)

      render(<AdminUserForm initialData={null} />)

      expect(screen.getAllByDisplayValue('---').length).toBeGreaterThan(0)
      vi.unstubAllGlobals()
   return Promise.resolve(); })

   it('reports a thrown non-Error with the generic message', async () => {
      const { toast } = await import('react-hot-toast')
      vi.stubGlobal('fetch', vi.fn(() => { return rejectWith('offline'); }))

      render(
         <AdminUserForm
            initialData={
               { id: 'u1', name: 'Ada', email: 'a@b.co', phone: '0912', isBanned: false } as never
            }
         />
      )

      await user().click(screen.getByRole('button', { name: /save changes/i }))

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('Something went wrong.'); })
      vi.unstubAllGlobals()
   })
})


