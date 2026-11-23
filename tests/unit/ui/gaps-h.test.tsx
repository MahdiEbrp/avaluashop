import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { BannerForm } from '@/app/admin/(dashboard)/banners/[bannerId]/components/banner-form'
import { BrandForm } from '@/app/admin/(dashboard)/brands/[brandId]/components/brand-form'
import { CategoryForm } from '@/app/admin/(dashboard)/categories/[categoryId]/components/category-form'
import { ProductForm } from '@/app/admin/(dashboard)/products/[productId]/components/product-form'
import { OrderForm as AdminOrderForm } from '@/app/admin/(dashboard)/orders/[orderId]/components/order-form'
import { PaymentForm } from '@/app/admin/(dashboard)/payments/[paymentId]/components/payment-form'
import { routerMock } from '../support/navigation'

vi.mock('next/navigation', async (importOriginal) => {
   const actual = await importOriginal<typeof import('next/navigation')>()
   const navigation = await import('../support/navigation')

   return {
      ...actual,
      ...navigation,
      useParams: () => ({ bannerId: 'b1', brandId: 'br1', categoryId: 'c1', orderId: 'o1', paymentId: 'pay1', productId: 'p1' }),
      usePathname: () => '/admin',
   }
})

vi.mock('react-hot-toast', () => ({
   toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

const user = () => userEvent.setup({ pointerEventsCheck: 0 })

beforeEach(() => {
   routerMock.refresh.mockClear()
   routerMock.push.mockClear()
})

const openDeleteModal = async () => {
   const destructive = screen
      .getAllByRole('button')
      .find((button) => button.className.includes('destructive'))

   await user().click(destructive)
   await screen.findByRole('button', { name: 'Continue' })
}

const closeDeleteModal = async () => {
   await user().click(screen.getByRole('button', { name: 'Cancel' }))
   await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument()
   )
}

describe('banner form image field', () => {
   it('removes the current image through the upload control', async () => {
      render(
         <BannerForm
            initialData={{ id: 'b1', label: 'Sale', image: 'https://cdn/x.png' } as never}
         />
      )

      /* Two destructive controls: the header delete button and the image's
         trash button. The last one belongs to the upload field. */
      const destructive = screen
         .getAllByRole('button')
         .filter((button) => button.className.includes('destructive'))

      expect(destructive.length).toBe(2)
      fireEvent.click(destructive[1])

      await waitFor(() => { expect(
            screen.getAllByRole('button').filter((b) => b.className.includes('destructive'))
         ).toHaveLength(1); }
      )
   })

   it('closes the delete confirmation without deleting', async () => {
      render(
         <BannerForm
            initialData={{ id: 'b1', label: 'Sale', image: 'https://cdn/x.png' } as never}
         />
      )

      await openDeleteModal()
      await closeDeleteModal()

      expect(routerMock.push).not.toHaveBeenCalled()
   })
})

describe('brand form delete confirmation', () => {
   it('closes the confirmation without deleting', async () => {
      render(
         <BrandForm
            initialData={
               { id: 'br1', title: 'Acme', description: 'Shoes', logo: 'https://cdn/l.png' }
            }
         />
      )

      await openDeleteModal()
      await closeDeleteModal()

      expect(routerMock.push).not.toHaveBeenCalled()
   })
})

describe('category form delete confirmation', () => {
   it('closes the confirmation without deleting', async () => {
      render(
         <CategoryForm
            initialData={{ id: 'c1', title: 'Shoes', description: 'b1' } as never}
         />
      )

      await openDeleteModal()
      await closeDeleteModal()

      expect(routerMock.push).not.toHaveBeenCalled()
   })
})

describe('product form delete confirmation', () => {
   it('closes the confirmation without deleting', async () => {
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

      await openDeleteModal()
      await closeDeleteModal()

      expect(routerMock.push).not.toHaveBeenCalled()
   })
})

describe('admin order form error handling', () => {
   const initialData = {
      id: 'o1',
      status: 'Processing',
      shipping: 10,
      payable: 100,
      discount: 0,
      isPaid: true,
      isCompleted: false,
   }

   it('shows the API message from a rejected save', async () => {
      const { toast } = await import('react-hot-toast')
      vi.stubGlobal(
         'fetch',
         vi.fn(
            () =>
               Promise.resolve(Response.json({ message: 'Order is locked.' }, { status: 409 }))
         )
      )

      render(<AdminOrderForm initialData={initialData as never} />)
      await user().click(screen.getByRole('button', { name: /save changes/i }))

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('Order is locked.'); })
      vi.unstubAllGlobals()
   })

   it('falls back to the status code when the body is not JSON', async () => {
      const { toast } = await import('react-hot-toast')
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('boom', { status: 503 }))))

      render(<AdminOrderForm initialData={initialData as never} />)
      await user().click(screen.getByRole('button', { name: /save changes/i }))

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('503'); })
      vi.unstubAllGlobals()
   })

   it('falls back to a generic message for a thrown non-Error', async () => {
      const { toast } = await import('react-hot-toast')
      vi.stubGlobal('fetch', vi.fn(async () => { throw 'offline'; }))

      render(<AdminOrderForm initialData={initialData as never} />)
      await user().click(screen.getByRole('button', { name: /save changes/i }))

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('Something went wrong.'); })
      vi.unstubAllGlobals()
   })
})

describe('admin payment form error handling', () => {
   it('falls back to a generic message for a thrown non-Error', async () => {
      const { toast } = await import('react-hot-toast')
      vi.stubGlobal('fetch', vi.fn(async () => { throw 'offline'; }))

      render(
         <PaymentForm
            initialData={
               {
                  id: 'pay1',
                  status: 'Paid',
                  shipping: 10,
                  payable: 100,
                  discount: 0,
                  isPaid: true,
                  isCompleted: false,
               } as never
            }
         />
      )

      await user().click(screen.getByRole('button', { name: /save changes/i }))

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('Something went wrong.'); })
      vi.unstubAllGlobals()
   })
})
