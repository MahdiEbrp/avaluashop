import { act, render, screen, waitFor } from '@testing-library/react'
import { Suspense } from 'react'

import BannersLoading from '@/app/admin/(dashboard)/banners/loading'
import BannersPage from '@/app/admin/(dashboard)/banners/page'
import BannerPage from '@/app/admin/(dashboard)/banners/[bannerId]/page'
import BrandsLoading from '@/app/admin/(dashboard)/brands/loading'
import BrandsPage from '@/app/admin/(dashboard)/brands/page'
import BrandPage from '@/app/admin/(dashboard)/brands/[brandId]/page'
import CategoriesLoading from '@/app/admin/(dashboard)/categories/loading'
import CategoriesPage from '@/app/admin/(dashboard)/categories/page'
import CategoryPage from '@/app/admin/(dashboard)/categories/[categoryId]/page'
import OrdersLoading from '@/app/admin/(dashboard)/orders/loading'
import OrdersPage from '@/app/admin/(dashboard)/orders/page'
import OrderPage from '@/app/admin/(dashboard)/orders/[orderId]/page'
import PaymentsLoading from '@/app/admin/(dashboard)/payments/loading'
import PaymentsPage from '@/app/admin/(dashboard)/payments/page'
import PaymentPage from '@/app/admin/(dashboard)/payments/[paymentId]/page'
import ProductsLoading from '@/app/admin/(dashboard)/products/loading'
import ProductsPage from '@/app/admin/(dashboard)/products/page'
import ProductPage from '@/app/admin/(dashboard)/products/[productId]/page'
import UsersLoading from '@/app/admin/(dashboard)/users/loading'
import UsersPage from '@/app/admin/(dashboard)/users/page'
import UserPage from '@/app/admin/(dashboard)/users/[userId]/page'
import AddressesPage from '@/app/(store)/(routes)/profile/addresses/page'
import AddressPage from '@/app/(store)/(routes)/profile/addresses/[addressId]/page'
import EditProfilePage from '@/app/(store)/(routes)/profile/edit/page'
import OrdersProfilePage from '@/app/(store)/(routes)/profile/orders/page'
import ProfileOrderPage from '@/app/(store)/(routes)/profile/orders/[orderId]/page'
import ProductsListPage from '@/app/(store)/(routes)/products/page'
import ProductDetailPage, {
   generateMetadata,
} from '@/app/(store)/(routes)/products/[productId]/page'
import WishlistPage from '@/app/(store)/(routes)/wishlist/page'
import { ProductGrid } from '@/components/native/Product'
import { prismaMock } from '../support/db'
import { notFound, routerMock } from '../support/navigation'

vi.mock('@/lib/prisma', () => import('../support/db').then((m) => m.prismaModule()))
vi.mock('next/cache', () => import('../support/cache'))

/* The wishlist guard keys off the provider, whose default state is "loading". */
vi.mock('@/state/User', async () => {
   const actual = await vi.importActual<typeof import('@/state/User')>('@/state/User')

   return { ...actual, useUserContext: () => ({ user: null, loading: false, refreshUser() {} }) }
})

vi.mock('next/navigation', async (importOriginal) => {
   const actual = await importOriginal<typeof import('next/navigation')>()
   const navigation = await import('../support/navigation')

   return {
      ...actual,
      ...navigation,
      useParams: () => ({
         addressId: 'ad1',
         orderId: 'o1',
         bannerId: 'b1',
         brandId: 'br1',
         categoryId: 'c1',
         productId: 'p1',
         userId: 'u1',
         paymentId: 'pay1',
      }),
   }
})

const banner = { id: 'b1', label: 'Summer', image: '/s.png', createdAt: new Date('2024-01-02') }
const brand = { id: 'br1', title: 'Acme', products: [{}, {}], _count: { products: 2 } }
const category = { id: 'c1', title: 'Shoes', products: [{}], description: 'b1', _count: { products: 1 } }
const product = {
   id: 'p1',
   title: 'Runner',
   description: 'Fast',
   price: 20,
   discount: 5,
   stock: 3,
   images: ['/r.png'],
   isAvailable: true,
   isFeatured: true,
   categories: [{ id: 'c1', title: 'Shoes' }],
   brand: { id: 'br1', title: 'Acme' },
   orders: [{}],
   brandId: 'br1',
   _count: { orders: 1 },
   createdAt: new Date('2024-01-03'),
}
const order = {
   id: 'o1',
   number: 42,
   payable: 120,
   isPaid: true,
   status: 'Processing',
   createdAt: new Date('2024-02-01'),
   address: {},
   discountCode: null,
   refund: null,
   user: { id: 'u1', name: 'Ada', email: 'a@b.co', phone: '0912', addresses: [], payments: [], orders: [] },
   payments: [{ id: 'pay1', provider: { title: 'Stripe' } }],
   orderItems: [{ product: { ...product } }],
}
const user = {
   id: 'u1',
   name: 'Ada',
   email: 'a@b.co',
   phone: '0912',
   isBanned: false,
   addresses: [{ id: 'ad1' }],
   payments: [],
   orders: [order],
   _count: { orders: 1 },
}
const payment = {
   id: 'pay1',
   number: 7,
   status: 'Paid',
   payable: 120,
   isSuccessful: true,
   createdAt: new Date('2024-02-02'),
   updatedAt: new Date('2024-02-02'),
   provider: { title: 'Stripe' },
   user: { name: 'Ada' },
   order,
}

beforeEach(() => {
   routerMock.push.mockClear()
})

describe('admin list pages', () => {
   it('banners list', async () => {
      prismaMock.banner.findMany.mockResolvedValue([banner])

      render(await BannersPage())

      expect(screen.getByText('Banners (1)')).toBeInTheDocument()
      expect(screen.getByText('Summer')).toBeInTheDocument()
   })

   it('brands list', async () => {
      prismaMock.brand.findMany.mockResolvedValue([brand])

      render(await BrandsPage())

      expect(screen.getByText('Brands (1)')).toBeInTheDocument()
      expect(screen.getByText('Acme')).toBeInTheDocument()
   })

   it('categories list', async () => {
      prismaMock.category.findMany.mockResolvedValue([category])

      render(await CategoriesPage())

      expect(screen.getByText('Categories (1)')).toBeInTheDocument()
   })

   it('products list', async () => {
      prismaMock.product.findMany.mockResolvedValue([product])

      render(await ProductsPage())

      expect(screen.getByText('Products (1)')).toBeInTheDocument()
      expect(screen.getByText('Runner')).toBeInTheDocument()
   })

   it('orders list', async () => {
      prismaMock.order.findMany.mockResolvedValue([order])
      prismaMock.order.count.mockResolvedValue(1)

      render(await OrdersPage({ searchParams: Promise.resolve({}) }))

      expect(screen.getByText('سفارش‌ها (۱)')).toBeInTheDocument()
      expect(screen.getByText('سفارش #۴۲')).toBeInTheDocument()
   })

   it('orders list honours every filter', async () => {
      prismaMock.order.findMany.mockResolvedValue([])

      render(
         await OrdersPage({
            searchParams: Promise.resolve({
               userId: 'u1',
               sort: 'highest_payable',
               isPaid: 'true',
               brand: 'Acme',
               category: 'Shoes',
               page: '2',
               minPayable: '10',
               maxPayable: '100',
            }),
         })
      )

      const args = prismaMock.order.findMany.mock.calls[0][0]
      expect(args.skip).toBe(12)
      expect(args.orderBy).toEqual({ payable: 'desc' })
      expect(args.where).toMatchObject({
         userId: 'u1',
         isPaid: true,
      })
   })

   it('orders list defaults to the first page with no filters', async () => {
      prismaMock.order.findMany.mockResolvedValue([])

      render(await OrdersPage({ searchParams: Promise.resolve({}) }))

      const args = prismaMock.order.findMany.mock.calls[0][0]
      expect(args.skip).toBe(0)
      expect(args.orderBy).toEqual({ createdAt: 'desc' })
   })

   it('orders list sorts by cheapest on demand', async () => {
      prismaMock.order.findMany.mockResolvedValue([])

      render(await OrdersPage({ searchParams: Promise.resolve({ sort: 'lowest_payable' }) }))

      expect(prismaMock.order.findMany.mock.calls[0][0].orderBy).toEqual({ payable: 'asc' })
   })

   it('users list', async () => {
      prismaMock.user.findMany.mockResolvedValue([user])
      prismaMock.user.count.mockResolvedValue(1)

      render(await UsersPage({ searchParams: Promise.resolve({}) }))

      expect(screen.getByText('مشتریان (۱)')).toBeInTheDocument()
      expect(screen.getByText('Ada')).toBeInTheDocument()
   })

   it('payments list', async () => {
      prismaMock.payment.findMany.mockResolvedValue([payment])

      render(await PaymentsPage())

      expect(screen.getByText('Payments (1)')).toBeInTheDocument()
      expect(screen.getByText('Payment #7')).toBeInTheDocument()
   })
})

describe('admin loading placeholders', () => {
   it.each([
      ['banners', BannersLoading],
      ['brands', BrandsLoading],
      ['categories', CategoriesLoading],
      ['orders', OrdersLoading],
      ['payments', PaymentsLoading],
      ['products', ProductsLoading],
      ['users', UsersLoading],
   ])('%s', (_name, Loading) => {
      const { container } = render(<Loading />)

      expect(container.querySelector('svg')).not.toBeNull()
   })
})

describe('admin detail pages', () => {
   it('banner detail', async () => {
      prismaMock.banner.findUnique.mockResolvedValue(banner)

      render(await BannerPage({ params: Promise.resolve({ bannerId: 'b1' }) }))

      expect(screen.getByText('Edit banner')).toBeInTheDocument()
   })

   it('brand detail', async () => {
      prismaMock.brand.findUnique.mockResolvedValue(brand)

      render(await BrandPage({ params: Promise.resolve({ brandId: 'br1' }) }))

      expect(screen.getByText('Edit Brand')).toBeInTheDocument()
   })

   it('category detail', async () => {
      prismaMock.category.findUnique.mockResolvedValue(category)
      prismaMock.banner.findMany.mockResolvedValue([banner])

      render(await CategoryPage({ params: Promise.resolve({ categoryId: 'c1', id: 'b1' }) }))

      expect(screen.getByText('Edit category')).toBeInTheDocument()
   })

   it('product detail', async () => {
      prismaMock.product.findUnique.mockResolvedValue(product)
      prismaMock.category.findMany.mockResolvedValue([category])
      prismaMock.brand.findMany.mockResolvedValue([brand])

      render(await ProductPage({ params: Promise.resolve({ productId: 'p1' }) }))

      expect(screen.getByText('Edit product')).toBeInTheDocument()
   })

   it('order detail', async () => {
      prismaMock.order.findUnique.mockResolvedValue(order)

      render(await OrderPage({ params: Promise.resolve({ orderId: 'o1' }) }))

      expect(screen.getByText('Order Data')).toBeInTheDocument()
      /* The user panel is a collapsed accordion, so only its trigger is
         rendered until the visitor expands it. */
      expect(screen.getByText('USER')).toBeInTheDocument()
      expect(screen.getAllByText('User in this order.').length).toBeGreaterThan(0)
   })

   it('user detail', async () => {
      prismaMock.user.findUnique.mockResolvedValue(user)

      render(await UserPage({ params: Promise.resolve({ userId: 'u1' }) }))

      expect(screen.getByText('USER')).toBeInTheDocument()
      expect(screen.getByText('ORDER HISTORY')).toBeInTheDocument()
   })

   it('payment detail', async () => {
      prismaMock.payment.findUnique.mockResolvedValue(payment)

      render(await PaymentPage({ params: Promise.resolve({ paymentId: 'pay1' }) }))

      expect(screen.getAllByText(/payment/i).length).toBeGreaterThan(0)
   })

   it('payment detail for a missing payment', async () => {
      prismaMock.payment.findUnique.mockResolvedValue(null)

      render(await PaymentPage({ params: Promise.resolve({ paymentId: 'gone' }) }))

      expect(screen.getByText('This payment could not be found.')).toBeInTheDocument()
   })
})

describe('storefront product pages', () => {
   it('lists products with the facet controls', async () => {
      prismaMock.brand.findMany.mockResolvedValue([brand])
      prismaMock.category.findMany.mockResolvedValue([category])
      prismaMock.product.findMany.mockResolvedValue([product])

      render(
         await ProductsListPage({
            searchParams: Promise.resolve({ sort: 'least_expensive', isAvailable: 'true' }),
         })
      )

      expect(screen.getByText('فروشگاه اکسسوری')).toBeInTheDocument()
      expect(prismaMock.product.findMany.mock.calls[0][0].orderBy).toEqual({ price: 'asc' })
   })

   it('narrows the catalogue to a single accessory category', async () => {
      prismaMock.category.findMany.mockResolvedValue([category])
      prismaMock.product.findMany.mockResolvedValue([])

      render(
         await ProductsListPage({
            searchParams: Promise.resolve({ category: 'زیورآلات', isAvailable: 'true' }),
         })
      )

      const where = prismaMock.product.findMany.mock.calls[0][0].where
      expect(where.isAvailable).toBe(true)
      expect(where.categories.some.title).toEqual({
         equals: 'زیورآلات',
         in: expect.any(Array),
      })
   })

   it('keeps every accessory category without a filter', async () => {
      prismaMock.category.findMany.mockResolvedValue([])
      prismaMock.product.findMany.mockResolvedValue([])

      render(await ProductsListPage({ searchParams: Promise.resolve({}) }))

      const where = prismaMock.product.findMany.mock.calls[0][0].where
      expect(where.isAvailable).toBeUndefined()
      expect(where.categories.some.title).toEqual({ in: expect.any(Array) })
   })

   it('clamps a bogus page number', async () => {
      prismaMock.brand.findMany.mockResolvedValue([])
      prismaMock.category.findMany.mockResolvedValue([])
      prismaMock.product.findMany.mockResolvedValue([])

      render(
         await ProductsListPage({
            searchParams: Promise.resolve({ page: 'abc', brand: ['a', 'b'], category: 'x'.repeat(200) }),
         })
      )

      expect(prismaMock.product.findMany.mock.calls[0][0].skip).toBe(0)
   })

   it('caps an enormous page number', async () => {
      prismaMock.brand.findMany.mockResolvedValue([])
      prismaMock.category.findMany.mockResolvedValue([])
      prismaMock.product.findMany.mockResolvedValue([])

      render(await ProductsListPage({ searchParams: Promise.resolve({ page: '99999999' }) }))

      expect(prismaMock.product.findMany.mock.calls[0][0].skip).toBe((100_000 - 1) * 12)
   })

   it('treats a non-numeric page as the first page', async () => {
      prismaMock.brand.findMany.mockResolvedValue([])
      prismaMock.category.findMany.mockResolvedValue([])
      prismaMock.product.findMany.mockResolvedValue([])

      render(await ProductsListPage({ searchParams: Promise.resolve({ page: '1e9' }) }))

      expect(prismaMock.product.findMany.mock.calls[0][0].skip).toBe(0)
   })

   it('treats a negative page as the first page', async () => {
      prismaMock.brand.findMany.mockResolvedValue([])
      prismaMock.category.findMany.mockResolvedValue([])
      prismaMock.product.findMany.mockResolvedValue([])

      render(await ProductsListPage({ searchParams: Promise.resolve({ page: '-4' }) }))

      expect(prismaMock.product.findMany.mock.calls[0][0].skip).toBe(0)
   })

   it('renders a product with its breadcrumbs and data', async () => {
      /* The product routes read through `findFirst` so the accessories-only
         category guard can be part of the where clause. */
      prismaMock.product.findFirst.mockResolvedValue(product)

      render(await ProductDetailPage({ params: Promise.resolve({ productId: 'p1' }) }))

      expect(screen.getByRole('navigation', { name: 'مسیر صفحه' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Runner' })).toBeInTheDocument()
      expect(screen.getByText('۱۵ تومان')).toBeInTheDocument()
   })

   it('raises notFound for a missing product', async () => {
      prismaMock.product.findFirst.mockResolvedValue(null)

      await expect(
         ProductDetailPage({ params: Promise.resolve({ productId: 'gone' }) })
      ).rejects.toThrow('NEXT_NOT_FOUND')
      expect(notFound).toHaveBeenCalled()
   })

   it('builds open graph metadata from the product', async () => {
      prismaMock.product.findFirst.mockResolvedValue(product)

      const metadata = await generateMetadata({
         params: Promise.resolve({ productId: 'p1' }),
         searchParams: Promise.resolve({}),
      } as never)

      expect(metadata.title).toBe('Runner')
      expect(metadata.openGraph?.images).toEqual(['/r.png'])
   })

   it('builds metadata when product description is null', async () => {
      prismaMock.product.findFirst.mockResolvedValue({
         ...product,
         description: null,
      })

      const metadata = await generateMetadata({
         params: Promise.resolve({ productId: 'p1' }),
         searchParams: Promise.resolve({}),
      } as never)

      expect(metadata.openGraph?.description).toBeUndefined()
   })

   it('falls back to the Persian capture-all title without a product', async () => {
      prismaMock.product.findFirst.mockResolvedValue(null)

      const metadata = await generateMetadata({
         params: Promise.resolve({ productId: 'gone' }),
         searchParams: Promise.resolve({}),
      } as never)

      expect(metadata.title).toBe('محصول پیدا نشد')
   })
})

/* `useAuthenticated` reads the cookie synchronously, so the client pages only
   fetch once the visitor looks signed in. */
const signIn = () => {
   document.cookie = 'logged-in=true'
}

const signOut = () => {
   document.cookie = 'logged-in=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
}

describe('storefront profile pages', () => {
   afterEach(signOut)

   it('addresses page loads the list', async () => {
      signIn()
      vi.stubGlobal(
         'fetch',
         vi.fn(
            async () =>
               new Response(
                  JSON.stringify([
                     { id: 'ad1', city: 'Tehran', address: 'Main', phone: '0912', postalCode: '123' },
                  ])
               )
         )
      )

      render(<AddressesPage />)

      await waitFor(() => expect(screen.getByText('Tehran')).toBeInTheDocument())
      vi.unstubAllGlobals()
   })

   it('edit profile page loads the form', async () => {
      signIn()
      vi.stubGlobal(
         'fetch',
         vi.fn(
            async () =>
               new Response(JSON.stringify({ name: 'Ada', email: 'a@b.co', phone: '0912' }))
         )
      )

      render(<EditProfilePage />)

      await waitFor(() => expect(screen.getByDisplayValue('Ada')).toBeInTheDocument())
      vi.unstubAllGlobals()
   })

   it('orders page loads the table', async () => {
      signIn()
      vi.stubGlobal(
         'fetch',
         vi.fn(
            async () =>
               new Response(
                  JSON.stringify([
                     {
                        id: 'o1',
                        number: 42,
                        createdAt: '2024-02-01',
                        payable: 120,
                        isPaid: true,
                     },
                  ])
               )
         )
      )

      render(<OrdersProfilePage />)

      await waitFor(() => expect(screen.getByText('#۴۲')).toBeInTheDocument())
      vi.unstubAllGlobals()
   })

   it('address detail page renders the form for the id', async () => {
      prismaMock.address.findUnique.mockResolvedValue({
         id: 'ad1',
         city: 'Tehran',
         address: 'Main',
         phone: '0912',
         postalCode: '123',
      })

      render(await AddressPage({ params: Promise.resolve({ addressId: 'ad1' }) }))

      expect(screen.getByText('Edit address')).toBeInTheDocument()
   })

   it('order detail page loads the order id for a signed-in visitor', async () => {
      signIn()
      vi.stubGlobal(
         'fetch',
         vi.fn(async () =>
            new Response(
               JSON.stringify({
                  id: 'o1',
                  status: 'Processing',
                  shippingMethodName: null,
                  shippingCarrierName: null,
                  shippingTrackingNumber: null,
               })
            )
         )
      )

      /* `use(params)` suspends on first render; flushing inside `act` lets the
         promise settle and the page render its content. */
      await act(async () => {
         render(<ProfileOrderPage params={Promise.resolve({ orderId: 'o1' })} />)
      })

      await waitFor(() => expect(screen.getByText(/شماره سفارش:\s*o1/)).toBeInTheDocument())
      expect(screen.getByText(/وضعیت سفارش:\s*در حال پردازش/)).toBeInTheDocument()
      expect(screen.getByText('کد رهگیری هنوز ثبت نشده است.')).toBeInTheDocument()
      expect(screen.getByText(/روش ارسال:\s*—/)).toBeInTheDocument()
      expect(screen.getByText(/شرکت حمل‌ونقل:\s*—/)).toBeInTheDocument()
      expect(routerMock.push).not.toHaveBeenCalled()
      vi.unstubAllGlobals()
   })

   it('order detail page falls back to the raw status when it has no label', async () => {
      signIn()
      vi.stubGlobal(
         'fetch',
         vi.fn(async () =>
            new Response(
               JSON.stringify({
                  id: 'o3',
                  status: 'AwaitingCustoms',
                  shippingMethodName: null,
                  shippingCarrierName: null,
                  shippingTrackingNumber: null,
               })
            )
         )
      )

      await act(async () => {
         render(<ProfileOrderPage params={Promise.resolve({ orderId: 'o3' })} />)
      })

      await waitFor(() => expect(screen.getByText(/AwaitingCustoms/)).toBeInTheDocument())
      vi.unstubAllGlobals()
   })

   it('order detail page shows the tracking number and the shipping details', async () => {
      signIn()
      vi.stubGlobal(
         'fetch',
         vi.fn(async () =>
            new Response(
               JSON.stringify({
                  id: 'o2',
                  number: 42,
                  status: 'Shipped',
                  isPaid: true,
                  payable: 1800,
                  shipping: 200,
                  createdAt: '2026-01-01T00:00:00.000Z',
                  shippingMethodName: 'پست پیشتاز',
                  shippingCarrierName: 'پست',
                  shippingTrackingNumber: 'TRK-987',
                  orderItems: [
                     {
                        count: 2,
                        price: 1000,
                        discount: 100,
                        product: { title: 'کیف چرمی' },
                     },
                  ],
               })
            )
         )
      )

      await act(async () => {
         render(<ProfileOrderPage params={Promise.resolve({ orderId: 'o2' })} />)
      })

      await waitFor(() => expect(screen.getByText('TRK-987')).toBeInTheDocument())
      expect(screen.getByText(/روش ارسال:\s*پست پیشتاز/)).toBeInTheDocument()
      expect(screen.getByText(/شرکت حمل‌ونقل:\s*پست/)).toBeInTheDocument()
      expect(screen.getByText(/وضعیت سفارش:\s*ارسال شده/)).toBeInTheDocument()
      expect(screen.queryByText('کد رهگیری هنوز ثبت نشده است.')).not.toBeInTheDocument()
      vi.unstubAllGlobals()
   })
})

describe('wishlist page', () => {
   it('prompts a guest to sign in once the session resolves', async () => {
      render(<WishlistPage />)

      await waitFor(() =>
         expect(
            screen.getByText('برای دیدن علاقه‌مندی‌ها وارد حساب خود شوید.')
         ).toBeInTheDocument()
      )
      expect(screen.getByRole('link', { name: 'ورود به حساب' })).toHaveAttribute('href', '/login')
   })

   it('keeps a signed-in visitor on the page and renders saved wishlist products', async () => {
      signIn()
      vi.stubGlobal(
         'fetch',
         vi.fn(async () => new Response(JSON.stringify([product])))
      )
      render(<WishlistPage />)

      await waitFor(() => expect(screen.getByText(product.title)).toBeInTheDocument())
      vi.unstubAllGlobals()
   })
})

describe('ProductGrid', () => {
   it('frames each product card in a link', () => {
      render(<ProductGrid products={[product as never]} />)

      expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/products/p1')
   })

   it('renders an empty grid for a catalogue with no products', () => {
      const { container } = render(<ProductGrid products={[]} />)

      expect(container.querySelectorAll('a')).toHaveLength(0)
   })
})

