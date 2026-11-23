import { jsonBody } from '../support/http'
import { stubLocation } from '../support/location'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { OrderForm as AdminOrderForm } from '@/app/admin/(dashboard)/orders/[orderId]/components/order-form'
import { PaymentForm } from '@/app/admin/(dashboard)/payments/[paymentId]/components/payment-form'
import { UserForm as AdminUserForm } from '@/app/admin/(dashboard)/users/[userId]/components/user-form'
import { UserAuthForm as AdminAuthForm } from '@/app/admin/login/components/user-auth-form'
import { UserAuthForm } from '@/app/login/components/user-auth-form'
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

describe('storefront login form', () => {
   it('asks for an email and enables the button once it is valid', async () => {
      const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response('{}', { status: 200 })))
      vi.stubGlobal('fetch', fetchMock)

      render(<UserAuthForm />)

      expect(screen.getByRole('button', { name: /login with email/i })).toBeDisabled()

      setParams({ email: 'buyer@example.com' })
      await user().type(screen.getByPlaceholderText('name@example.com'), 'a')

      await waitFor(() => { expect(routerMock.replace).toHaveBeenCalled(); })
      vi.unstubAllGlobals()
   })

   it('requests an OTP and switches to the verification step', async () => {
      setParams({ email: 'buyer@example.com' })
      const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response('{}', { status: 200 })))
      vi.stubGlobal('fetch', fetchMock)

      render(<UserAuthForm />)

      await user().click(screen.getByRole('button', { name: /login with email/i }))

      await waitFor(() => expect(screen.getByText('One-Time Password')).toBeInTheDocument())
      expect(fetchMock).toHaveBeenCalledWith(
         '/api/auth/otp/email/try',
         expect.objectContaining({ method: 'POST' })
      )
      vi.unstubAllGlobals()
   })

   it('stays on the email step when the request fails logically', async () => {
      setParams({ email: 'buyer@example.com' })
      vi.stubGlobal('fetch', vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response('{}', { status: 500 }))))

      render(<UserAuthForm />)
      await user().click(screen.getByRole('button', { name: /login with email/i }))

      await waitFor(() => expect(screen.getByRole('button', { name: /login with email/i })).toBeEnabled())
      vi.unstubAllGlobals()
   })

   it('logs a network failure', async () => {
      setParams({ email: 'buyer@example.com' })
      vi.stubGlobal('fetch', vi.fn(() => { return Promise.reject(new Error('offline')); }))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })

      render(<UserAuthForm />)
      await user().click(screen.getByRole('button', { name: /login with email/i }))

      await waitFor(() => { expect(errorSpy).toHaveBeenCalled(); })
      vi.unstubAllGlobals()
      errorSpy.mockRestore()
   })

   it('requests an OTP by phone', async () => {
      setParams({ method: 'phone', phone: '09123456789' })
      const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response('{}', { status: 200 })))
      vi.stubGlobal('fetch', fetchMock)

      render(<UserAuthForm />)

      await user().click(screen.getByRole('button', { name: /login with phone/i }))

      await waitFor(() => expect(screen.getByText('One-Time Password')).toBeInTheDocument())
      expect(fetchMock).toHaveBeenCalledWith(
         '/api/auth/otp/phone/try',
         expect.objectContaining({ method: 'POST' })
      )
      vi.unstubAllGlobals()
   })

   it('warns about an invalid phone number', () => {
      setParams({ method: 'phone', phone: '123' })

      render(<UserAuthForm />)

      expect(screen.getByText('Phone Number is not valid.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /login with phone/i })).toBeDisabled()
   })

   it('switches between email and phone methods', async () => {
      render(<UserAuthForm />)

      await user().click(screen.getByRole('button', { name: /phone number/i }))

      expect(routerMock.replace).toHaveBeenCalledWith('/login?method=phone', { scroll: false })
   })

   it('switches back to email from the phone method', async () => {
      setParams({ method: 'phone' })

      render(<UserAuthForm />)
      await user().click(screen.getByRole('button', { name: 'Email' }))

      expect(routerMock.replace).toHaveBeenCalledWith('/login?method=email', { scroll: false })
   })

   it('verifies the OTP, clears the guest cart and redirects home', async () => {
      setParams({ email: 'buyer@example.com', OTP: '12345' })
      localStorage.setItem('Cart', JSON.stringify({ items: [{ productId: 'p1', count: 1 }] }))
      const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response('{}', { status: 200 })))
      vi.stubGlobal('fetch', fetchMock)
      const assign = vi.fn()
      stubLocation({ assign, origin: 'http://localhost' })

      render(<UserAuthForm />)
      /* Advance to the verification step first. */
      setParams({ email: 'buyer@example.com', OTP: '12345' })
      await user().click(screen.getByRole('button', { name: /login with email/i }))
      await waitFor(() => expect(screen.getByText('One-Time Password')).toBeInTheDocument())

      await user().type(screen.getByPlaceholderText('12345'), '1')
      await user().click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => { expect(assign).toHaveBeenCalled(); })
      expect(localStorage.getItem('Cart')).toBe('{"items":[]}')
      vi.unstubAllGlobals()
   })

   it('keeps the verification step when the OTP is rejected', async () => {
      const fetchMock = vi
         .fn()
         .mockResolvedValueOnce(new Response('{}', { status: 200 }))
         .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      vi.stubGlobal('fetch', fetchMock)
      const assign = vi.fn()
      stubLocation({ assign, origin: 'http://localhost' })
      setParams({ email: 'buyer@example.com', OTP: '00000' })

      render(<UserAuthForm />)
      await user().click(screen.getByRole('button', { name: /login with email/i }))
      await waitFor(() => expect(screen.getByText('One-Time Password')).toBeInTheDocument())

      await user().click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => { expect(fetchMock).toHaveBeenCalledTimes(2); })
      expect(assign).not.toHaveBeenCalled()
      vi.unstubAllGlobals()
   })
})

describe('admin login form', () => {
   it('uses the admin OTP endpoints', async () => {
      setParams({ email: 'owner@example.com' })
      const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response('{}', { status: 200 })))
      vi.stubGlobal('fetch', fetchMock)

      render(<AdminAuthForm />)

      await user().click(screen.getByRole('button', { name: /login with email/i }))

      await waitFor(() => { expect(fetchMock).toHaveBeenCalled(); })
      expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/auth/otp/email/try')

      /* Verifying lands the owner in the dashboard. */
      const assign = vi.fn()
      stubLocation({ assign, origin: 'http://localhost' })
      setParams({ email: 'owner@example.com', OTP: '12345' })
      await user().click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => { expect(fetchMock).toHaveBeenLastCalledWith(
            '/api/admin/auth/otp/email/verify',
            expect.objectContaining({ method: 'POST' })
         ); }
      )
      await waitFor(() => { expect(assign).toHaveBeenCalledWith('http://localhost/admin'); })
      vi.unstubAllGlobals()
   })

   it('stays on the email step when the OTP request fails', async () => {
      setParams({ email: 'owner@example.com' })
      const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response('{}', { status: 500 })))
      vi.stubGlobal('fetch', fetchMock)

      render(<AdminAuthForm />)

      await user().click(screen.getByRole('button', { name: /login with email/i }))
      await waitFor(() => { expect(fetchMock).toHaveBeenCalled(); })

      /* Same email step: the OTP boxes are not rendered. */
      expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /login with email/i })).toBeEnabled()
      vi.unstubAllGlobals()
   })

   it('keeps the raw email when no query params are set', () => {
      setParams({})
      render(<AdminAuthForm />)

      const input = screen.getByPlaceholderText('name@example.com')
      expect(input).toHaveValue('')
   return Promise.resolve(); })
})
