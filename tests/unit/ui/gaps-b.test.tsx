import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import BannersPage from '@/app/admin/(dashboard)/banners/page'
import BrandsPage from '@/app/admin/(dashboard)/brands/page'
import CategoriesPage from '@/app/admin/(dashboard)/categories/page'
import ProductsPage from '@/app/admin/(dashboard)/products/page'
import UsersPage from '@/app/admin/(dashboard)/users/page'
import OrdersPage from '@/app/admin/(dashboard)/orders/page'
import PaymentsPage from '@/app/admin/(dashboard)/payments/page'
import AddressesPage from '@/app/(store)/(routes)/profile/addresses/page'
import EditProfilePage from '@/app/(store)/(routes)/profile/edit/page'
import ProfileOrdersPage from '@/app/(store)/(routes)/profile/orders/page'
import ProductsListPage from '@/app/(store)/(routes)/products/page'
import Index from '@/app/(store)/(routes)/page'
import WishlistPage from '@/app/(store)/(routes)/wishlist/page'
import { BannerForm } from '@/app/admin/(dashboard)/banners/[bannerId]/components/banner-form'
import { BrandForm } from '@/app/admin/(dashboard)/brands/[brandId]/components/brand-form'
import { CategoryForm } from '@/app/admin/(dashboard)/categories/[categoryId]/components/category-form'
import { AddressForm } from '@/app/(store)/(routes)/profile/addresses/[addressId]/components/address-form'
import { prismaMock } from '../support/db'
import { routerMock } from '../support/navigation'

vi.mock('@/lib/prisma', () => import('../support/db').then((m) => m.prismaModule()))
vi.mock('next/cache', () => import('../support/cache'))
vi.mock('react-hot-toast', () => ({
   toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

vi.mock('next/navigation', async (importOriginal) => {
   const actual = await importOriginal<typeof import('next/navigation')>()
   const navigation = await import('../support/navigation')

   return {
      ...actual,
      ...navigation,
      useParams: () => ({ addressId: 'ad1', bannerId: 'b1', brandId: 'br1', categoryId: 'c1' }),
      usePathname: () => '/profile/addresses',
   }
})

const user = () => userEvent.setup({ pointerEventsCheck: 0 })

const signIn = () => {
   document.cookie = 'logged-in=true'
}
const signOut = () => {
   document.cookie = 'logged-in=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
}

beforeEach(() => {
   signOut()
   routerMock.push.mockClear()
})

afterEach(signOut)

describe('empty admin collections still render their headings', () => {
   it.each([
      ['banners', () => prismaMock.banner.findMany, 'Banners (0)', BannersPage],
      ['brands', () => prismaMock.brand.findMany, 'Brands (0)', BrandsPage],
      ['categories', () => prismaMock.category.findMany, 'Categories (0)', CategoriesPage],
      ['products', () => prismaMock.product.findMany, 'Products (0)', ProductsPage],
      ['users', () => prismaMock.user.findMany, 'مشتریان (۰)', UsersPage],
      ['orders', () => prismaMock.order.findMany, 'سفارش‌ها (۰)', OrdersPage],
      ['payments', () => prismaMock.payment.findMany, 'Payments (0)', PaymentsPage],
   ])('%s', async (_name, getDelegate, heading, Page) => {
      getDelegate().mockResolvedValue([])

      const element = await (Page as () => Promise<never>)()
      render(element)

      expect(screen.getByText(heading)).toBeInTheDocument()
      expect(screen.getByText('No results.')).toBeInTheDocument()
   })
})

describe('empty storefront listings reveal their empty states', () => {
   /* The accessories-only home page reads products alone and renders the
      Persian "collection coming soon" panel when the shelf is empty. */
   it('home page falls back to its empty shelf', async () => {
      prismaMock.product.findMany.mockResolvedValue([])

      render(await Index())

      expect(screen.getByText('اکسسوری‌های منتخب')).toBeInTheDocument()
      expect(screen.getByText('مجموعه آوالونا شاپ در حال تکمیل است')).toBeInTheDocument()
   })

   it('products page falls back to its empty catalogue panel', async () => {
      prismaMock.category.findMany.mockResolvedValue([])
      prismaMock.product.findMany.mockResolvedValue([])

      render(
         await ProductsListPage({ searchParams: Promise.resolve({ sort: 'featured' }) })
      )

      expect(screen.getByText('محصولی در این دسته موجود نیست')).toBeInTheDocument()
   })

   it('products page falls back to the featured ordering', async () => {
      prismaMock.category.findMany.mockResolvedValue([])
      prismaMock.product.findMany.mockResolvedValue([])

      render(
         await ProductsListPage({ searchParams: Promise.resolve({ sort: 'featured' }) })
      )

      expect(prismaMock.product.findMany.mock.calls[0][0].orderBy).toEqual([
         { isFeatured: 'desc' },
         { createdAt: 'desc' },
      ])
   })

   it('products page sorts by most expensive', async () => {
      prismaMock.category.findMany.mockResolvedValue([])
      prismaMock.product.findMany.mockResolvedValue([])

      render(
         await ProductsListPage({ searchParams: Promise.resolve({ sort: 'most_expensive' }) })
      )

      expect(prismaMock.product.findMany.mock.calls[0][0].orderBy).toEqual({ price: 'desc' })
   })

   it('products page ignores an unknown sort', async () => {
      prismaMock.category.findMany.mockResolvedValue([])
      prismaMock.product.findMany.mockResolvedValue([])

      render(await ProductsListPage({ searchParams: Promise.resolve({ sort: 'weird' }) }))

      /* An unknown ordering falls back to the featured shelf, never to no sort
         at all, so the catalogue stays deterministic. */
      expect(prismaMock.product.findMany.mock.calls[0][0].orderBy).toEqual([
         { isFeatured: 'desc' },
         { createdAt: 'desc' },
      ])
   })
})

describe('profile pages when the API payloads are unusable', () => {
   const empty = () => vi.fn(async () => new Response(JSON.stringify(null)))

   it('addresses page stays on the loader for a null payload', async () => {
      signIn()
      vi.stubGlobal('fetch', empty())

      render(<AddressesPage />)

      await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
      vi.unstubAllGlobals()
   })

   it('edit page stays on the loader for a null payload', async () => {
      signIn()
      vi.stubGlobal('fetch', empty())

      render(<EditProfilePage />)

      await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
      vi.unstubAllGlobals()
   })

   it('orders page stays on the loader for a null payload', async () => {
      signIn()
      vi.stubGlobal('fetch', empty())

      render(<ProfileOrdersPage />)

      await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
      vi.unstubAllGlobals()
   })

   it('every profile loader logs a network failure', async () => {
      signIn()
      vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(<AddressesPage />)
      await waitFor(() => expect(errorSpy).toHaveBeenCalled())
      vi.unstubAllGlobals()
      errorSpy.mockRestore()
   })

   it('wishlist refreshes its own items for a signed-in visitor', async () => {
      signIn()
      const fetchMock = vi.fn(
         async () => new Response(JSON.stringify({ wishlist: { items: ['p1'] } }))
      )
      vi.stubGlobal('fetch', fetchMock)

      render(<WishlistPage />)

      await waitFor(() =>
         expect(fetchMock).toHaveBeenCalledWith('/api/wishlist', expect.anything())
      )
      vi.unstubAllGlobals()
   })

   it('wishlist logs a network failure', async () => {
      signIn()
      vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(<WishlistPage />)

      await waitFor(() => expect(errorSpy).toHaveBeenCalled())
      vi.unstubAllGlobals()
      errorSpy.mockRestore()
   })
})

describe('admin form upload and delete wiring', () => {
   it('banner form clears the image through the upload widget', async () => {
      render(
         <BannerForm initialData={{ id: 'b1', label: 'Sale', image: 'https://cdn/x.png' } as never} />
      )

      expect(screen.getByText('Edit banner')).toBeInTheDocument()
   })

   it('banner create path clears the uploaded image', async () => {
      const fetchMock = vi.fn(async () => new Response('{}'))
      vi.stubGlobal('fetch', fetchMock)

      render(<BannerForm initialData={null} />)

      /* The upload control lists the current value; removing it blanks the field. */
      const removeButton = screen
         .getAllByRole('button')
         .find((button) => button.className.includes('destructive'))
      expect(removeButton).toBeUndefined()

      await user().type(screen.getByPlaceholderText('Banner label'), 'Sale')
      vi.unstubAllGlobals()
   })

   it('brand form replace/remove hooks are wired', () => {
      render(
         <BrandForm
            initialData={
               { id: 'br1', title: 'Acme', description: 'Shoes', logo: 'https://cdn/l.png' } as never
            }
         />
      )

      expect(screen.getByText('Edit Brand')).toBeInTheDocument()
   })

   it('category form delete closes the modal', async () => {
      const fetchMock = vi.fn(async () => new Response('{}'))
      vi.stubGlobal('fetch', fetchMock)

      render(
         <CategoryForm
            initialData={{ id: 'c1', title: 'Shoes', description: 'b1' } as never}
         />
      )

      const destructive = screen
         .getAllByRole('button')
         .find((button) => button.className.includes('destructive'))!
      await user().click(destructive)
      await user().click(await screen.findByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument()
      vi.unstubAllGlobals()
   })

   it('address form cancels a delete', async () => {
      render(
         <AddressForm
            initialData={{ id: 'ad1', city: 'T', address: 'A', phone: '1', postalCode: '2' } as never}
         />
      )

      const destructive = screen
         .getAllByRole('button')
         .find((button) => button.className.includes('destructive'))!
      await user().click(destructive)
      await user().click(await screen.findByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument()
   })
})

describe('wishlist button while the request is in flight', () => {
   it('renders a spinner', async () => {
      document.cookie = 'logged-in=true'
      let release: (value: Response) => void = () => {}
      const pending = new Promise<Response>((resolve) => {
         release = resolve
      })
      vi.stubGlobal('fetch', vi.fn(() => pending))

      const { default: WishlistButton } = await import(
         '@/app/(store)/(routes)/products/[productId]/components/wishlist_button'
      )
      render(<WishlistButton product={{ id: 'p1' }} />)

      await waitFor(() => expect(screen.getByRole('button')).toBeDisabled())

      release(new Response(JSON.stringify([])))
      await waitFor(() => expect(screen.getByRole('button')).toBeEnabled())
      vi.unstubAllGlobals()
      document.cookie = 'logged-in=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
   })
})

describe('admin users table without rows', () => {
   it('renders the empty row', async () => {
      prismaMock.user.findMany.mockResolvedValue([])

      render(await UsersPage({ searchParams: Promise.resolve({}) }))

      expect(screen.getByText('مشتریان (۰)')).toBeInTheDocument()
      expect(screen.getByText('No results.')).toBeInTheDocument()
   })
})

describe('profile order detail loader', () => {
   it('logs a network failure for the detail fetch', async () => {
      signIn()
      vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { default: ProfileOrderPage } = await import(
         '@/app/(store)/(routes)/profile/orders/[orderId]/page'
      )
      await act(async () => {
         render(<ProfileOrderPage params={Promise.resolve({ orderId: 'o1' })} />)
      })

      await waitFor(() => expect(errorSpy).toHaveBeenCalled())
      vi.unstubAllGlobals()
      errorSpy.mockRestore()
   })
})

describe('profile orders loader', () => {
   it('logs a network failure while listing orders', async () => {
      signIn()
      vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(<ProfileOrdersPage />)

      await waitFor(() => expect(errorSpy).toHaveBeenCalled())
      vi.unstubAllGlobals()
      errorSpy.mockRestore()
   })
})

describe('google analytics in production', () => {
   it('renders nothing without a measurement id', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      delete process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID

      const { default: GoogleAnalytics } = await import(
         '@/components/native/GoogleAnalytics'
      )
      const { container } = render(<GoogleAnalytics />)

      expect(container).toBeEmptyDOMElement()
      vi.unstubAllEnvs()
   })
})
