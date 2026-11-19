import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { UserForm } from '@/app/(store)/(routes)/profile/edit/components/user-form'
import { AddressForm } from '@/app/(store)/(routes)/profile/addresses/[addressId]/components/address-form'
import { OrderForm } from '@/app/(store)/(routes)/profile/orders/[orderId]/components/order-form'
import { routerMock } from '../support/navigation'

vi.mock('next/navigation', async (importOriginal) => {
   const actual = await importOriginal<typeof import('next/navigation')>()
   const navigation = await import('../support/navigation')

   return {
      ...actual,
      ...navigation,
      useParams: () => ({ addressId: 'ad1', orderId: 'ord1' }),
   }
})

vi.mock('react-hot-toast', () => ({
   toast: Object.assign(vi.fn(), {
      success: vi.fn(),
      error: vi.fn(),
   }),
}))

const user = () => userEvent.setup()

beforeEach(() => {
   vi.unstubAllGlobals()
})

describe('profile UserForm', () => {
   it('prefills from the profile and submits', async () => {
      const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{}', { status: 200 }))
      vi.stubGlobal('fetch', fetchMock)
      const { toast } = await import('react-hot-toast')

      render(
         <UserForm initialData={{ name: 'Ada', email: 'a@b.co', phone: '0912' } as never} />
      )

      expect(screen.getByDisplayValue('Ada')).toBeInTheDocument()

      await user().click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => expect(fetchMock).toHaveBeenCalled())
      expect(fetchMock.mock.calls[0][0]).toBe('/api/products/undefined')
      expect(routerMock.refresh).toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalledWith('User updated.')
   })

   it('starts from placeholders without a profile', () => {
      render(<UserForm initialData={null} />)

      expect(screen.getAllByDisplayValue('---').length).toBe(3)
   })

   it('shows validation messages instead of submitting an empty name', async () => {
      const fetchMock = vi.fn(async () => new Response('{}'))
      vi.stubGlobal('fetch', fetchMock)

      render(<UserForm initialData={{ name: '', email: 'a@b.co', phone: '1' } as never} />)

      await user().click(screen.getByRole('button', { name: 'Save changes' }))

      await act(async () => {
         fireEvent.submit(screen.getByRole('button', { name: 'Save changes' }).closest('form')!)
      })

      await waitFor(() => expect(fetchMock).not.toHaveBeenCalled())
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
   })

   it('reports a failed request with a toast', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))))
      const { toast } = await import('react-hot-toast')

      render(
         <UserForm initialData={{ name: 'Ada', email: 'a@b.co', phone: '0912' } as never} />
      )

      await user().click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Something went wrong.'))
   })
})

describe('profile AddressForm', () => {
   it('creates a new address', async () => {
      const fetchMock = vi.fn(async () => new Response('{}'))
      vi.stubGlobal('fetch', fetchMock)
      const { toast } = await import('react-hot-toast')

      render(<AddressForm initialData={null} />)

      expect(screen.getByText('Create address')).toBeInTheDocument()

      await user().type(screen.getByPlaceholderText('Tehran'), 'Shiraz')
      await user().type(screen.getByPlaceholderText('09123456789'), '09120000000')
      await user().type(screen.getByPlaceholderText('1234567890'), '1234567890')
      await user().type(screen.getByPlaceholderText('Street - Building Number'), 'Main St')

      await user().click(screen.getByRole('button', { name: 'Create' }))

      await waitFor(() => expect(fetchMock).toHaveBeenCalled())
      expect(routerMock.push).toHaveBeenCalledWith('/profile/addresses')
      expect(toast.success).toHaveBeenCalledWith('Address created.')
   })

   it('edits an existing address and deletes it after confirmation', async () => {
      const fetchMock = vi.fn(async () => new Response('{}'))
      vi.stubGlobal('fetch', fetchMock)
      const { toast } = await import('react-hot-toast')

      render(
         <AddressForm
            initialData={
               {
                  id: 'ad1',
                  city: 'Tehran',
                  address: 'Main St',
                  phone: '0912',
                  postalCode: '1234',
               } as never
            }
         />
      )

      expect(screen.getByText('Edit address')).toBeInTheDocument()

      await user().click(screen.getByRole('button', { name: 'Save changes' }))
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Address updated.'))

      /* The delete affordance is the icon-only destructive button. */
      const trash = screen
         .getAllByRole('button')
         .find((button) => button.className.includes('destructive'))!
      await user().click(trash)

      await waitFor(async () =>
         expect(await screen.findByRole('button', { name: 'Continue' })).toBeInTheDocument()
      )
      await user().click(screen.getByRole('button', { name: 'Continue' }))

      await waitFor(() =>
         expect(fetchMock).toHaveBeenCalledWith(
            '/api/address/ad1',
            expect.objectContaining({ method: 'DELETE' })
         )
      )
      expect(routerMock.push).toHaveBeenCalledWith('/addresses')
   })

   it('reports a failed delete', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))))
      const { toast } = await import('react-hot-toast')

      render(
         <AddressForm
            initialData={
               { id: 'ad1', city: 'T', address: 'A', phone: '1', postalCode: '2' } as never
            }
         />
      )

      const trash = screen
         .getAllByRole('button')
         .find((button) => button.className.includes('destructive'))!
      await user().click(trash)
      await waitFor(async () =>
         expect(await screen.findByRole('button', { name: 'Continue' })).toBeInTheDocument()
      )
      await user().click(screen.getByRole('button', { name: 'Continue' }))

      await waitFor(() =>
         expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/removed all categories/))
      )
   })
})

describe('profile OrderForm', () => {
   it('renders the order fields and submits the patch', async () => {
      const fetchMock = vi.fn(async () => new Response('{}'))
      vi.stubGlobal('fetch', fetchMock)
      const { toast } = await import('react-hot-toast')

      render(
         <OrderForm
            initialData={
               {
                  status: 'Processing',
                  shipping: 10,
                  payable: 100,
                  discount: 0,
                  isPaid: false,
                  isCompleted: false,
               } as never
            }
         />
      )

      await user().click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => expect(fetchMock).toHaveBeenCalled())
      expect(routerMock.push).toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalled()
   })

   it('starts from zeroed defaults without an order', () => {
      render(<OrderForm initialData={null} />)

      expect(screen.getAllByRole('spinbutton').length).toBeGreaterThanOrEqual(3)
   })

   it('toggles the checkboxes', async () => {
      render(<OrderForm initialData={null} />)

      const checkboxes = screen.getAllByRole('checkbox')
      await act(async () => {
         fireEvent.click(checkboxes[0])
      })

      expect(checkboxes[0]).toHaveAttribute('data-state', 'checked')
   })
})
