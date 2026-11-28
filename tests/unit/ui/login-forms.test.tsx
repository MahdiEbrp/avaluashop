import { noop } from '../support/noop'
import { stubLocation } from '../support/location'
import { routerMock } from '../support/navigation'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { UserAuthForm as AdminAuthForm } from '@/app/admin/login/components/user-auth-form'
import { UserAuthForm as StoreAuthForm } from '@/app/login/components/user-auth-form'

/* The storefront form reads only `method` from the URL. Contact details and
   the code live in component state. */
const params = new URLSearchParams()

vi.mock('next/navigation', async (importOriginal) => {
   const actual = await importOriginal<typeof import('next/navigation')>()

   return {
      ...actual,
      useRouter: () => routerMock,
      usePathname: () => '/login',
      useSearchParams: () => params,
   }
})

const user = () => userEvent.setup({ pointerEventsCheck: 0 })

const assignMock = vi.fn()

function setMethod(method: string | null) {
   for (const key of new Set(params.keys())) params.delete(key)
   if (method !== null) params.set('method', method)
}

function deferred() {
   let resolve: (response: Response) => void = noop
   const promise = new Promise<Response>((done) => {
      resolve = done
   })

   return { promise, resolve }
}

function ok() {
   return Promise.resolve(new Response('{}', { status: 200 }))
}

function status(code: number) {
   return Promise.resolve(new Response('{}', { status: code }))
}

beforeEach(() => {
   setMethod(null)
   routerMock.replace.mockClear()
   assignMock.mockClear()
   localStorage.clear()
   stubLocation({ origin: 'http://localhost', assign: assignMock, reload: vi.fn() })
})

afterEach(() => {
   vi.unstubAllGlobals()
   vi.restoreAllMocks()
})

describe('storefront login form: email step', () => {
   it('keeps the button disabled until the email is valid', async () => {
      render(<StoreAuthForm />)

      const button = screen.getByRole('button', { name: 'Login with Email' })
      expect(button).toBeDisabled()

      await user().type(screen.getByPlaceholderText('name@example.com'), 'buyer@example.com')

      expect(button).toBeEnabled()
   })

   it('requests an email OTP and moves to the verification step', async () => {
      const fetchMock = vi.fn(() => ok())
      vi.stubGlobal('fetch', fetchMock)

      render(<StoreAuthForm />)
      await user().type(screen.getByPlaceholderText('name@example.com'), 'buyer@example.com')
      await user().click(screen.getByRole('button', { name: 'Login with Email' }))

      await screen.findByText('One-Time Password')
      expect(fetchMock).toHaveBeenCalledWith(
         '/api/auth/otp/email/try',
         expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'buyer@example.com' }) })
      )
   })

   it('stays on the email step when the request is refused', async () => {
      vi.stubGlobal('fetch', vi.fn(() => status(500)))

      render(<StoreAuthForm />)
      await user().type(screen.getByPlaceholderText('name@example.com'), 'buyer@example.com')
      await user().click(screen.getByRole('button', { name: 'Login with Email' }))

      await waitFor(() => { expect(screen.getByRole('button', { name: 'Login with Email' })).toBeEnabled(); })
      expect(screen.queryByText('One-Time Password')).not.toBeInTheDocument()
   })

   it('logs a network failure and stays on the email step', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(noop)

      render(<StoreAuthForm />)
      await user().type(screen.getByPlaceholderText('name@example.com'), 'buyer@example.com')
      await user().click(screen.getByRole('button', { name: 'Login with Email' }))

      await waitFor(() => { expect(errorSpy).toHaveBeenCalled(); })
      expect(screen.queryByText('One-Time Password')).not.toBeInTheDocument()
   })

   it('shows the spinner and locks the field while the request is in flight', async () => {
      const pending = deferred()
      vi.stubGlobal('fetch', vi.fn(() => pending.promise))

      render(<StoreAuthForm />)
      await user().type(screen.getByPlaceholderText('name@example.com'), 'buyer@example.com')
      await user().click(screen.getByRole('button', { name: 'Login with Email' }))

      expect(screen.getByPlaceholderText('name@example.com')).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Login with Email' })).toBeDisabled()

      pending.resolve(new Response('{}', { status: 500 }))
      await waitFor(() => { expect(screen.getByPlaceholderText('name@example.com')).toBeEnabled(); })
   })
})

describe('storefront login form: phone step', () => {
   it('warns about an invalid number and keeps the button disabled', async () => {
      setMethod('phone')

      render(<StoreAuthForm />)
      await user().type(screen.getByPlaceholderText('+989123456789'), '123')

      expect(screen.getByText('Phone Number is not valid.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Login with Phone' })).toBeDisabled()
   })

   it('normalises Persian digits typed into the phone field', async () => {
      setMethod('phone')

      render(<StoreAuthForm />)
      await user().type(screen.getByPlaceholderText('+989123456789'), '۰۹۱۲۳۴۵۶۷۸۹')

      expect(screen.getByPlaceholderText('+989123456789')).toHaveValue('09123456789')
      expect(screen.getByRole('button', { name: 'Login with Phone' })).toBeEnabled()
   })

   it('requests a phone OTP and moves to the verification step', async () => {
      setMethod('phone')
      const fetchMock = vi.fn(() => ok())
      vi.stubGlobal('fetch', fetchMock)

      render(<StoreAuthForm />)
      await user().type(screen.getByPlaceholderText('+989123456789'), '09123456789')
      await user().click(screen.getByRole('button', { name: 'Login with Phone' }))

      await screen.findByText('One-Time Password')
      expect(fetchMock).toHaveBeenCalledWith(
         '/api/auth/otp/phone/try',
         expect.objectContaining({ method: 'POST', body: JSON.stringify({ phone: '09123456789' }) })
      )
   })

   it('stays on the phone step when the request is refused', async () => {
      setMethod('phone')
      vi.stubGlobal('fetch', vi.fn(() => status(429)))

      render(<StoreAuthForm />)
      await user().type(screen.getByPlaceholderText('+989123456789'), '09123456789')
      await user().click(screen.getByRole('button', { name: 'Login with Phone' }))

      await waitFor(() => { expect(screen.getByRole('button', { name: 'Login with Phone' })).toBeEnabled(); })
      expect(screen.queryByText('One-Time Password')).not.toBeInTheDocument()
   })

   it('logs a network failure while requesting a phone OTP', async () => {
      setMethod('phone')
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(noop)

      render(<StoreAuthForm />)
      await user().type(screen.getByPlaceholderText('+989123456789'), '09123456789')
      await user().click(screen.getByRole('button', { name: 'Login with Phone' }))

      await waitFor(() => { expect(errorSpy).toHaveBeenCalled(); })
   })
})

describe('storefront login form: switching method', () => {
   it('moves from email to phone through the URL method only', async () => {
      render(<StoreAuthForm />)

      await user().click(screen.getByRole('button', { name: /phone number/i }))

      expect(routerMock.replace).toHaveBeenCalledWith('/login?method=phone', { scroll: false })
   })

   it('moves from phone back to email', async () => {
      setMethod('phone')
      render(<StoreAuthForm />)

      await user().click(screen.getByRole('button', { name: 'Email' }))

      expect(routerMock.replace).toHaveBeenCalledWith('/login?method=email', { scroll: false })
   })

   it('offers the switch only before a code has been requested', async () => {
      vi.stubGlobal('fetch', vi.fn(() => ok()))
      render(<StoreAuthForm />)

      await user().type(screen.getByPlaceholderText('name@example.com'), 'buyer@example.com')
      await user().click(screen.getByRole('button', { name: 'Login with Email' }))
      await screen.findByText('One-Time Password')

      expect(screen.queryByRole('button', { name: /phone number/i })).not.toBeInTheDocument()
   })
})

describe('storefront login form: verification', () => {
   async function reachVerifyStep(method: 'email' | 'phone' = 'email') {
      setMethod(method === 'phone' ? 'phone' : null)
      render(<StoreAuthForm />)
      const field = method === 'phone'
         ? screen.getByPlaceholderText('+989123456789')
         : screen.getByPlaceholderText('name@example.com')
      await user().type(field, method === 'phone' ? '09123456789' : 'buyer@example.com')
      await user().click(screen.getByRole('button', { name: method === 'phone' ? 'Login with Phone' : 'Login with Email' }))
      await screen.findByText('One-Time Password')
   }

   it('keeps Submit disabled until six digits are entered', async () => {
      vi.stubGlobal('fetch', vi.fn(() => ok()))
      await reachVerifyStep()

      const submit = screen.getByRole('button', { name: 'Submit' })
      expect(submit).toBeDisabled()

      await user().type(screen.getByPlaceholderText('123456'), '12345')
      expect(submit).toBeDisabled()

      await user().type(screen.getByPlaceholderText('123456'), '6')
      expect(submit).toBeEnabled()
   })

   it('accepts Persian digits and strips anything that is not a digit', async () => {
      vi.stubGlobal('fetch', vi.fn(() => ok()))
      await reachVerifyStep()

      await user().type(screen.getByPlaceholderText('123456'), '۱۲a۳۴۵۶')

      expect(screen.getByPlaceholderText('123456')).toHaveValue('123456')
   })

   it('verifies the email code, sends the guest cart, clears it and returns home', async () => {
      localStorage.setItem('Cart', JSON.stringify({ items: [{ productId: 'p1', count: 1 }] }))
      const fetchMock = vi.fn(() => ok())
      vi.stubGlobal('fetch', fetchMock)
      await reachVerifyStep()

      await user().type(screen.getByPlaceholderText('123456'), '123456')
      await user().click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => { expect(assignMock).toHaveBeenCalledWith('http://localhost/'); })
      expect(fetchMock).toHaveBeenLastCalledWith(
         '/api/auth/otp/email/verify',
         expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
               email: 'buyer@example.com',
               phone: '',
               OTP: '123456',
               cart: { items: [{ productId: 'p1', count: 1 }] },
            }),
         })
      )
      expect(localStorage.getItem('Cart')).toBe('{"items":[]}')
   })

   it('verifies the phone code through the phone endpoint', async () => {
      const fetchMock = vi.fn(() => ok())
      vi.stubGlobal('fetch', fetchMock)
      await reachVerifyStep('phone')

      await user().type(screen.getByPlaceholderText('123456'), '123456')
      await user().click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => { expect(assignMock).toHaveBeenCalled(); })
      expect(fetchMock).toHaveBeenLastCalledWith('/api/auth/otp/phone/verify', expect.objectContaining({ method: 'POST' }))
   })

   it('keeps the cart and the verification step when the code is rejected', async () => {
      localStorage.setItem('Cart', JSON.stringify({ items: [{ productId: 'p1', count: 1 }] }))
      const fetchMock = vi
         .fn()
         .mockImplementationOnce(() => ok())
         .mockImplementationOnce(() => status(401))
      vi.stubGlobal('fetch', fetchMock)
      await reachVerifyStep()

      await user().type(screen.getByPlaceholderText('123456'), '000000')
      await user().click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => { expect(fetchMock).toHaveBeenCalledTimes(2); })
      expect(assignMock).not.toHaveBeenCalled()
      expect(localStorage.getItem('Cart')).toBe('{"items":[{"productId":"p1","count":1}]}')
      expect(screen.getByText('One-Time Password')).toBeInTheDocument()
   })

   it('logs a network failure while verifying', async () => {
      const fetchMock = vi
         .fn()
         .mockImplementationOnce(() => ok())
         .mockImplementationOnce(() => Promise.reject(new Error('offline')))
      vi.stubGlobal('fetch', fetchMock)
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(noop)
      await reachVerifyStep()

      await user().type(screen.getByPlaceholderText('123456'), '123456')
      await user().click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => { expect(errorSpy).toHaveBeenCalled(); })
      expect(assignMock).not.toHaveBeenCalled()
   })
})

describe('admin login form', () => {
   it('offers no phone option and no way to switch to phone', () => {
      render(<AdminAuthForm />)

      expect(screen.queryByLabelText('Phone')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /phone/i })).not.toBeInTheDocument()
   })

   it('keeps the button disabled until the email is valid', async () => {
      render(<AdminAuthForm />)

      const button = screen.getByRole('button', { name: 'Login with Email' })
      expect(button).toBeDisabled()

      await user().type(screen.getByPlaceholderText('name@example.com'), 'owner@example.com')
      expect(button).toBeEnabled()
   })

   it('requests an admin OTP and moves to the code step', async () => {
      const fetchMock = vi.fn(() => ok())
      vi.stubGlobal('fetch', fetchMock)

      render(<AdminAuthForm />)
      await user().type(screen.getByPlaceholderText('name@example.com'), 'owner@example.com')
      await user().click(screen.getByRole('button', { name: 'Login with Email' }))

      await screen.findByText('One-Time Password')
      expect(fetchMock).toHaveBeenCalledWith(
         '/api/admin/auth/otp/email/try',
         expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'owner@example.com' }) })
      )
   })

   it('shows a generic message when the request is refused', async () => {
      vi.stubGlobal('fetch', vi.fn(() => status(500)))

      render(<AdminAuthForm />)
      await user().type(screen.getByPlaceholderText('name@example.com'), 'owner@example.com')
      await user().click(screen.getByRole('button', { name: 'Login with Email' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('The code could not be sent.')
      expect(screen.queryByText('One-Time Password')).not.toBeInTheDocument()
   })

   it('asks the user to wait when the request is rate limited', async () => {
      vi.stubGlobal('fetch', vi.fn(() => status(429)))

      render(<AdminAuthForm />)
      await user().type(screen.getByPlaceholderText('name@example.com'), 'owner@example.com')
      await user().click(screen.getByRole('button', { name: 'Login with Email' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts.')
   })

   it('shows a connection message when the server cannot be reached', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))

      render(<AdminAuthForm />)
      await user().type(screen.getByPlaceholderText('name@example.com'), 'owner@example.com')
      await user().click(screen.getByRole('button', { name: 'Login with Email' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('The server could not be reached.')
   })

   it('locks the form while the code is being requested', async () => {
      const pending = deferred()
      vi.stubGlobal('fetch', vi.fn(() => pending.promise))

      render(<AdminAuthForm />)
      await user().type(screen.getByPlaceholderText('name@example.com'), 'owner@example.com')
      await user().click(screen.getByRole('button', { name: 'Login with Email' }))

      expect(screen.getByPlaceholderText('name@example.com')).toBeDisabled()

      pending.resolve(new Response('{}', { status: 500 }))
      await screen.findByRole('alert')
   })

   it('verifies the code and sends the owner to the dashboard', async () => {
      const fetchMock = vi.fn(() => ok())
      vi.stubGlobal('fetch', fetchMock)

      render(<AdminAuthForm />)
      await user().type(screen.getByPlaceholderText('name@example.com'), 'owner@example.com')
      await user().click(screen.getByRole('button', { name: 'Login with Email' }))
      await screen.findByText('One-Time Password')

      await user().type(screen.getByPlaceholderText('123456'), '۱۲۳۴۵۶')
      await user().click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => { expect(assignMock).toHaveBeenCalledWith('http://localhost/admin'); })
      expect(fetchMock).toHaveBeenLastCalledWith(
         '/api/admin/auth/otp/email/verify',
         expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ email: 'owner@example.com', OTP: '123456' }),
         })
      )
   })

   it('reports a rejected code without leaving the code step', async () => {
      const fetchMock = vi
         .fn()
         .mockImplementationOnce(() => ok())
         .mockImplementationOnce(() => status(401))
      vi.stubGlobal('fetch', fetchMock)

      render(<AdminAuthForm />)
      await user().type(screen.getByPlaceholderText('name@example.com'), 'owner@example.com')
      await user().click(screen.getByRole('button', { name: 'Login with Email' }))
      await screen.findByText('One-Time Password')

      await user().type(screen.getByPlaceholderText('123456'), '000000')
      await user().click(screen.getByRole('button', { name: 'Submit' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('The code is incorrect or has expired.')
      expect(assignMock).not.toHaveBeenCalled()
      expect(screen.getByText('One-Time Password')).toBeInTheDocument()
   })

   it('reports a lockout after too many wrong codes', async () => {
      const fetchMock = vi
         .fn()
         .mockImplementationOnce(() => ok())
         .mockImplementationOnce(() => status(429))
      vi.stubGlobal('fetch', fetchMock)

      render(<AdminAuthForm />)
      await user().type(screen.getByPlaceholderText('name@example.com'), 'owner@example.com')
      await user().click(screen.getByRole('button', { name: 'Login with Email' }))
      await screen.findByText('One-Time Password')

      await user().type(screen.getByPlaceholderText('123456'), '000000')
      await user().click(screen.getByRole('button', { name: 'Submit' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts.')
   })

   it('reports a network failure while verifying', async () => {
      const fetchMock = vi
         .fn()
         .mockImplementationOnce(() => ok())
         .mockImplementationOnce(() => Promise.reject(new Error('offline')))
      vi.stubGlobal('fetch', fetchMock)

      render(<AdminAuthForm />)
      await user().type(screen.getByPlaceholderText('name@example.com'), 'owner@example.com')
      await user().click(screen.getByRole('button', { name: 'Login with Email' }))
      await screen.findByText('One-Time Password')

      await user().type(screen.getByPlaceholderText('123456'), '123456')
      await user().click(screen.getByRole('button', { name: 'Submit' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('The server could not be reached.')
      expect(assignMock).not.toHaveBeenCalled()
   })

   it('returns to the email step and clears the code when another email is wanted', async () => {
      vi.stubGlobal('fetch', vi.fn(() => ok()))

      render(<AdminAuthForm />)
      await user().type(screen.getByPlaceholderText('name@example.com'), 'owner@example.com')
      await user().click(screen.getByRole('button', { name: 'Login with Email' }))
      await screen.findByText('One-Time Password')
      await user().type(screen.getByPlaceholderText('123456'), '12')

      await user().click(screen.getByRole('button', { name: 'Use another email' }))

      expect(screen.getByRole('button', { name: 'Login with Email' })).toBeInTheDocument()
      expect(screen.queryByText('One-Time Password')).not.toBeInTheDocument()
   })
})
