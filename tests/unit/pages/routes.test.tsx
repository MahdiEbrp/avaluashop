import { render, screen } from '@testing-library/react'

import AdminError from '@/app/admin/(dashboard)/error'
import AdminDashboard from '@/app/admin/(dashboard)/page'
import AdminDashboardLayout from '@/app/admin/(dashboard)/layout'
import AdminLoginLayout from '@/app/admin/login/layout'
import AdminLoginPage from '@/app/admin/login/page'
import StorefrontError from '@/app/error'
import RootLayout, { metadata } from '@/app/layout'
import Loading from '@/app/loading'
import NotFound from '@/app/not-found'
import robots from '@/app/robots'
import sitemap from '@/app/sitemap'
import StoreLayout from '@/app/(store)/layout'
import Index from '@/app/(store)/(routes)/page'
import BlogIndex from '@/app/(store)/(routes)/blog/page'
import BlogPostPage from '@/app/(store)/(routes)/blog/[slug]/page'
import CartPage from '@/app/(store)/(routes)/cart/page'
import CheckoutPage from '@/app/(store)/(routes)/checkout/page'
import PrivacyPage from '@/app/(store)/(routes)/privacy/page'
import LoginPage from '@/app/login/page'
import { prismaMock } from '../support/db'

vi.mock('@/lib/prisma', () => import('../support/db').then((m) => m.prismaModule()))
/* The real Next router only exists inside a request; the double resolves to
   the shared router spy so client navigation is assertable. */
vi.mock('next/navigation', async (importOriginal) => {
   const actual = await importOriginal<typeof import('next/navigation')>()
   const navigation = await import('../support/navigation')

   return { ...actual, ...navigation }
})
vi.mock('next-mdx-remote', () => ({
   MDXRemote: ({ source }: { source: string }) => <article>{source}</article>,
}))
vi.mock('next-mdx-remote/serialize', () => ({
   serialize: async (source: string) => ({ source }),
}))

describe('root layout', () => {
   it('renders RTL Persian html with the brand font and providers', () => {
      const { container } = render(
         <RootLayout>
            <p>child</p>
         </RootLayout>
      )

      const html = document.documentElement
      expect(html.getAttribute('lang')).toBe('fa')
      expect(html.getAttribute('dir')).toBe('rtl')
      expect(container.querySelector('p')).toHaveTextContent('child')
   })

   it('declares the site metadata', () => {
      expect(metadata.title.default).toContain('آوالونا شاپ')
      expect(metadata.metadataBase.toString()).toContain('avaluashop')
   })
})

describe('storefront shell', () => {
   it('renders header, children and footer', () => {
      render(
         <StoreLayout>
            <p>store child</p>
         </StoreLayout>
      )

      expect(screen.getByText('store child')).toBeInTheDocument()
      expect(screen.getByRole('banner')).toBeInTheDocument()
      expect(screen.getByRole('contentinfo')).toBeInTheDocument()
   })
})

describe('home page', () => {
   it('renders banners, products and blog cards from the database', async () => {
      prismaMock.product.findMany.mockResolvedValue([
         {
            id: 'p1',
            title: 'Shoe',
            description: 'Blue',
            price: 10,
            discount: 0,
            images: ['/a.png'],
            isAvailable: true,
            categories: [{ title: 'Shoes' }],
            brand: { title: 'Acme' },
         },
      ])
      const element = await Index()
      render(element)

      expect(screen.getByText('Shoe')).toBeInTheDocument()
      /* The accessories-only home page reads the product shelf alone; the blog
         and banner rails were removed with the redesign. */
      expect(prismaMock.product.findMany).toHaveBeenCalledWith(
         expect.objectContaining({ take: 8 })
      )
      expect(prismaMock.blog.findMany).not.toHaveBeenCalled()
      expect(prismaMock.banner.findMany).toHaveBeenCalled()
   })
})

describe('blog', () => {
   it('lists every post', async () => {
      prismaMock.blog.findMany.mockResolvedValue([
         { slug: 'post', title: 'Post', image: '/p.png', author: { name: 'Ada' } },
      ])

      render(await BlogIndex())

      expect(screen.getByText('Blog Posts')).toBeInTheDocument()
      expect(screen.getByText('Post')).toBeInTheDocument()
   })

   it('renders one post with its recommendations', async () => {
      prismaMock.blog.findUnique.mockResolvedValue({
         slug: 'post',
         title: 'Post',
         image: '/p.png',
         content: '# body',
         author: { name: 'Ada' },
      })
      prismaMock.blog.findMany.mockResolvedValue([
         { slug: 'other', title: 'Other', image: '/o.png', author: { name: 'Bob' } },
      ])

      render(await BlogPostPage({ params: Promise.resolve({ slug: 'post' }) }))

      expect(screen.getByRole('heading', { name: 'Post' })).toBeInTheDocument()
      expect(screen.getByText('# body')).toBeInTheDocument()
      expect(screen.getByText('Other')).toBeInTheDocument()
   })
})

describe('static storefront pages', () => {
   it('privacy policy has content', () => {
      render(<PrivacyPage />)

      expect(screen.getByText('Privacy Policy')).toBeInTheDocument()
      expect(screen.getByText('1. Information We Collect')).toBeInTheDocument()
   })

   /* The checkout route used to render a stray Privacy Policy; the real page
      is covered in depth by tests/unit/pages/checkout-page.test.tsx. */
   it('checkout page no longer renders the privacy policy', () => {
      render(<CheckoutPage />)

      expect(screen.queryByText('Privacy Policy')).not.toBeInTheDocument()
      /* Unauthenticated by default, so the page offers the sign-in path. */
      expect(
         screen.getByText('برای ادامه خرید وارد حساب کاربری شوید')
      ).toBeInTheDocument()
   })

   it('cart page renders the cart shell', () => {
      render(<CartPage />)

      expect(screen.getAllByText('سبد خرید').length).toBeGreaterThan(0)
   })

   it('login page renders the auth form', () => {
      render(<LoginPage />)

      expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
   })

   it('admin login page renders the admin form', () => {
      render(<AdminLoginPage />)

      expect(screen.getAllByText(/login/i).length).toBeGreaterThan(0)
   })

   it('admin login layout is a passthrough', () => {
      render(<AdminLoginLayout><p>wrapped</p></AdminLoginLayout>)

      expect(screen.getByText('wrapped')).toBeInTheDocument()
   })
})

describe('dashboard shell', () => {
   it('renders the admin navbar and children', () => {
      render(<AdminDashboardLayout><p>admin child</p></AdminDashboardLayout>)

      expect(screen.getByText('ADMIN')).toBeInTheDocument()
      expect(screen.getByText('admin child')).toBeInTheDocument()
   })

   it('dashboard aggregates are formatted', async () => {
      prismaMock.order.findMany.mockResolvedValue([
         { createdAt: new Date('2024-05-01'), payable: 100, orderItems: [{ price: 100 }] },
      ])
      prismaMock.order.count.mockResolvedValue(1)
      prismaMock.product.count.mockResolvedValue(3)

      render(await AdminDashboard())

      expect(screen.getByText('Total Revenue')).toBeInTheDocument()
      expect(screen.getByText('$100.00')).toBeInTheDocument()
      expect(screen.getByText('Sales')).toBeInTheDocument()
      expect(screen.getByText('Products In Stock')).toBeInTheDocument()
   })
})

describe('error boundaries and 404', () => {
   it('storefront error shows the digest and retries', () => {
      const reset = vi.fn()

      render(<StorefrontError error={Object.assign(new Error('x'), { digest: 'd-1' })} reset={reset} />)

      expect(screen.getByText('d-1')).toBeInTheDocument()
      screen.getByRole('button', { name: /try again/i }).click()
      expect(reset).toHaveBeenCalled()
   })

   it('storefront error falls back to n/a without a digest', () => {
      render(<StorefrontError error={new Error('x')} reset={vi.fn()} />)

      expect(screen.getByText('n/a')).toBeInTheDocument()
   })

   it('admin error links back to the dashboard', () => {
      const reset = vi.fn()

      render(<AdminError error={Object.assign(new Error('x'), { digest: 'd-2' })} reset={reset} />)

      expect(screen.getByText('d-2')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/admin')
      screen.getByRole('button', { name: /retry/i }).click()
      expect(reset).toHaveBeenCalled()
   })

   it('404 keeps the visitor in the shop', () => {
      render(<NotFound />)

      expect(screen.getByRole('link', { name: 'Browse products' })).toHaveAttribute(
         'href',
         '/products'
      )
   })

   it('loading placeholder renders a loader', () => {
      const { container } = render(<Loading />)

      expect(container.querySelector('svg')).not.toBeNull()
   })
})

describe('metadata routes', () => {
   it('robots allows everything', () => {
      expect(robots()).toEqual({ rules: { userAgent: '*', allow: '/' } })
   })

   it('sitemap lists static, product and blog URLs', async () => {
      prismaMock.product.findMany.mockResolvedValue([
         { id: 'p1', updatedAt: new Date('2024-01-01') },
      ])
      prismaMock.blog.findMany.mockResolvedValue([
         { slug: 'post', updatedAt: new Date('2024-02-01') },
      ])

      const entries = await sitemap()

      expect(entries.map((entry) => entry.url)).toEqual([
         `${process.env.NEXT_PUBLIC_URL}`,
         `${process.env.NEXT_PUBLIC_URL}/products`,
         `${process.env.NEXT_PUBLIC_URL}/blog`,
         `${process.env.NEXT_PUBLIC_URL}/products/p1`,
         `${process.env.NEXT_PUBLIC_URL}/blog/post`,
      ])
   })
})
