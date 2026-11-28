import { jsonBody } from '../support/http'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { OrderForm as AdminOrderForm } from '@/app/admin/(dashboard)/orders/[orderId]/components/order-form'
import { PaymentForm } from '@/app/admin/(dashboard)/payments/[paymentId]/components/payment-form'
import { UserForm as AdminUserForm } from '@/app/admin/(dashboard)/users/[userId]/components/user-form'
import { routerMock } from '../support/navigation'

const searchParams = new URLSearchParams()

vi.mock('next/navigation', async (importOriginal) => {
   const actual = await importOriginal<typeof import('next/navigation')>()
   const navigation = await import('../support/navigation')

   return {
      ...actual,
      ...navigation,
      useParams: () => ({ orderId: 'o1', paymentId: 'pay1', userId: 'u1' }),
      useSearchParams: () => searchParams,
      usePathname: () => '/login',
   }
})

vi.mock('react-hot-toast', () => ({
   toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

const user = () => userEvent.setup({ pointerEventsCheck: 0 })

const setParams = (values: Record<string, string>) => {
   for (const key of new Set(searchParams.keys())) searchParams.delete(key)
   for (const [key, value] of Object.entries(values)) searchParams.set(key, value)
}

const orderData = {
   id: 'o1',
   status: 'Processing',
   shipping: 10,
   payable: 100,
   discount: 0,
   isPaid: false,
   isCompleted: false,
}

beforeEach(() => {
   setParams({})
   routerMock.replace.mockClear()
   routerMock.push.mockClear()
})

describe('admin PaymentForm', () => {
   it('patches the payment and returns to the list', async () => {
      const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response('{}', { status: 200 })))
      vi.stubGlobal('fetch', fetchMock)
      const { toast } = await import('react-hot-toast')

      render(<PaymentForm initialData={orderData as never} />)

      await user().click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => { expect(fetchMock).toHaveBeenCalled(); })
      expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/payments/pay1')
      expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'PATCH' })
      /* The payment form reuses the order copy. */
      await waitFor(() => { expect(toast.success).toHaveBeenCalledWith('Order updated.'); })
      vi.unstubAllGlobals()
   })

   it('starts from zeroed defaults without a payment', () => {
      render(<PaymentForm initialData={null} />)

      expect(screen.getAllByRole('spinbutton').length).toBeGreaterThanOrEqual(3)
   })

   it('surfaces the API message when the patch fails', async () => {
      vi.stubGlobal(
         'fetch',
         vi.fn(() => Promise.resolve(Response.json({ message: 'NOPE' }, { status: 409 })))
      )
      const { toast } = await import('react-hot-toast')

      render(<PaymentForm initialData={orderData as never} />)
      await user().click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('NOPE'); })
      vi.unstubAllGlobals()
   })

   it('falls back to the status code when the body is unreadable', async () => {
      vi.stubGlobal(
         'fetch',
         vi.fn(() => Promise.resolve(new Response('not json', { status: 500 })))
      )
      const { toast } = await import('react-hot-toast')

      render(<PaymentForm initialData={orderData as never} />)
      await user().click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('500'); })
      vi.unstubAllGlobals()
   })
})

describe('admin OrderForm', () => {
   it('patches the order status', async () => {
      const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response('{}', { status: 200 })))
      vi.stubGlobal('fetch', fetchMock)
      const { toast } = await import('react-hot-toast')

      render(<AdminOrderForm initialData={orderData as never} />)

      await user().click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => { expect(fetchMock).toHaveBeenCalled(); })
      expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/orders/o1')
      const payload = jsonBody(fetchMock.mock.calls[0][1]?.body)
      expect(payload.status).toBe('Processing')
      expect(payload).not.toHaveProperty('isPaid')
      expect(payload).not.toHaveProperty('isCompleted')
      await waitFor(() => { expect(toast.success).toHaveBeenCalledWith('Order updated.'); })
      vi.unstubAllGlobals()
   })

   it('submits a valid fulfilment status with its tracking number', async () => {
      const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response('{}', { status: 200 })))
      vi.stubGlobal('fetch', fetchMock)

      render(<AdminOrderForm initialData={{ ...orderData, isPaid: true } as never} />)

      await user().selectOptions(screen.getByRole('combobox'), 'Shipped')
      await user().type(screen.getByPlaceholderText('کد رهگیری را وارد کنید'), 'TRK-42')
      await user().click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => { expect(fetchMock).toHaveBeenCalled(); })
      const payload = jsonBody(fetchMock.mock.calls[0][1]?.body)
      expect(payload).toEqual({ status: 'Shipped', shippingTrackingNumber: 'TRK-42' })
      vi.unstubAllGlobals()
   })

   it('shows the API message on a failed patch', async () => {
      vi.stubGlobal(
         'fetch',
         vi.fn(() => Promise.resolve(Response.json({ message: 'LOCKED' }, { status: 400 })))
      )
      const { toast } = await import('react-hot-toast')

      render(<AdminOrderForm initialData={orderData as never} />)
      await user().click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('LOCKED'); })
      vi.unstubAllGlobals()
   })

   it('starts from a pending-payment order without editable payment controls', () => {
      render(<AdminOrderForm initialData={null} />)

      expect(screen.getByRole('combobox')).toHaveValue('PendingPayment')
      expect(screen.getByPlaceholderText('کد رهگیری را وارد کنید')).toBeInTheDocument()
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
   })

   it('populates and submits the shipment tracking number', async () => {
      const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response('{}', { status: 200 })))
      vi.stubGlobal('fetch', fetchMock)

      render(
         <AdminOrderForm
            initialData={{ ...orderData, shippingTrackingNumber: 'TRK-555' } as never}
         />
      )

      const input = screen.getByPlaceholderText('کد رهگیری را وارد کنید')
      expect(input).toHaveValue('TRK-555')
      await user().clear(input)
      await user().type(input, 'TRK-777')
      await user().click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => { expect(fetchMock).toHaveBeenCalled(); })
      const payload = jsonBody(fetchMock.mock.calls[0][1]?.body)
      expect(payload.shippingTrackingNumber).toBe('TRK-777')
      vi.unstubAllGlobals()
   })
})

describe('admin UserForm', () => {
   const userData = {
      id: 'u1',
      name: 'Ada',
      email: 'a@b.co',
      phone: '0912',
      isBanned: false,
   }

   it('patches the user and returns to the list', async () => {
      const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response('{}', { status: 200 })))
      vi.stubGlobal('fetch', fetchMock)
      const { toast } = await import('react-hot-toast')

      render(<AdminUserForm initialData={userData as never} />)

      await user().click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => { expect(fetchMock).toHaveBeenCalled(); })
      expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/users/u1')
      await waitFor(() => { expect(toast.success).toHaveBeenCalledWith('User updated.'); })
      vi.unstubAllGlobals()
   })

   it('shows the conflict message when the user cannot be saved', async () => {
      vi.stubGlobal(
         'fetch',
         vi.fn(() =>
            Promise.resolve(Response.json({ message: 'EMAIL OR PHONE ALREADY IN USE' }, {
               status: 409,
            }))
         )
      )
      const { toast } = await import('react-hot-toast')

      render(<AdminUserForm initialData={userData as never} />)
      await user().click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('EMAIL OR PHONE ALREADY IN USE'); }
      )
      vi.unstubAllGlobals()
   })

   it('toggles the banned checkbox', async () => {
      render(<AdminUserForm initialData={userData as never} />)

      await user().click(screen.getByRole('checkbox'))

      expect(screen.getByRole('checkbox')).toHaveAttribute('data-state', 'checked')
   })
})
