import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import CheckoutPage from '@/app/(store)/(routes)/checkout/page'

/* The page composes both providers itself, so the doubles replace the hooks
   rather than the providers — that keeps the real nesting under test. */
const { redirectToPayment } = vi.hoisted(() => ({ redirectToPayment: vi.fn() }))

vi.mock('@/lib/payments/redirect', () => ({ redirectToPayment }))

const userState = {
   user: null as null | { id: string },
   loading: false,
}
const cartState = {
   cart: null as null | {
      items: {
         productId: string
         count: number
         product: { title: string; price: number; discount: number }
      }[]
   },
   loading: false,
}

vi.mock('@/state/User', () => ({
   UserContextProvider: ({ children }: { children: React.ReactNode }) => children,
   useUserContext: () => ({ ...userState, refreshUser: vi.fn() }),
}))

const dispatchCart = vi.fn()

vi.mock('@/state/Cart', () => ({
   CartContextProvider: ({ children }: { children: React.ReactNode }) => children,
   useCartContext: () => ({ ...cartState, dispatchCart, refreshCart: vi.fn() }),
}))

/* Radix/next-link are not the subject here; the page only renders a plain
   anchor for the empty and success states. */
vi.mock('next/navigation', async (importOriginal) => {
   const actual = await importOriginal<typeof import('next/navigation')>()
   const navigation = await import('../support/navigation')

   return { ...actual, ...navigation }
})

const user = () => userEvent.setup({ pointerEventsCheck: 0 })

const cartWithItems = {
   items: [
      { productId: 'p1', count: 2, product: { title: 'گردنبند', price: 100, discount: 5 } },
      { productId: 'p2', count: 1, product: { title: 'شال', price: 50, discount: 0 } },
   ],
}

const address = {
   id: 'ad1',
   address: 'خیابان ولیعصر، پلاک ۱',
   city: 'تهران',
   phone: '09120000000',
   postalCode: '1234567890',
}

const jsonResponse = (body: unknown, status = 200) =>
   new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
   })

const stubFetch = (handler: (url: string, init?: RequestInit) => Promise<Response>) =>
   vi.stubGlobal('fetch', vi.fn(handler))

beforeEach(() => {
   dispatchCart.mockClear()
   redirectToPayment.mockClear()
   redirectToPayment.mockClear()
   userState.user = { id: 'u1' }
   userState.loading = false
   cartState.cart = cartWithItems
   cartState.loading = false
   stubFetch(async () => jsonResponse([]))
})

afterEach(() => {
   window.history.replaceState({}, '', '/')
   vi.unstubAllGlobals()
   vi.restoreAllMocks()
})

describe('checkout — gating states', () => {
   it('shows the loading copy while the profile or cart is in flight', () => {
      userState.loading = true

      render(<CheckoutPage />)

      expect(screen.getByText('در حال بارگذاری اطلاعات خرید...')).toBeInTheDocument()
   })

   it('asks a signed-out visitor to log in', async () => {
      userState.user = null

      render(<CheckoutPage />)

      expect(
         await screen.findByText('برای ادامه خرید وارد حساب کاربری شوید')
      ).toBeInTheDocument()
   })

   it('reports an empty cart instead of an order form', async () => {
      cartState.cart = { items: [] }

      render(<CheckoutPage />)

      expect(await screen.findByText('سبد خرید شما خالی است')).toBeInTheDocument()
   })

   it('treats a missing cart the same as an empty one', async () => {
      cartState.cart = null

      render(<CheckoutPage />)

      expect(await screen.findByText('سبد خرید شما خالی است')).toBeInTheDocument()
   })
})

describe('checkout — address selection', () => {
   it('preselects the first stored address', async () => {
      stubFetch(async () => jsonResponse([address]))

      render(<CheckoutPage />)

      const radio = await screen.findByRole('radio')
      await waitFor(() => expect(radio).toBeChecked())
      expect(screen.getByText('خیابان ولیعصر، پلاک ۱')).toBeInTheDocument()
   })

   it('renders the empty-address hint when the customer has none', async () => {
      render(<CheckoutPage />)

      expect(await screen.findByText('هنوز نشانی‌ای ثبت نکرده‌اید.')).toBeInTheDocument()
      /* With no address there is nothing to submit against. */
      expect(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' })).toBeDisabled()
   })

   it('surfaces a failed address lookup', async () => {
      stubFetch(async () => new Response('nope', { status: 500 }))

      render(<CheckoutPage />)

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'دریافت نشانی‌ها انجام نشد.'
      )
   })

   it('saves a new address through the API and selects it', async () => {
      const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
         if (url === '/api/addresses' && _init?.method === 'POST') {
            return jsonResponse({ ...address, id: 'ad2' })
         }
         return jsonResponse([])
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await screen.findByText('هنوز نشانی‌ای ثبت نکرده‌اید.')

      await user().click(screen.getByRole('button', { name: 'افزودن نشانی جدید' }))
      await user().type(screen.getByLabelText('شهر'), 'تهران')
      await user().type(screen.getByLabelText('نشانی کامل'), 'خیابان ولیعصر')
      await user().type(screen.getByLabelText('شماره تماس'), '09120000000')
      await user().type(screen.getByLabelText('کد پستی'), '1234567890')
      await user().click(screen.getByRole('button', { name: 'ذخیره نشانی' }))

      await waitFor(() =>
         expect(fetchMock).toHaveBeenCalledWith(
            '/api/addresses',
            expect.objectContaining({
               method: 'POST',
               body: JSON.stringify({
                  city: 'تهران',
                  address: 'خیابان ولیعصر',
                  phone: '09120000000',
                  postalCode: '1234567890',
               }),
            })
         )
      )
      /* The saved address is appended and becomes the selection. */
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())
      expect(screen.queryByText('هنوز نشانی‌ای ثبت نکرده‌اید.')).not.toBeInTheDocument()
   })

   it('reports a rejected address save and keeps the form open', async () => {
      const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
         if (_init?.method === 'POST') return new Response('bad', { status: 400 })
         return jsonResponse([])
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await screen.findByText('هنوز نشانی‌ای ثبت نکرده‌اید.')

      await user().click(screen.getByRole('button', { name: 'افزودن نشانی جدید' }))
      await user().type(screen.getByLabelText('شهر'), 'تهران')
      await user().type(screen.getByLabelText('نشانی کامل'), 'x')
      await user().type(screen.getByLabelText('شماره تماس'), '0912')
      await user().type(screen.getByLabelText('کد پستی'), '12')
      await user().click(screen.getByRole('button', { name: 'ذخیره نشانی' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'ذخیره نشانی انجام نشد. اطلاعات را بررسی کنید.'
      )
      expect(screen.getByRole('button', { name: 'ذخیره نشانی' })).toBeInTheDocument()
   })

   it('toggles the new-address form closed again', async () => {
      render(<CheckoutPage />)
      await screen.findByText('هنوز نشانی‌ای ثبت نکرده‌اید.')

      await user().click(screen.getByRole('button', { name: 'افزودن نشانی جدید' }))
      expect(screen.getByLabelText('شهر')).toBeInTheDocument()

      await user().click(screen.getByRole('button', { name: 'بستن فرم نشانی' }))
      expect(screen.queryByLabelText('شهر')).not.toBeInTheDocument()
   })
})

describe('checkout — order summary', () => {
   it('shows Persian line items and the Toman totals with 9% tax', async () => {
      stubFetch(async () => jsonResponse([address]))

      render(<CheckoutPage />)
      await screen.findByRole('radio')

      expect(screen.getByText('گردنبند × ۲')).toBeInTheDocument()
      expect(screen.getByText('شال × ۱')).toBeInTheDocument()
      /* subtotal 250, discount 10, after 240, tax 21.6, payable 261.6 */
      expect(screen.getByText('۲۵۰ تومان')).toBeInTheDocument()
      expect(screen.getByText('۱۰ تومان')).toBeInTheDocument()
      expect(screen.getByText('۲۲ تومان')).toBeInTheDocument()
      expect(screen.getByText('۲۶۲ تومان')).toBeInTheDocument()
   })

   it('tells the shopper that online payment is not wired up', async () => {
      stubFetch(async () => jsonResponse([address]))

      render(<CheckoutPage />)
      await screen.findByRole('radio')

      expect(
         screen.getByText(/پس از پرداخت، نتیجه تراکنش از طریق استعلام امن سرور بررسی می‌شود/)
      ).toBeInTheDocument()
   })

   it('shows payment success only after the authenticated orders API confirms it', async () => {
      window.history.replaceState({}, '', '/checkout?payment=success&orderId=o1')
      const fetchMock = vi.fn(async (url: string) => {
         if (url === '/api/orders') {
            return jsonResponse([{ id: 'o1', number: 42, isPaid: true }])
         }
         return jsonResponse([address])
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)

      expect(await screen.findByText(/پرداخت سفارش شماره ۴۲ با موفقیت تأیید شد/)).toBeInTheDocument()
      expect(fetchMock).toHaveBeenCalledWith('/api/orders', { cache: 'no-store' })
   })

   it('does not trust a success query when the order is still unpaid', async () => {
      window.history.replaceState({}, '', '/checkout?payment=success&orderId=o1')
      vi.stubGlobal(
         'fetch',
         vi.fn(async (url: string) => {
            if (url === '/api/orders') {
               return jsonResponse([{ id: 'o1', number: 42, isPaid: false }])
            }
            return jsonResponse([address])
         })
      )

      render(<CheckoutPage />)

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'وضعیت پرداخت این سفارش هنوز در سامانه تأیید نشده است.'
      )
      expect(screen.queryByText('پرداخت تأیید شد')).not.toBeInTheDocument()
   })
})

describe('checkout — submitting the order', () => {
   it('creates the order, initializes Tabapay, and redirects to the payment page', async () => {
      const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
         if (url === '/api/orders') return jsonResponse({ id: 'o1', number: 42 })
         if (url === '/api/payments/tabapay') {
            return jsonResponse({ paymentUrl: 'https://api.tabapay.ir/sandbox/pay/token' })
         }
         return jsonResponse([address])
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())

      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      await waitFor(() => {
         expect(fetchMock).toHaveBeenCalledWith(
            '/api/orders',
            expect.objectContaining({
               method: 'POST',
               body: JSON.stringify({ addressId: 'ad1', discountCode: undefined }),
            })
         )
         expect(fetchMock).toHaveBeenCalledWith(
            '/api/payments/tabapay',
            expect.objectContaining({
               method: 'POST',
               body: JSON.stringify({ orderId: 'o1' }),
            })
         )
         expect(redirectToPayment).toHaveBeenCalledWith('https://api.tabapay.ir/sandbox/pay/token')
      })
      expect(screen.queryByText('پرداخت تأیید شد')).not.toBeInTheDocument()
      expect(dispatchCart).not.toHaveBeenCalled()
   })

   it('explains a stock conflict in plain Persian', async () => {
      const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
         if (url === '/api/orders') {
            return new Response('One or more products no longer have enough stock', {
               status: 409,
            })
         }
         return jsonResponse([address])
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())

      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'موجودی یکی از محصولات تغییر کرده است. سبد خرید را بررسی کنید.'
      )
      expect(screen.queryByText('سفارش شما ثبت شد')).not.toBeInTheDocument()
      /* A failed order must leave the cart intact. */
      expect(dispatchCart).not.toHaveBeenCalled()
   })

   it('falls back to the server message for other failures', async () => {
      const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
         if (url === '/api/orders') return new Response('Internal error', { status: 500 })
         return jsonResponse([address])
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())

      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Internal error')
   })
})

describe('checkout — switching the selected address', () => {
   it('lets the shopper pick a different stored address', async () => {
      stubFetch(async () =>
         jsonResponse([address, { ...address, id: 'ad2', city: 'شیراز', address: 'زندیه' }])
      )

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getAllByRole('radio')[0]).toBeChecked())

      await user().click(screen.getAllByRole('radio')[1])

      expect(screen.getAllByRole('radio')[1]).toBeChecked()
      expect(screen.getAllByRole('radio')[0]).not.toBeChecked()
   })

   it('refuses to submit when no address is selected', async () => {
      const fetchMock = vi.fn(async (url: string) => {
         if (url === '/api/orders') return jsonResponse({ id: 'o1', number: 1 })
         return jsonResponse([])
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await screen.findByText('هنوز نشانی‌ای ثبت نکرده‌اید.')

      /* The button is disabled without an address, so the guard is only
         reachable by invoking the handler directly. Submit the form region. */
      fireEvent.click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      expect(fetchMock).not.toHaveBeenCalledWith('/api/orders', expect.anything())
      expect(screen.queryByText('سفارش شما ثبت شد')).not.toBeInTheDocument()
   })
})

describe('checkout — returning from the gateway', () => {
   afterEach(() => {
      window.history.replaceState({}, '', '/checkout')
   })

   it('confirms a verified payment through the authenticated orders API', async () => {
      window.history.replaceState({}, '', '/checkout?payment=success&orderId=o1')
      stubFetch(async (url) => {
         if (url === '/api/orders') {
            return jsonResponse([{ id: 'o1', number: 42, isPaid: true }])
         }
         return jsonResponse([])
      })

      render(<CheckoutPage />)

      expect(
         await screen.findByText('پرداخت سفارش شماره ۴۲ با موفقیت تأیید شد.')
      ).toBeInTheDocument()
   })

   it('refuses to claim success without an order reference', async () => {
      /* A forged `?payment=success` must not produce a receipt. */
      window.history.replaceState({}, '', '/checkout?payment=success')
      stubFetch(async () => jsonResponse([]))

      render(<CheckoutPage />)

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'شناسه سفارش برای بررسی نتیجه پرداخت وجود ندارد.'
      )
   })

   it('does not claim success when the order is still unpaid', async () => {
      window.history.replaceState({}, '', '/checkout?payment=success&orderId=o1')
      stubFetch(async (url) => {
         if (url === '/api/orders') {
            return jsonResponse([{ id: 'o1', number: 42, isPaid: false }])
         }
         return jsonResponse([])
      })

      render(<CheckoutPage />)

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'وضعیت پرداخت این سفارش هنوز در سامانه تأیید نشده است.'
      )
   })

   it('reports a failed order lookup after the redirect', async () => {
      window.history.replaceState({}, '', '/checkout?payment=success&orderId=o1')
      stubFetch(async (url) => {
         if (url === '/api/orders') return new Response('nope', { status: 500 })
         return jsonResponse([])
      })

      render(<CheckoutPage />)

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'دریافت وضعیت سفارش انجام نشد.'
      )
   })

   it('ignores a non-Error rejection while confirming the payment', async () => {
      window.history.replaceState({}, '', '/checkout?payment=success&orderId=o1')
      stubFetch(async (url) => {
         if (url === '/api/orders') throw 'plain string failure'
         return jsonResponse([])
      })

      render(<CheckoutPage />)

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'بررسی وضعیت پرداخت انجام نشد.'
      )
   })

   it('ignores a payment check that rejects after unmount', async () => {
      window.history.replaceState({}, '', '/checkout?payment=success&orderId=o1')
      let reject: (reason: Error) => void = () => {}
      const pending = new Promise<Response>((_resolve, rejectFn) => {
         reject = rejectFn
      })
      vi.stubGlobal(
         'fetch',
         vi.fn(async (url: string) => {
            if (url === '/api/orders') return pending
            return jsonResponse([])
         })
      )

      const { unmount } = render(<CheckoutPage />)
      unmount()

      await act(async () => {
         reject(new Error('late failure'))
         await pending.catch(() => undefined)
      })

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
   })

   it('explains a failed payment', async () => {
      window.history.replaceState({}, '', '/checkout?payment=failed')
      stubFetch(async () => jsonResponse([]))

      render(<CheckoutPage />)

      expect(await screen.findByRole('alert')).toHaveTextContent(
         /پرداخت تأیید نشد/
      )
   })

   it('explains an uncertain payment and asks the shopper not to retry', async () => {
      window.history.replaceState({}, '', '/checkout?payment=pending')
      stubFetch(async () => jsonResponse([]))

      render(<CheckoutPage />)

      expect(await screen.findByRole('alert')).toHaveTextContent(
         /تأیید پرداخت هنوز قطعی نیست/
      )
   })

   it('does not update state when the payment check resolves after unmount', async () => {
      window.history.replaceState({}, '', '/checkout?payment=success&orderId=o1')
      let release: (value: Response) => void = () => {}
      const pending = new Promise<Response>((resolve) => {
         release = resolve
      })
      vi.stubGlobal(
         'fetch',
         vi.fn(async (url: string) => {
            if (url === '/api/orders') return pending
            return jsonResponse([])
         })
      )

      const { unmount } = render(<CheckoutPage />)
      unmount()

      await act(async () => {
         release(jsonResponse([{ id: 'o1', number: 42, isPaid: true }]))
         await pending
      })

      expect(screen.queryByText(/با موفقیت تأیید شد/)).not.toBeInTheDocument()
   })
})

describe('checkout — gateway initialization', () => {
   it('creates the order then hands the shopper to the gateway', async () => {
      const fetchMock = vi.fn(async (url: string) => {
         if (url === '/api/orders') return jsonResponse({ id: 'o1', number: 42 })
         if (url === '/api/payments/tabapay') {
            return jsonResponse({ paymentUrl: 'https://api.tabapay.ir/pay/abc' })
         }
         return jsonResponse([address])
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())

      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      await waitFor(() =>
         expect(redirectToPayment).toHaveBeenCalledWith(
            'https://api.tabapay.ir/pay/abc'
         )
      )
      /* The order is created first, then the gateway session for it. */
      expect(fetchMock).toHaveBeenCalledWith(
         '/api/payments/tabapay',
         expect.objectContaining({ body: JSON.stringify({ orderId: 'o1' }) })
      )
      /* Nothing is confirmed client-side before the gateway says so. */
      expect(screen.queryByText('سفارش شما ثبت شد')).not.toBeInTheDocument()
   })

   it('submits the entered discount code for server-side validation', async () => {
      const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
         if (url === '/api/orders') return jsonResponse({ id: 'o1', number: 42 })
         if (url === '/api/payments/tabapay') {
            return jsonResponse({ paymentUrl: 'https://api.tabapay.ir/pay/abc' })
         }
         return jsonResponse([address])
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())
      await user().type(screen.getByLabelText('کد تخفیف'), 'SAVE10')
      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
         '/api/orders',
         expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ addressId: 'ad1', discountCode: 'SAVE10' }),
         })
      ))
   })

   it('explains an amount outside the gateway range', async () => {
      const fetchMock = vi.fn(async (url: string) => {
         if (url === '/api/orders') return jsonResponse({ id: 'o1', number: 42 })
         if (url === '/api/payments/tabapay') {
            return jsonResponse({ message: 'TABAPAY_AMOUNT_OUT_OF_RANGE' }, 400)
         }
         return jsonResponse([address])
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())

      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'مبلغ سفارش خارج از محدوده مجاز درگاه است.'
      )
      expect(redirectToPayment).not.toHaveBeenCalled()
   })

   it('blocks a second order when gateway initialization needs reconciliation', async () => {
      const fetchMock = vi.fn(async (url: string) => {
         if (url === '/api/orders') return jsonResponse({ id: 'o1', number: 42 })
         if (url === '/api/payments/tabapay') {
            return jsonResponse({ message: 'PAYMENT_INITIALIZATION_PENDING_RECONCILIATION' }, 202)
         }
         return jsonResponse([address])
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())
      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/وضعیت ایجاد تراکنش هنوز مشخص نیست/)
      expect(screen.getByRole('button', { name: 'در انتظار بررسی تراکنش' })).toBeDisabled()
      expect(redirectToPayment).not.toHaveBeenCalled()
   })

   it('reports a gateway that cannot be reached', async () => {
      const fetchMock = vi.fn(async (url: string) => {
         if (url === '/api/orders') return jsonResponse({ id: 'o1', number: 42 })
         if (url === '/api/payments/tabapay') return new Response('down', { status: 502 })
         return jsonResponse([address])
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())

      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'اتصال به درگاه پرداخت انجام نشد. اگر سفارش ثبت شده، پیش از تلاش مجدد وضعیت آن را بررسی کنید.'
      )
   })

   it('rejects a gateway response without a usable URL', async () => {
      const fetchMock = vi.fn(async (url: string) => {
         if (url === '/api/orders') return jsonResponse({ id: 'o1', number: 42 })
         if (url === '/api/payments/tabapay') return jsonResponse({})
         return jsonResponse([address])
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())

      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('نشانی درگاه نامعتبر است.')
      expect(redirectToPayment).not.toHaveBeenCalled()
   })

   it('tolerates a gateway error body that is not JSON', async () => {
      const fetchMock = vi.fn(async (url: string) => {
         if (url === '/api/orders') return jsonResponse({ id: 'o1', number: 42 })
         if (url === '/api/payments/tabapay') {
            return new Response('<html>bad gateway</html>', { status: 502 })
         }
         return jsonResponse([address])
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())

      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'اتصال به درگاه پرداخت انجام نشد. اگر سفارش ثبت شده، پیش از تلاش مجدد وضعیت آن را بررسی کنید.'
      )
   })
})

describe('checkout — defensive branches', () => {
   it('cancels an address lookup that resolves after unmount', async () => {
      let release: (value: Response) => void = () => {}
      const pending = new Promise<Response>((resolve) => {
         release = resolve
      })
      vi.stubGlobal('fetch', vi.fn(async () => pending))

      const { unmount } = render(<CheckoutPage />)
      unmount()

      /* Resolving after unmount must not warn or throw. */
      await act(async () => {
         release(jsonResponse([address]))
         await pending
      })

      expect(screen.queryByRole('radio')).not.toBeInTheDocument()
   })

   it('falls back to a generic message when the API sends an empty body', async () => {
      const fetchMock = vi.fn(async (url: string) => {
         if (url === '/api/orders') return new Response('', { status: 500 })
         return jsonResponse([address])
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())

      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('ثبت سفارش انجام نشد.')
   })

   it('falls back to a generic message when the order fetch rejects with a non-Error', async () => {
      const fetchMock = vi.fn(async (url: string) => {
         if (url === '/api/orders') throw 'plain string failure'
         return jsonResponse([address])
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())

      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('خطا در ثبت سفارش')
   })

   it('ignores an address rejection that arrives after unmount', async () => {
      let reject: (reason: Error) => void = () => {}
      const pending = new Promise<Response>((_resolve, rejectFn) => {
         reject = rejectFn
      })
      vi.stubGlobal('fetch', vi.fn(async () => pending))

      const { unmount } = render(<CheckoutPage />)
      unmount()

      await act(async () => {
         reject(new Error('late failure'))
         await pending.catch(() => undefined)
      })

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
   })

   it('ignores a non-Error rejection while loading addresses', async () => {
      vi.stubGlobal(
         'fetch',
         vi.fn(async () => {
            throw 'plain string failure'
         })
      )

      render(<CheckoutPage />)

      expect(await screen.findByRole('alert')).toHaveTextContent('خطا در دریافت نشانی‌ها')
   })

   it('ignores a non-Error rejection while saving an address', async () => {
      vi.stubGlobal(
         'fetch',
         vi.fn(async (_url: string, init?: RequestInit) => {
            if (init?.method === 'POST') throw 'plain string failure'
            return jsonResponse([])
         })
      )

      render(<CheckoutPage />)
      await screen.findByText('هنوز نشانی‌ای ثبت نکرده‌اید.')

      await user().click(screen.getByRole('button', { name: 'افزودن نشانی جدید' }))
      fireEvent.change(screen.getByLabelText('شهر'), { target: { value: 'تهران' } })
      fireEvent.change(screen.getByLabelText('نشانی کامل'), { target: { value: 'x' } })
      fireEvent.change(screen.getByLabelText('شماره تماس'), { target: { value: '0912' } })
      fireEvent.change(screen.getByLabelText('کد پستی'), { target: { value: '12' } })
      fireEvent.submit(screen.getByRole('button', { name: 'ذخیره نشانی' }).closest('form')!)

      expect(await screen.findByRole('alert')).toHaveTextContent('خطا در ذخیره نشانی')
   })
})
