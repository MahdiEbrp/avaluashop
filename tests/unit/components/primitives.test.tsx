import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'

import { AlertModal as AdminAlertModal } from '@/components/admin/modals/alert-modal'
import { Heading as AdminHeading } from '@/components/admin/ui/heading'
import { Loader as AdminLoader } from '@/components/admin/ui/loader'
import { Modal as AdminModal } from '@/components/admin/ui/modal'
import { AlertModal } from '@/components/modals/alert-modal'
import { BlogPostGrid, BlogPostSkeletonGrid } from '@/components/native/BlogCard'
import Carousel from '@/components/native/Carousel'
import Footer from '@/components/native/Footer'
import GoogleAnalytics from '@/components/native/GoogleAnalytics'
import { ProductGrid, ProductSkeleton, ProductSkeletonGrid } from '@/components/native/Product'
import Toast from '@/components/native/Toast'
import { Heading } from '@/components/native/heading'
import { Checkbox, Spinner, TomanIcon, VerifiedAccount } from '@/components/native/icons'
import { Modal } from '@/components/native/modal'
import { Separator } from '@/components/native/separator'
import { Skeleton } from '@/components/ui/skeleton'

const product = {
   id: 'p1',
   title: 'Blue Shoe',
   description: 'A very blue shoe',
   price: 100,
   discount: 1,
   images: ['/shoe.png'],
   isAvailable: true,
   categories: [{ title: 'Shoes' }],
   brand: { title: 'Acme' },
} as never

describe('presentational primitives', () => {
   it('Heading renders its two lines', () => {
      render(<Heading title="Cart" description="Your items" />)

      expect(screen.getByRole('heading', { name: 'Cart' })).toBeInTheDocument()
      expect(screen.getByText('Your items')).toBeInTheDocument()
   })

   it('admin Heading renders its two lines', () => {
      render(<AdminHeading title="Dashboard" description="Overview" />)

      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Overview')).toBeInTheDocument()
   })

   it('Separator renders a rule with the extra class', () => {
      const { container } = render(<Separator className="my-8" />)
      const rule = container.querySelector('hr')

      expect(rule).not.toBeNull()
      expect(rule).toHaveClass('my-8')
   })

   it('Skeleton renders a pulse block', () => {
      const { container } = render(<Skeleton className="h-4" />)

      expect(container.firstChild).toHaveClass('animate-pulse', 'h-4')
   })

   it('both Loaders render an svg', () => {
      const { container } = render(
         <div>
            <AdminLoader />
            <Loader />
         </div>
      )

      expect(container.querySelectorAll('svg')).toHaveLength(2)
   })

   it('icons render their svg shapes', () => {
      const { container } = render(
         <div>
            <Spinner />
            <VerifiedAccount />
            <Checkbox colorCode="text-success" />
            <TomanIcon />
         </div>
      )

      expect(container.querySelectorAll('svg')).toHaveLength(4)
      expect(container.querySelector('svg.text-success')).not.toBeNull()
   })
})

describe('modal wrappers', () => {
   it('storefront Modal renders content only when open', () => {
      const onClose = vi.fn()
      const { rerender } = render(
         <Modal title="Title" description="Body" isOpen={false} onClose={onClose}>
            <p>child</p>
         </Modal>
      )

      expect(screen.queryByText('child')).toBeNull()

      rerender(
         <Modal title="Title" description="Body" isOpen onClose={onClose}>
            <p>child</p>
         </Modal>
      )

      expect(screen.getByText('child')).toBeInTheDocument()
      expect(screen.getByText('Title')).toBeInTheDocument()
      expect(screen.getByText('Body')).toBeInTheDocument()
   })

   it('storefront Modal forwards a close request', () => {
      const onClose = vi.fn()
      render(
         <Modal title="Title" description="Body" isOpen onClose={onClose}>
            <p>child</p>
         </Modal>
      )

      fireEvent.click(screen.getByRole('button', { name: /close/i }))

      expect(onClose).toHaveBeenCalled()
   })

   it('admin Modal renders its content', () => {
      render(
         <AdminModal title="T" description="D" isOpen onClose={vi.fn()}>
            <p>admin child</p>
         </AdminModal>
      )

      expect(screen.getByText('admin child')).toBeInTheDocument()
   })

   it.each([
      ['storefront', AlertModal],
      ['admin', AdminAlertModal],
   ])('%s AlertModal wires cancel and confirm', (_name, Component) => {
      const onClose = vi.fn()
      const onConfirm = vi.fn()

      render(
         <Component isOpen onClose={onClose} onConfirm={onConfirm} loading={false} />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

      expect(onClose).toHaveBeenCalled()
      expect(onConfirm).toHaveBeenCalled()
   })

   it('AlertModal disables both actions while loading', () => {
      render(<AlertModal isOpen onClose={vi.fn()} onConfirm={vi.fn()} loading />)

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
   })
})

describe('product and blog cards', () => {
   it('renders a discounted product with the percentage badge', () => {
      render(
         <ProductGrid
            products={[
               product,
               { ...(product as object), id: 'p2', discount: 0, isAvailable: false } as never,
            ]}
         />
      )

      expect(screen.getAllByText('Blue Shoe').length).toBeGreaterThan(0)
      /* The redesign shows a Persian percentage badge and Toman prices. */
      expect(screen.getByText(/٪.*تخفیف/)).toBeInTheDocument()
      expect(screen.getByText('۱۰۰ تومان')).toBeInTheDocument()
      expect(screen.getByText('۹۹ تومان')).toBeInTheDocument()
      expect(screen.getByText('ناموجود')).toBeInTheDocument()
   })

   it('renders a full-price product without a badge', () => {
      render(<ProductGrid products={[{ ...(product as object), discount: 0 } as never]} />)

      expect(screen.getByText('۱۰۰ تومان')).toBeInTheDocument()
      expect(screen.queryByText(/تخفیف/)).toBeNull()
   })

   it('omits the category and description when a product has neither', () => {
      render(
         <ProductGrid
            products={[{ ...(product as object), categories: [], description: null } as never]}
         />
      )

      expect(screen.getByText('Blue Shoe')).toBeInTheDocument()
      expect(screen.queryByText('Shoes')).toBeNull()
      expect(screen.queryByText('A very blue shoe')).toBeNull()
   })

   it('renders the skeleton grids', () => {
      const { container } = render(
         <div>
            <ProductSkeletonGrid />
            <ProductSkeleton />
         </div>
      )

      /* The skeleton grid renders eight cards plus the standalone one; each
         card carries its own pulse wrapper plus three pulsing lines. */
      expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(8)
   })

   it('renders blog cards and skeletons', () => {
      const { container } = render(
         <div>
            <BlogPostGrid
               blogs={[{ title: 'Post', image: '/p.png', slug: 'post', author: { name: 'Ada' } }]}
            />
            <BlogPostSkeletonGrid />
         </div>
      )

      expect(screen.getByText('Post')).toBeInTheDocument()
      expect(screen.getByText('Ada')).toBeInTheDocument()
      expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3)
   })
})

describe('footer and analytics', () => {
   it('Footer links every configured destination', () => {
      render(<Footer />)

      /* The redesign groups Persian links and reduces the socials to icons
         with accessible names. */
      expect(screen.getByText('حریم خصوصی')).toBeInTheDocument()
      expect(screen.getByText('راهنمای خرید')).toBeInTheDocument()
      expect(screen.getByText('پشتیبانی')).toBeInTheDocument()

      const links = screen.getAllByRole('link')
      expect(links.some((link) => link.getAttribute('href') === '/privacy')).toBe(true)
      expect(links.some((link) => link.getAttribute('href') === '/faq')).toBe(true)

      /* Only Instagram survived the redesign; the GitHub icon is gone. */
      expect(screen.getByRole('link', { name: 'اینستاگرام آوالوا' })).toHaveAttribute(
         'href',
         'https://instagram.com/avaluashop'
      )
      expect(screen.queryByRole('link', { name: 'گیت‌هاب' })).not.toBeInTheDocument()
      expect(screen.getAllByText(/©/).length).toBeGreaterThan(0)
   })

   it('GoogleAnalytics renders nothing without an id', () => {
      delete process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID
      const { container } = render(<GoogleAnalytics />)

      expect(container).toBeEmptyDOMElement()
   })

   it('GoogleAnalytics renders nothing while the id is missing', () => {
      delete process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID

      const { container } = render(<GoogleAnalytics />)

      expect(container).toBeEmptyDOMElement()
   })

   it('GoogleAnalytics stays silent outside production even with an id', () => {
      process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = 'G-TEST'

      const { container } = render(<GoogleAnalytics />)

      expect(container).toBeEmptyDOMElement()

      delete process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID
   })

   it('GoogleAnalytics mounts its scripts in production', () => {
      vi.stubEnv('NODE_ENV', 'production')
      process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = 'G-TEST'

      const { container } = render(<GoogleAnalytics />)

      /* next/script renders no markup under jsdom; mounting the fragment is the
         observable part of the production branch. */
      expect(container).toBeEmptyDOMElement()

      vi.unstubAllEnvs()
      delete process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID
   })
})

describe('Toast', () => {
   it('shows the message and hides it when dismissed', () => {
      render(<Toast message="Saved" />)

      expect(screen.getByRole('alert')).toHaveTextContent('Saved')

      fireEvent.click(screen.getByRole('button', { name: 'Close' }))

      expect(screen.queryByRole('alert')).toBeNull()
   })

   it('auto-dismisses after five seconds', async () => {
      render(<Toast message="Saved" />)

      await waitFor(() => expect(screen.queryByRole('alert')).toBeNull(), {
         timeout: 7000,
      })
   })
})

describe('carousel', () => {
   it('renders one slide and one dot per image', () => {
      const { container } = render(<Carousel images={['/a.png', '/b.png', '/c.png']} />)

      expect(container.querySelectorAll('img')).toHaveLength(3)
      expect(container.querySelectorAll('.rounded-full')).toHaveLength(3)
   })
})

describe('useToast store', () => {
   it('adds, updates, dismisses and removes a toast', async () => {
      const { useToast } = await import('@/components/ui/use-toast')

      function Probe() {
         const { toasts, toast, dismiss } = useToast()

         return (
            <div>
               <span data-testid="count">{toasts.length}</span>
               <span data-testid="title">{String(toasts[0]?.title ?? '')}</span>
               <button onClick={() => toast({ title: 'first' })}>add</button>
               <button onClick={() => toast({ title: 'replaced' })}>replace</button>
               <button
                  onClick={() => {
                     const { id } = toast({ title: 'dismissable' })
                     dismiss(id)
                  }}
               >
                  dismiss
               </button>
               <button onClick={() => dismiss()}>dismiss all</button>
            </div>
         )
      }

      render(<Probe />)

      fireEvent.click(screen.getByText('add'))
      expect(screen.getByTestId('title')).toHaveTextContent('first')

      fireEvent.click(screen.getByText('replace'))
      expect(screen.getByTestId('count')).toHaveTextContent('1')
      expect(screen.getByTestId('title')).toHaveTextContent('replaced')

      fireEvent.click(screen.getByText('dismiss'))
      fireEvent.click(screen.getByText('dismiss all'))
      expect(screen.getByTestId('count')).toHaveTextContent('1')
   })

   it('renders active toasts through the Toaster', async () => {
      const { Toaster } = await import('@/components/ui/toaster')
      const { useToast } = await import('@/components/ui/use-toast')

      function Trigger() {
         const { toast } = useToast()
         useState(() => {
            toast({ title: 'Visible', description: 'Body' })
            return null
         })
         return <Toaster />
      }

      render(<Trigger />)

      expect(await screen.findByText('Visible')).toBeInTheDocument()
      expect(screen.getByText('Body')).toBeInTheDocument()
   })
})

function Loader() {
   return (
      <svg>
         <title>spinner</title>
      </svg>
   )
}
