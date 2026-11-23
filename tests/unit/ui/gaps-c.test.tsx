import { stubLocation } from '../support/location'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { UserAuthForm as AdminAuthForm } from '@/app/admin/login/components/user-auth-form'
import { UserAuthForm as StoreAuthForm } from '@/app/login/components/user-auth-form'
import { routerMock } from '../support/navigation'

const params = new Map<string, string>()

vi.mock('next/navigation', async (importOriginal) => {
   const actual = await importOriginal<typeof import('next/navigation')>()

   return {
      ...actual,
      useRouter: () => routerMock,
      usePathname: () => '/admin/login',
      useSearchParams: () => {
         const entries = [...params.entries()]
         return {
            get: (key: string) => params.get(key) ?? null,
            entries: () => entries[Symbol.iterator](),
            toString: () => new URLSearchParams(entries).toString(),
         } as never
      },
   }
})

const user = () => userEvent.setup({ pointerEventsCheck: 0 })

const assignMock = vi.fn()

beforeEach(() => {
   params.clear()
   routerMock.replace.mockClear()
   assignMock.mockClear()
   vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))))
   stubLocation({ origin: 'http://localhost', assign: assignMock, reload: vi.fn() })
})

afterEach(() => vi.unstubAllGlobals())

const setParams = (values: Record<string, string>) => {
   params.clear()
   for (const [key, value] of Object.entries(values)) params.set(key, value)
}

describe('admin login form — phone validation', () => {
   it('warns when the phone number is malformed', () => {
      setParams({ method: 'phone', phone: '123' })

      render(<AdminAuthForm />)

      expect(screen.getByText('Phone Number is not valid.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /login with phone/i })).toBeDisabled()
   })

   it('reports the phone digits back into the URL as they are typed', async () => {
      setParams({ method: 'phone' })

      render(<AdminAuthForm />)

      await user().type(screen.getByPlaceholderText('+989123456789'), '0912')

      expect(routerMock.replace).toHaveBeenCalledWith('/admin/login?method=phone&phone=0912', {
         scroll: false,
      })
   })

   it('does not request an OTP without a JWT secret', async () => {
      setParams({ method: 'phone', phone: '09123456789' })
      const secret = process.env.JWT_SECRET_KEY
      delete process.env.JWT_SECRET_KEY
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })

      render(<AdminAuthForm />)
      await user().click(screen.getByRole('button', { name: /login with phone/i }))

      expect(globalThis.fetch).not.toHaveBeenCalled()
      expect(errorSpy).toHaveBeenCalledWith('JWT secret key is missing')
      process.env.JWT_SECRET_KEY = secret
      errorSpy.mockRestore()
   })

   it('logs a network failure when requesting an OTP', async () => {
      setParams({ method: 'phone', phone: '09123456789' })
      vi.stubGlobal('fetch', vi.fn(() => { return Promise.reject(new Error('offline')); }))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })

      render(<AdminAuthForm />)
      await user().click(screen.getByRole('button', { name: /login with phone/i }))

      await waitFor(() => { expect(errorSpy).toHaveBeenCalled(); })
      errorSpy.mockRestore()
   })

   it('keeps the OTP field closed for a failed request', async () => {
      setParams({ method: 'phone', phone: '09123456789' })
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 429 }))))

      render(<AdminAuthForm />)
      await user().click(screen.getByRole('button', { name: /login with phone/i }))

      await waitFor(() =>
         expect(screen.getByRole('button', { name: /login with phone/i })).toBeEnabled()
      )
      expect(screen.queryByText('One-Time Password')).not.toBeInTheDocument()
   })

   it('logs a network failure when verifying an OTP', async () => {
      setParams({ method: 'phone', phone: '09123456789', OTP: '12345' })
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })

      render(<AdminAuthForm />)
      await user().click(screen.getByRole('button', { name: /login with phone/i }))
      await screen.findByText('One-Time Password')

      vi.stubGlobal('fetch', vi.fn(() => { return Promise.reject(new Error('offline')); }))
      await user().click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => { expect(errorSpy).toHaveBeenCalled(); })
      errorSpy.mockRestore()
   })

   it('stays on the page when the OTP is rejected', async () => {
      setParams({ method: 'phone', phone: '09123456789', OTP: '12345' })
      vi.stubGlobal(
         'fetch',
         vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))).mockResolvedValueOnce(
            new Response('{}', { status: 200 })
         )
      )

      render(<AdminAuthForm />)
      await user().click(screen.getByRole('button', { name: /login with phone/i }))
      await screen.findByText('One-Time Password')

      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 401 }))))
      await user().click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => { expect(globalThis.fetch).toHaveBeenCalled(); })
      expect(assignMock).not.toHaveBeenCalled()
   })

   it('records the OTP digits in the URL', async () => {
      setParams({ method: 'phone', phone: '09123456789', OTP: '1' })

      render(<AdminAuthForm />)
      await user().click(screen.getByRole('button', { name: /login with phone/i }))
      await screen.findByText('One-Time Password')

      await user().type(screen.getByPlaceholderText('12345'), '2')

      expect(routerMock.replace).toHaveBeenLastCalledWith(
         '/admin/login?method=phone&phone=09123456789&OTP=2',
         { scroll: false }
      )
   })
})

describe('admin login form — email flow', () => {
   it('warns for a malformed email and keeps the button disabled', () => {
      setParams({ method: 'email', email: 'nope' })

      render(<AdminAuthForm />)

      expect(screen.getByRole('button', { name: /login with email/i })).toBeDisabled()
   })

   it('refuses to request an email OTP without a signing key', async () => {
      setParams({ method: 'email', email: 'admin@example.com' })
      const secret = process.env.JWT_SECRET_KEY
      delete process.env.JWT_SECRET_KEY
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      render(<AdminAuthForm />)
      await user().click(screen.getByRole('button', { name: /login with email/i }))

      expect(fetchMock).not.toHaveBeenCalled()
      expect(errorSpy).toHaveBeenCalledWith('JWT secret key is missing')
      process.env.JWT_SECRET_KEY = secret
      errorSpy.mockRestore()
   })

   it('requests an email OTP then verifies it', async () => {
      setParams({ method: 'email', email: 'admin@example.com' })
      const fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })))
      vi.stubGlobal('fetch', fetchMock)

      render(<AdminAuthForm />)
      await user().click(screen.getByRole('button', { name: /login with email/i }))

      await waitFor(() => { expect(fetchMock).toHaveBeenCalledWith(
            '/api/admin/auth/otp/email/try',
            expect.objectContaining({ method: 'POST' })
         ); }
      )

      await screen.findByText('One-Time Password')
      await user().click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => { expect(fetchMock).toHaveBeenLastCalledWith(
            '/api/admin/auth/otp/email/verify',
            expect.objectContaining({ method: 'POST' })
         ); }
      )
      await waitFor(() => { expect(assignMock).toHaveBeenCalledWith('http://localhost/admin'); })
   })

   it('reports the email digits back into the URL as they are typed', async () => {
      setParams({ method: 'email' })

      render(<AdminAuthForm />)

      await user().type(screen.getByPlaceholderText('name@example.com'), 'a@b.co')

      /* Each keystroke rewrites the query string. */
      await waitFor(() => { expect(routerMock.replace).toHaveBeenLastCalledWith(
            '/admin/login?method=email&email=a%40b.co',
            { scroll: false }
         ); }
      )
   })

   it('switches from email to phone', async () => {
      setParams({ method: 'email' })

      render(<AdminAuthForm />)
      await user().click(screen.getByRole('button', { name: /phone number/i }))

      expect(routerMock.replace).toHaveBeenCalledWith('/admin/login?method=phone', {
         scroll: false,
      })
   })
})

describe('storefront login form', () => {
   it('requests and verifies a phone OTP', async () => {
      setParams({ method: 'phone', phone: '09123456789' })
      const fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })))
      vi.stubGlobal('fetch', fetchMock)

      render(<StoreAuthForm />)
      await user().click(screen.getByRole('button', { name: /login with phone/i }))

      await waitFor(() => { expect(fetchMock).toHaveBeenCalledWith(
            '/api/auth/otp/phone/try',
            expect.objectContaining({ method: 'POST' })
         ); }
      )

      await screen.findByText('One-Time Password')
      await user().click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => { expect(fetchMock).toHaveBeenLastCalledWith(
            '/api/auth/otp/phone/verify',
            expect.objectContaining({ method: 'POST' })
         ); }
      )
   })

   it('logs a network failure while verifying', async () => {
      setParams({ method: 'phone', phone: '09123456789', OTP: '12345' })
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })

      render(<StoreAuthForm />)
      await user().click(screen.getByRole('button', { name: /login with phone/i }))
      await screen.findByText('One-Time Password')
      vi.stubGlobal('fetch', vi.fn(() => { return Promise.reject(new Error('offline')); }))
      await user().click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => { expect(errorSpy).toHaveBeenCalled(); })
      errorSpy.mockRestore()
   })

   it('switches from phone back to email', async () => {
      setParams({ method: 'phone' })

      render(<StoreAuthForm />)
      await user().click(screen.getByRole('button', { name: 'Email' }))

      expect(routerMock.replace).toHaveBeenCalledWith('/admin/login?method=email', {
         scroll: false,
      })
   })

   it('records the OTP digits in the URL', async () => {
      setParams({ method: 'phone', phone: '09123456789', OTP: '1' })

      render(<StoreAuthForm />)
      await user().click(screen.getByRole('button', { name: /login with phone/i }))
      await screen.findByText('One-Time Password')

      await user().type(screen.getByPlaceholderText('12345'), '2')

      expect(routerMock.replace).toHaveBeenCalled()
   })

   it('reports the email back into the URL as it is typed', async () => {
      setParams({ method: 'email' })

      render(<StoreAuthForm />)

      await user().type(screen.getByPlaceholderText('name@example.com'), 'x@y.co')

      expect(routerMock.replace).toHaveBeenCalled()
   })

   it('keeps the storefront OTP field closed for a failed request', async () => {
      setParams({ method: 'phone', phone: '09123456789' })
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 500 }))))

      render(<StoreAuthForm />)
      await user().click(screen.getByRole('button', { name: /login with phone/i }))

      await waitFor(() =>
         expect(screen.getByRole('button', { name: /login with phone/i })).toBeEnabled()
      )
      expect(screen.queryByText('One-Time Password')).not.toBeInTheDocument()
   })

   it('toggles the password-less email button state', async () => {
      setParams({ method: 'email', email: 'shopper@example.com' })

      render(<StoreAuthForm />)

      const button = screen.getByRole('button', { name: /login with email/i })
      await act(() => {
         fireEvent.click(button)
      return Promise.resolve(); })

      await waitFor(() => { expect(globalThis.fetch).toHaveBeenCalled(); })
   })
})

describe('storefront login form — phone entry', () => {
   it('writes the phone digits into the URL as they are typed', async () => {
      setParams({ method: 'phone' })

      render(<StoreAuthForm />)
      await user().type(screen.getByPlaceholderText('+989123456789'), '0912')

      expect(routerMock.replace).toHaveBeenCalledWith(
         expect.stringContaining('phone=0912'),
         { scroll: false }
      )
   })

   it('warns for a malformed phone number', () => {
      setParams({ method: 'phone', phone: '123' })

      render(<StoreAuthForm />)

      expect(screen.getByText('Phone Number is not valid.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /login with phone/i })).toBeDisabled()
   })

   it('clears the guest cart after a successful verification', async () => {
      setParams({ method: 'phone', phone: '09123456789', OTP: '12345' })
      localStorage.setItem('Cart', JSON.stringify({ items: [{ productId: 'p1', count: 1 }] }))

      render(<StoreAuthForm />)
      await user().click(screen.getByRole('button', { name: /login with phone/i }))
      await screen.findByText('One-Time Password')
      await user().click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => { expect(assignMock).toHaveBeenCalledWith('http://localhost/'); })
      expect(JSON.parse(localStorage.getItem('Cart'))).toEqual({ items: [] })
   })

   it('keeps the cart when the OTP is rejected', async () => {
      setParams({ method: 'phone', phone: '09123456789', OTP: '12345' })
      localStorage.setItem('Cart', JSON.stringify({ items: [{ productId: 'p1', count: 1 }] }))

      render(<StoreAuthForm />)
      await user().click(screen.getByRole('button', { name: /login with phone/i }))
      await screen.findByText('One-Time Password')

      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 401 }))))
      await user().click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => { expect(globalThis.fetch).toHaveBeenCalled(); })
      expect(JSON.parse(localStorage.getItem('Cart'))).toMatchObject({
         items: [{ productId: 'p1' }],
      })
   })
})

describe('storefront login form — email verification', () => {
   it('verifies through the email endpoint', async () => {
      setParams({ method: 'email', email: 'shopper@example.com', OTP: '12345' })
      const fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })))
      vi.stubGlobal('fetch', fetchMock)

      render(<StoreAuthForm />)
      await user().click(screen.getByRole('button', { name: /login with email/i }))
      await screen.findByText('One-Time Password')
      await user().click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => { expect(fetchMock).toHaveBeenLastCalledWith(
            '/api/auth/otp/email/verify',
            expect.objectContaining({ method: 'POST' })
         ); }
      )
   })
})

describe('admin login form — email verification failure path', () => {
   it('stays put when the email OTP is rejected', async () => {
      setParams({ method: 'email', email: 'admin@example.com', OTP: '99999' })

      render(<AdminAuthForm />)
      await user().click(screen.getByRole('button', { name: /login with email/i }))
      await screen.findByText('One-Time Password')

      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 401 }))))
      await user().click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => { expect(globalThis.fetch).toHaveBeenCalled(); })
      expect(assignMock).not.toHaveBeenCalled()
   })

   it('logs a network failure while requesting an email OTP', async () => {
      setParams({ method: 'email', email: 'admin@example.com' })
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })
      vi.stubGlobal('fetch', vi.fn(() => { return Promise.reject(new Error('offline')); }))

      render(<AdminAuthForm />)
      await user().click(screen.getByRole('button', { name: /login with email/i }))

      await waitFor(() => { expect(errorSpy).toHaveBeenCalled(); })
      errorSpy.mockRestore()
   })
})

describe('storefront login form — rejected OTP request', () => {
   it('logs a network failure while requesting a phone OTP', async () => {
      setParams({ method: 'phone', phone: '09123456789' })
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })
      vi.stubGlobal('fetch', vi.fn(() => { return Promise.reject(new Error('offline')); }))

      render(<StoreAuthForm />)
      await user().click(screen.getByRole('button', { name: /login with phone/i }))

      await waitFor(() => { expect(errorSpy).toHaveBeenCalled(); })
      errorSpy.mockRestore()
   })

   it('logs a network failure while requesting an email OTP', async () => {
      setParams({ method: 'email', email: 'shopper@example.com' })
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })
      vi.stubGlobal('fetch', vi.fn(() => { return Promise.reject(new Error('offline')); }))

      render(<StoreAuthForm />)
      await user().click(screen.getByRole('button', { name: /login with email/i }))

      await waitFor(() => { expect(errorSpy).toHaveBeenCalled(); })
      errorSpy.mockRestore()
   })
})
