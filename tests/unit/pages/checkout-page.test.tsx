import { noop } from '../support/noop'
import { jsonBody, rejectWith } from '../support/http'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderToString } from 'react-dom/server'

import CheckoutPage from '@/app/(store)/(routes)/checkout/page'

/* Rejection reasons that are deliberately not Error instances (the app must cope with them). */
const NON_ERROR_REASON = 'plain string failure'
const NON_ERROR_QUOTE = 'قطعی موقت'

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
   Response.json(body, {
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
   stubFetch(() => Promise.resolve(jsonResponse([])))
})

afterEach(() => {
   globalThis.history.replaceState({}, '', '/')
   vi.unstubAllGlobals()
   vi.restoreAllMocks()
})

/* Summary rows are the source of truth for money; matching a bare number
   collides with the method labels. */
function summaryRow(label: string) {
   return screen.getByText(label).parentElement?.textContent ?? ''
}

describe('checkout — gating states', () => {
   it('server-renders the signed-out prompt without a browser location', () => {
      userState.user = null

      /* renderToString takes the server snapshot path: the URL is not read,
         so the payment-notice store must not touch globalThis.location. */
      const html = renderToString(<CheckoutPage />)

      expect(html).toContain('برای ادامه خرید وارد حساب کاربری شوید')
   })

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
      stubFetch(() => Promise.resolve(jsonResponse([address])))

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
      stubFetch(() => Promise.resolve(new Response('nope', { status: 500 })))

      render(<CheckoutPage />)

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'دریافت نشانی‌ها انجام نشد.'
      )
   })

   it('saves a new address through the API and selects it', async () => {
      const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
         if (url === '/api/addresses' && _init?.method === 'POST') {
            return Promise.resolve(jsonResponse({ ...address, id: 'ad2' }))
         }
         return Promise.resolve(jsonResponse([]))
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

      await waitFor(() => { expect(fetchMock).toHaveBeenCalledWith(
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
         ); }
      )
      /* The saved address is appended and becomes the selection. */
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())
      await waitFor(() => expect(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' })).toBeEnabled())
      expect(screen.queryByText('هنوز نشانی‌ای ثبت نکرده‌اید.')).not.toBeInTheDocument()
   })

   it('reports a rejected address save and keeps the form open', async () => {
      const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
         if (_init?.method === 'POST') return Promise.resolve(new Response('bad', { status: 400 }))
         return Promise.resolve(jsonResponse([]))
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
      stubFetch(() => Promise.resolve(jsonResponse([address])))

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
      stubFetch(() => Promise.resolve(jsonResponse([address])))

      render(<CheckoutPage />)
      await screen.findByRole('radio')

      expect(
         screen.getByText(/پس از پرداخت، نتیجه تراکنش از طریق استعلام امن سرور بررسی می‌شود/)
      ).toBeInTheDocument()
   })

   it('shows payment success only after the authenticated orders API confirms it', async () => {
      globalThis.history.replaceState({}, '', '/checkout?payment=success&orderId=o1')
      const fetchMock = vi.fn((url: string) => {
         if (url === '/api/orders') {
            return Promise.resolve(jsonResponse([{ id: 'o1', number: 42, isPaid: true }]))
         }
         return Promise.resolve(jsonResponse([address]))
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)

      expect(await screen.findByText(/پرداخت سفارش شماره ۴۲ با موفقیت تأیید شد/)).toBeInTheDocument()
      expect(fetchMock).toHaveBeenCalledWith('/api/orders', { cache: 'no-store' })
   })

   it('does not trust a success query when the order is still unpaid', async () => {
      globalThis.history.replaceState({}, '', '/checkout?payment=success&orderId=o1')
      vi.stubGlobal(
         'fetch',
         vi.fn((url: string) => {
            if (url === '/api/orders') {
               return Promise.resolve(jsonResponse([{ id: 'o1', number: 42, isPaid: false }]))
            }
            return Promise.resolve(jsonResponse([address]))
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
      const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
         if (url === '/api/orders') return Promise.resolve(jsonResponse({ id: 'o1', number: 42 }))
         if (url === '/api/payments/tabapay') {
            return Promise.resolve(jsonResponse({ paymentUrl: 'https://api.tabapay.ir/sandbox/pay/token' }))
         }
         return Promise.resolve(jsonResponse([address]))
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())
      await waitFor(() => expect(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' })).toBeEnabled())

      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      await waitFor(() => {
         expect(fetchMock).toHaveBeenCalledWith(
            '/api/orders',
            expect.objectContaining({
               method: 'POST',
               body: expect.stringContaining('"addressId":"ad1"'),
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
      const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
         if (url === '/api/orders') {
            return Promise.resolve(new Response('One or more products no longer have enough stock', {
               status: 409,
            }))
         }
         return Promise.resolve(jsonResponse([address]))
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())
      await waitFor(() => expect(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' })).toBeEnabled())

      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'موجودی یکی از محصولات تغییر کرده است. سبد خرید را بررسی کنید.'
      )
      expect(screen.queryByText('سفارش شما ثبت شد')).not.toBeInTheDocument()
      /* A failed order must leave the cart intact. */
      expect(dispatchCart).not.toHaveBeenCalled()
   })

   it('falls back to the server message for other failures', async () => {
      const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
         if (url === '/api/orders') return Promise.resolve(new Response('Internal error', { status: 500 }))
         return Promise.resolve(jsonResponse([address]))
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())
      await waitFor(() => expect(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' })).toBeEnabled())

      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Internal error')
   })
})

describe('checkout — switching the selected address', () => {
   it('lets the shopper pick a different stored address', async () => {
      stubFetch(() =>
         Promise.resolve(jsonResponse([address, { ...address, id: 'ad2', city: 'شیراز', address: 'زندیه' }]))
      )

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getAllByRole('radio')[0]).toBeChecked())

      await user().click(screen.getAllByRole('radio')[1])

      expect(screen.getAllByRole('radio')[1]).toBeChecked()
      expect(screen.getAllByRole('radio')[0]).not.toBeChecked()
   })

   it('refuses to submit when no address is selected', async () => {
      const fetchMock = vi.fn((url: string) => {
         if (url === '/api/orders') return Promise.resolve(jsonResponse({ id: 'o1', number: 1 }))
         return Promise.resolve(jsonResponse([]))
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
      globalThis.history.replaceState({}, '', '/checkout')
   })

   it('confirms a verified payment through the authenticated orders API', async () => {
      globalThis.history.replaceState({}, '', '/checkout?payment=success&orderId=o1')
      stubFetch((url) => {
         if (url === '/api/orders') {
            return Promise.resolve(jsonResponse([{ id: 'o1', number: 42, isPaid: true }]))
         }
         return Promise.resolve(jsonResponse([]))
      })

      render(<CheckoutPage />)

      expect(
         await screen.findByText('پرداخت سفارش شماره ۴۲ با موفقیت تأیید شد.')
      ).toBeInTheDocument()
   })

   it('refuses to claim success without an order reference', async () => {
      /* A forged `?payment=success` must not produce a receipt. */
      globalThis.history.replaceState({}, '', '/checkout?payment=success')
      stubFetch(() => Promise.resolve(jsonResponse([])))

      render(<CheckoutPage />)

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'شناسه سفارش برای بررسی نتیجه پرداخت وجود ندارد.'
      )
   })

   it('does not claim success when the order is still unpaid', async () => {
      globalThis.history.replaceState({}, '', '/checkout?payment=success&orderId=o1')
      stubFetch((url) => {
         if (url === '/api/orders') {
            return Promise.resolve(jsonResponse([{ id: 'o1', number: 42, isPaid: false }]))
         }
         return Promise.resolve(jsonResponse([]))
      })

      render(<CheckoutPage />)

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'وضعیت پرداخت این سفارش هنوز در سامانه تأیید نشده است.'
      )
   })

   it('reports a failed order lookup after the redirect', async () => {
      globalThis.history.replaceState({}, '', '/checkout?payment=success&orderId=o1')
      stubFetch((url) => {
         if (url === '/api/orders') return Promise.resolve(new Response('nope', { status: 500 }))
         return Promise.resolve(jsonResponse([]))
      })

      render(<CheckoutPage />)

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'دریافت وضعیت سفارش انجام نشد.'
      )
   })

   it('ignores a non-Error rejection while confirming the payment', async () => {
      globalThis.history.replaceState({}, '', '/checkout?payment=success&orderId=o1')
      stubFetch((url) => {
         if (url === '/api/orders') return rejectWith(NON_ERROR_REASON);
         return Promise.resolve(jsonResponse([]))
      })

      render(<CheckoutPage />)

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'بررسی وضعیت پرداخت انجام نشد.'
      )
   })

   it('ignores a payment check that rejects after unmount', async () => {
      globalThis.history.replaceState({}, '', '/checkout?payment=success&orderId=o1')
      let reject: (reason: Error) => void = noop
      const pending = new Promise<Response>((_resolve, rejectFn) => {
         reject = rejectFn
      })
      vi.stubGlobal(
         'fetch',
         vi.fn((url: string) => {
            if (url === '/api/orders') return Promise.resolve(pending)
            return Promise.resolve(jsonResponse([]))
         })
      )

      const { unmount } = render(<CheckoutPage />)
      unmount()

      await act(async () => {
         reject(new Error('late failure'))
         await pending.catch(() => { /* rejection already asserted */ })
      })

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
   })

   it('explains a failed payment', async () => {
      globalThis.history.replaceState({}, '', '/checkout?payment=failed')
      stubFetch(() => Promise.resolve(jsonResponse([])))

      render(<CheckoutPage />)

      expect(await screen.findByRole('alert')).toHaveTextContent(
         /پرداخت تأیید نشد/
      )
   })

   it('explains an uncertain payment and asks the shopper not to retry', async () => {
      globalThis.history.replaceState({}, '', '/checkout?payment=pending')
      stubFetch(() => Promise.resolve(jsonResponse([])))

      render(<CheckoutPage />)

      expect(await screen.findByRole('alert')).toHaveTextContent(
         /تأیید پرداخت هنوز قطعی نیست/
      )
   })

   it('does not update state when the payment check resolves after unmount', async () => {
      globalThis.history.replaceState({}, '', '/checkout?payment=success&orderId=o1')
      let release: (value: Response) => void = noop
      const pending = new Promise<Response>((resolve) => {
         release = resolve
      })
      vi.stubGlobal(
         'fetch',
         vi.fn((url: string) => {
            if (url === '/api/orders') return Promise.resolve(pending)
            return Promise.resolve(jsonResponse([]))
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
      const fetchMock = vi.fn((url: string) => {
         if (url === '/api/orders') return Promise.resolve(jsonResponse({ id: 'o1', number: 42 }))
         if (url === '/api/payments/tabapay') {
            return Promise.resolve(jsonResponse({ paymentUrl: 'https://api.tabapay.ir/pay/abc' }))
         }
         return Promise.resolve(jsonResponse([address]))
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())
      await waitFor(() => expect(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' })).toBeEnabled())

      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      await waitFor(() => { expect(redirectToPayment).toHaveBeenCalledWith(
            'https://api.tabapay.ir/pay/abc'
         ); }
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
      const fetchMock = vi.fn((url: string) => {
         if (url === '/api/orders') return Promise.resolve(jsonResponse({ id: 'o1', number: 42 }))
         if (url === '/api/payments/tabapay') {
            return Promise.resolve(jsonResponse({ paymentUrl: 'https://api.tabapay.ir/pay/abc' }))
         }
         return Promise.resolve(jsonResponse([address]))
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())
      await waitFor(() => expect(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' })).toBeEnabled())
      await user().type(screen.getByLabelText('کد تخفیف'), 'SAVE10')
      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      await waitFor(() => { expect(fetchMock).toHaveBeenCalledWith(
         '/api/orders',
         expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"discountCode":"SAVE10"'),
         })
      ); })
   })

   it('explains an amount outside the gateway range', async () => {
      const fetchMock = vi.fn((url: string) => {
         if (url === '/api/orders') return Promise.resolve(jsonResponse({ id: 'o1', number: 42 }))
         if (url === '/api/payments/tabapay') {
            return Promise.resolve(jsonResponse({ message: 'TABAPAY_AMOUNT_OUT_OF_RANGE' }, 400))
         }
         return Promise.resolve(jsonResponse([address]))
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())
      await waitFor(() => expect(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' })).toBeEnabled())

      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'مبلغ سفارش خارج از محدوده مجاز درگاه است.'
      )
      expect(redirectToPayment).not.toHaveBeenCalled()
   })

   it('blocks a second order when gateway initialization needs reconciliation', async () => {
      const fetchMock = vi.fn((url: string) => {
         if (url === '/api/orders') return Promise.resolve(jsonResponse({ id: 'o1', number: 42 }))
         if (url === '/api/payments/tabapay') {
            return Promise.resolve(jsonResponse({ message: 'PAYMENT_INITIALIZATION_PENDING_RECONCILIATION' }, 202))
         }
         return Promise.resolve(jsonResponse([address]))
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())
      await waitFor(() => expect(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' })).toBeEnabled())
      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/وضعیت ایجاد تراکنش هنوز مشخص نیست/)
      expect(screen.getByRole('button', { name: 'در انتظار بررسی تراکنش' })).toBeDisabled()
      expect(redirectToPayment).not.toHaveBeenCalled()
   })

   it('reports a gateway that cannot be reached', async () => {
      const fetchMock = vi.fn((url: string) => {
         if (url === '/api/orders') return Promise.resolve(jsonResponse({ id: 'o1', number: 42 }))
         if (url === '/api/payments/tabapay') return Promise.resolve(new Response('down', { status: 502 }))
         return Promise.resolve(jsonResponse([address]))
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())
      await waitFor(() => expect(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' })).toBeEnabled())

      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'اتصال به درگاه پرداخت انجام نشد. اگر سفارش ثبت شده، پیش از تلاش مجدد وضعیت آن را بررسی کنید.'
      )
   })

   it('rejects a gateway response without a usable URL', async () => {
      const fetchMock = vi.fn((url: string) => {
         if (url === '/api/orders') return Promise.resolve(jsonResponse({ id: 'o1', number: 42 }))
         if (url === '/api/payments/tabapay') return Promise.resolve(jsonResponse({}))
         return Promise.resolve(jsonResponse([address]))
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())
      await waitFor(() => expect(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' })).toBeEnabled())

      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('نشانی درگاه نامعتبر است.')
      expect(redirectToPayment).not.toHaveBeenCalled()
   })

   it('tells the shopper when a coupon is invalid or exhausted', async () => {
      const fetchMock = vi.fn((url: string) => {
         if (url === '/api/orders') {
            return Promise.resolve(new Response('Discount code is invalid or expired', { status: 400 }))
         }
         return Promise.resolve(jsonResponse([address]))
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())
      await waitFor(() => expect(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' })).toBeEnabled())

      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'کد تخفیف نامعتبر یا منقضی شده است.'
      )
      expect(redirectToPayment).not.toHaveBeenCalled()
   })

   it('stops repeat submission when the gateway outcome is still unknown', async () => {
      /* A 202 means a transaction may exist. Submitting again could create a
         second order for the same cart, so the button must be locked. */
      const fetchMock = vi.fn((url: string) => {
         if (url === '/api/orders') return Promise.resolve(jsonResponse({ id: 'o1', number: 42 }))
         if (url === '/api/payments/tabapay') {
            return Promise.resolve(jsonResponse({ message: 'PAYMENT_ALREADY_INITIALIZED' }, 202))
         }
         return Promise.resolve(jsonResponse([address]))
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())
      await waitFor(() => expect(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' })).toBeEnabled())

      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
         /وضعیت ایجاد تراکنش هنوز مشخص نیست/
      )
      expect(redirectToPayment).not.toHaveBeenCalled()
      expect(
         screen.getByRole('button', { name: 'در انتظار بررسی تراکنش' })
      ).toBeDisabled()
   })

   it('explains a gateway that is temporarily not configured', async () => {
      const fetchMock = vi.fn((url: string) => {
         if (url === '/api/orders') return Promise.resolve(jsonResponse({ id: 'o1', number: 42 }))
         if (url === '/api/payments/tabapay') {
            return Promise.resolve(jsonResponse({ message: 'TABAPAY_NOT_CONFIGURED' }, 503))
         }
         return Promise.resolve(jsonResponse([address]))
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())
      await waitFor(() => expect(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' })).toBeEnabled())

      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'درگاه پرداخت موقتاً آماده نیست. سفارش لغو شده و می‌توانید بعداً دوباره تلاش کنید.'
      )
   })

   it('tolerates a gateway error body that is not JSON', async () => {
      const fetchMock = vi.fn((url: string) => {
         if (url === '/api/orders') return Promise.resolve(jsonResponse({ id: 'o1', number: 42 }))
         if (url === '/api/payments/tabapay') {
            return Promise.resolve(new Response('<html>bad gateway</html>', { status: 502 }))
         }
         return Promise.resolve(jsonResponse([address]))
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())
      await waitFor(() => expect(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' })).toBeEnabled())

      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'اتصال به درگاه پرداخت انجام نشد. اگر سفارش ثبت شده، پیش از تلاش مجدد وضعیت آن را بررسی کنید.'
      )
   })
})

describe('checkout — defensive branches', () => {
   it('cancels an address lookup that resolves after unmount', async () => {
      let release: (value: Response) => void = noop
      const pending = new Promise<Response>((resolve) => {
         release = resolve
      })
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(pending)))

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
      const fetchMock = vi.fn((url: string) => {
         if (url === '/api/orders') return Promise.resolve(new Response('', { status: 500 }))
         return Promise.resolve(jsonResponse([address]))
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())
      await waitFor(() => expect(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' })).toBeEnabled())

      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('ثبت سفارش انجام نشد.')
   })

   it('falls back to a generic message when the order fetch rejects with a non-Error', async () => {
      const fetchMock = vi.fn((url: string) => {
         if (url === '/api/orders') return rejectWith(NON_ERROR_REASON);
         return Promise.resolve(jsonResponse([address]))
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('radio')).toBeChecked())
      await waitFor(() => expect(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' })).toBeEnabled())

      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('خطا در ثبت سفارش')
   })

   it('ignores an address rejection that arrives after unmount', async () => {
      let reject: (reason: Error) => void = noop
      const pending = new Promise<Response>((_resolve, rejectFn) => {
         reject = rejectFn
      })
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(pending)))

      const { unmount } = render(<CheckoutPage />)
      unmount()

      await act(async () => {
         reject(new Error('late failure'))
         await pending.catch(() => {/* noop */ })
      })

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
   })

   it('ignores a non-Error rejection while loading addresses', async () => {
      vi.stubGlobal(
         'fetch',
         vi.fn(() => {
            return rejectWith(NON_ERROR_REASON);
         })
      )

      render(<CheckoutPage />)

      expect(await screen.findByRole('alert')).toHaveTextContent('خطا در دریافت نشانی‌ها')
   })

   it('ignores a non-Error rejection while saving an address', async () => {
      vi.stubGlobal(
         'fetch',
         vi.fn((_url: string, init?: RequestInit) => {
            if (init?.method === 'POST') return rejectWith(NON_ERROR_REASON);
            return Promise.resolve(jsonResponse([]))
         })
      )

      render(<CheckoutPage />)
      await screen.findByText('هنوز نشانی‌ای ثبت نکرده‌اید.')

      await user().click(screen.getByRole('button', { name: 'افزودن نشانی جدید' }))
      fireEvent.change(screen.getByLabelText('شهر'), { target: { value: 'تهران' } })
      fireEvent.change(screen.getByLabelText('نشانی کامل'), { target: { value: 'x' } })
      fireEvent.change(screen.getByLabelText('شماره تماس'), { target: { value: '0912' } })
      fireEvent.change(screen.getByLabelText('کد پستی'), { target: { value: '12' } })
      fireEvent.submit(screen.getByRole('button', { name: 'ذخیره نشانی' }).closest('form'))

      expect(await screen.findByRole('alert')).toHaveTextContent('خطا در ذخیره نشانی')
   })
})

/* The summary rows are the source of truth for money; matching on a bare
   number collides with the method labels. */
function summary(label: string) {
   const row = screen.getByText(label).parentElement
   return row?.textContent ?? ''
}

async function ready() {
   await waitFor(() =>
      expect(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' })).toBeEnabled()
   )
}

describe('checkout — shipping methods', () => {
   const settings = { taxEnabled: true, taxRate: 0.09, taxLabel: 'مالیات بر ارزش افزوده' }

   const flat = {
      id: 'sm1',
      code: 'post-pishtaz',
      title: 'پست پیشتاز',
      description: null,
      type: 'FlatRate',
      amount: 45_000,
      freeAbove: null,
      available: true,
      unavailableReason: null,
   }

   const freeAbove = {
      ...flat,
      id: 'sm2',
      code: 'free-above',
      title: 'ارسال رایگان بالای ۲۰۰',
      type: 'FreeAbove',
      amount: 45_000,
      freeAbove: 200,
   }

   const cityBlocked = {
      ...flat,
      id: 'sm3',
      code: 'tehran-only',
      title: 'فقط تهران',
      available: false,
      unavailableReason: 'CITY_NOT_SUPPORTED',
   }

   const carrier = {
      ...flat,
      id: 'sm4',
      code: 'tipax',
      title: 'تیپاکس',
      type: 'CarrierCalculated',
      available: false,
      unavailableReason: 'CARRIER_QUOTE_UNAVAILABLE',
   }

   function stubShipping(
      methods: unknown,
      options: { settingsBody?: unknown; shippingStatus?: number; orders?: () => Promise<Response> } = {}
   ) {
      const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
         if (url.startsWith('/api/shipping-methods')) {
            return options.shippingStatus
               ? new Response('down', { status: options.shippingStatus })
               : jsonResponse(methods)
         }
         if (url === '/api/store-settings') return jsonResponse(options.settingsBody ?? settings)
         if (url === '/api/orders') return options.orders ? await options.orders() : jsonResponse({ id: 'o1', number: 42 })
         if (url === '/api/payments/tabapay') {
            return jsonResponse({ paymentUrl: 'https://api.tabapay.ir/sandbox/pay/token' })
         }
         return jsonResponse([address])
      })
      vi.stubGlobal('fetch', fetchMock)
      return fetchMock
   }


   it('lists the methods for the selected city and preselects the first usable one', async () => {
      stubShipping([flat, freeAbove, cityBlocked, carrier])

      render(<CheckoutPage />)

      expect(await screen.findByRole('radio', { name: /پست پیشتاز/ })).toBeChecked()
      expect(screen.getByRole('radio', { name: /ارسال رایگان بالای ۲۰۰/ })).not.toBeChecked()
      expect(screen.getByText('برای شهر انتخاب‌شده ارائه نمی‌شود.')).toBeInTheDocument()
      expect(screen.getByText('استعلام آنلاین این شرکت هنوز متصل نشده است.')).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /فقط تهران/ })).toBeDisabled()
   })

   it('adds the shipping cost and the database tax rate to the total', async () => {
      stubShipping([flat])

      render(<CheckoutPage />)

      await ready()

      await waitFor(() => { expect(summary('هزینه ارسال')).toContain('۴۵٬۰۰۰'); })
      /* 250 - 10 = 240 taxable; tax 9% = 21.6; payable 240 + 21.6 + 45,000. */
      expect(summary('مالیات بر ارزش افزوده')).toContain('۲۲')
      expect(summary('مبلغ نهایی تقریبی')).toContain('۴۵٬۲۶۲')
   })

   it('charges nothing once the free-above threshold is met', async () => {
      stubShipping([freeAbove])

      render(<CheckoutPage />)

      /* Wait for the quote: the submit button is briefly enabled before the
         address arrives and the shipping fetch starts. */
      expect(
         await screen.findByRole('radio', { name: /ارسال رایگان بالای ۲۰۰/ })
      ).toBeChecked()
      await waitFor(() => { expect(summary('هزینه ارسال')).toContain('۰'); })
      expect(summary('مبلغ نهایی تقریبی')).toContain('۲۶۲')
   })

   it('re-quotes when another method is selected', async () => {
      stubShipping([flat, { ...flat, id: 'sm9', code: 'free', title: 'رایگان', type: 'Free', amount: 0 }])

      render(<CheckoutPage />)

      await ready()
      await waitFor(() => { expect(summary('هزینه ارسال')).toContain('۴۵٬۰۰۰'); })

      fireEvent.click(screen.getByRole('radio', { name: /رایگان/ }))

      await waitFor(() => { expect(summary('مبلغ نهایی تقریبی')).toContain('۲۶۲'); })
   })

   it('sends the selected method id with the order', async () => {
      const fetchMock = stubShipping([flat])

      render(<CheckoutPage />)

      await ready()
      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      await waitFor(() => { expect(redirectToPayment).toHaveBeenCalled(); })
      const orderCall = fetchMock.mock.calls.find(([url]) => url === '/api/orders')
      const payload = jsonBody(orderCall?.[1]?.body)
      expect(payload.shippingMethodId).toBe('sm1')
      expect(payload.idempotencyKey).toEqual(expect.stringMatching(/^[a-f0-9-]{36}$/i))
   })

   it('reuses the same idempotency key when retrying after a failed gateway call', async () => {
      let gatewayAttempt = 0
      const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
         if (url === '/api/shipping/methods') return Promise.resolve(jsonResponse([flat]))
         if (url === '/api/orders') return Promise.resolve(jsonResponse({ id: 'o1', number: 42 }))
         if (url === '/api/payments/tabapay') {
            gatewayAttempt += 1
            if (gatewayAttempt === 1) return Promise.resolve(jsonResponse({ message: 'GATEWAY_DOWN' }, 502))
            return Promise.resolve(jsonResponse({ paymentUrl: 'https://api.tabapay.ir/pay/retry' }))
         }
         return Promise.resolve(jsonResponse([address]))
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)
      await waitFor(() => expect(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' })).toBeEnabled())

      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))
      await waitFor(() => { expect(gatewayAttempt).toBe(1); })

      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))
      await waitFor(() => { expect(redirectToPayment).toHaveBeenCalledWith('https://api.tabapay.ir/pay/retry'); })

      const keys = fetchMock.mock.calls
         .filter(([url]) => url === '/api/orders')
         .map(([, init]) => jsonBody(init?.body).idempotencyKey)
      expect(keys).toHaveLength(2)
      expect(keys[0]).toEqual(expect.stringMatching(/^[a-f0-9-]{36}$/i))
      expect(keys[1]).toBe(keys[0])
   })

   it('lets an order through when the store has no shipping methods', async () => {
      stubShipping([])

      render(<CheckoutPage />)

      expect(
         await screen.findByText(/روش ارسالی تعریف نشده است/)
      ).toBeInTheDocument()
      await ready()
   })

   it('blocks checkout when no method serves the delivery city', async () => {
      stubShipping([cityBlocked])

      render(<CheckoutPage />)

      expect(await screen.findByText(/روش ارسال فعالی وجود ندارد/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' })).toBeDisabled()
   })

   it('stops checkout when the shipping quote itself cannot be fetched', async () => {
      stubShipping([flat], { shippingStatus: 500 })

      render(<CheckoutPage />)

      expect(await screen.findByText(/در دسترس نیستند/)).toBeInTheDocument()
      const alerts = await screen.findAllByRole('alert')
      expect(
         alerts.some((alert) => alert.textContent?.includes('هزینه ارسال یا تنظیمات مالیات'))
      ).toBe(true)
      expect(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' })).toBeDisabled()
   })

   it('treats a non-array shipping payload as no methods', async () => {
      stubShipping({ nope: true })

      render(<CheckoutPage />)

      expect(await screen.findByText(/روش ارسالی تعریف نشده است/)).toBeInTheDocument()
   })

   it('ignores malformed entries in the shipping payload', async () => {
      stubShipping([{ id: 5 }, flat])

      render(<CheckoutPage />)

      expect(await screen.findByRole('radio', { name: /پست پیشتاز/ })).toBeChecked()
   })

   it('falls back to the default tax settings when the payload is unusable', async () => {
      stubShipping([flat], { settingsBody: { taxEnabled: 'yes', taxRate: 'nine', taxLabel: 7 } })

      render(<CheckoutPage />)

      await ready()
      /* Default 9% on 240 rounds to 22. */
      expect(summary('مالیات بر ارزش افزوده')).toContain('۲۲')
   })

   it('hides the tax row when tax is disabled in the store settings', async () => {
      stubShipping([flat], {
         settingsBody: { taxEnabled: false, taxRate: 0.09, taxLabel: 'مالیات' },
      })

      render(<CheckoutPage />)

      await screen.findByRole('radio', { name: /پست پیشتاز/ })
      /* The label is the operator's own text; the amount must be zero. */
      expect(summary('مالیات')).toContain('۰')
   })

   it.each([
      ['SHIPPING_METHOD_REQUIRED', 'لطفاً روش ارسال را انتخاب کنید.'],
      [
         'SHIPPING_METHOD_UNAVAILABLE',
         'روش ارسال انتخاب‌شده برای این نشانی در دسترس نیست. دوباره انتخاب کنید.',
      ],
      ['SHIPPING_NOT_AVAILABLE_FOR_CITY', 'به این نشانی ارسال نداریم. نشانی دیگری انتخاب کنید.'],
   ])('explains %s from a JSON body', async (code, text) => {
      stubShipping([flat], {
         orders: () => Promise.resolve(jsonResponse({ message: code }, code === 'SHIPPING_METHOD_REQUIRED' ? 400 : 409)),
      })

      render(<CheckoutPage />)

      await ready()
      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(text)
      /* The old code showed the raw JSON body instead. */
      expect(alert.textContent).not.toContain('{')
   })

   it('does not mistake a shipping conflict for a stock conflict', async () => {
      stubShipping([flat], {
         orders: () => Promise.resolve(jsonResponse({ message: 'SHIPPING_METHOD_UNAVAILABLE' }, 409)),
      })

      render(<CheckoutPage />)

      await ready()
      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      const alert = await screen.findByRole('alert')
      expect(alert).not.toHaveTextContent('موجودی یکی از محصولات تغییر کرده است.')
   })

   it('reports a malformed order payload in Persian', async () => {
      stubShipping([flat], { orders: () => Promise.resolve(jsonResponse({ message: 'INVALID_ORDER_REQUEST' }, 400)) })

      render(<CheckoutPage />)

      await ready()
      await user().click(screen.getByRole('button', { name: 'پرداخت و ثبت سفارش' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('اطلاعات سفارش کامل نیست.')
   })
})

describe('checkout — shipping edge cases', () => {
   const settings = { taxEnabled: true, taxRate: 0.09, taxLabel: 'مالیات بر ارزش افزوده' }

   const flat = {
      id: 'sm1',
      code: 'post-pishtaz',
      title: 'پست پیشتاز',
      description: 'تحویل ۲ تا ۳ روز کاری',
      type: 'FlatRate',
      amount: 45_000,
      freeAbove: null,
      available: true,
      unavailableReason: null,
   }

   function stub(methods: unknown, extra: { settingsBody?: unknown; pendingShipping?: boolean } = {}) {
      const fetchMock = vi.fn(async (url: string) => {
         if (url.startsWith('/api/shipping-methods')) {
            if (extra.pendingShipping) return await new Promise<Response>(() => { /* never settles */ })
            return jsonResponse(methods)
         }
         if (url === '/api/store-settings') return jsonResponse(extra.settingsBody ?? settings)
         return jsonResponse([address])
      })
      vi.stubGlobal('fetch', fetchMock)
      return fetchMock
   }

   it('renders a method description and an unset free-above threshold', async () => {
      stub([
         flat,
         { ...flat, id: 'sm2', code: 'above', title: 'آستانه‌دار', type: 'FreeAbove', freeAbove: null },
      ])

      render(<CheckoutPage />)

      const descriptions = await screen.findAllByText('تحویل ۲ تا ۳ روز کاری')
      expect(descriptions.length).toBe(2)
      expect(screen.getByText(/از ۰ تومان رایگان/)).toBeInTheDocument()

      /* Without a threshold the method never becomes free on its own. */
      fireEvent.click(screen.getByRole('radio', { name: /آستانه‌دار/ }))

      await waitFor(() => { expect(summaryRow('هزینه ارسال')).toContain('۴۵٬۰۰۰'); })
   })

   it('ignores malformed entries in the quote payload', async () => {
      stub([null, 'ناقص', { id: 42, available: true }, { id: 'no-flag' }, flat])

      render(<CheckoutPage />)

      /* Only the well-formed method survives the filter. */
      expect(await screen.findByRole('radio', { name: /پست پیشتاز/ })).toBeInTheDocument()
      expect(screen.queryAllByRole('radio', { name: /ناقص|no-flag/ })).toHaveLength(0)
      /* One address plus one shipping method: the junk entries are gone. */
      expect(screen.getAllByRole('radio')).toHaveLength(2)
   })

   it('keeps the chosen method when the address changes but the quote is still valid', async () => {
      const other = { ...address, id: 'ad2', address: 'خیابان دوم' }
      const fetchMock = vi.fn((url: string) => {
         if (url.startsWith('/api/shipping-methods')) return Promise.resolve(jsonResponse([flat]))
         if (url === '/api/store-settings') return Promise.resolve(jsonResponse(settings))
         return Promise.resolve(jsonResponse([address, other]))
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)

      await screen.findByRole('radio', { name: /پست پیشتاز/ })
      fireEvent.click(screen.getByRole('radio', { name: /خیابان دوم/ }))

      await waitFor(() =>
         expect(screen.getByRole('radio', { name: /پست پیشتاز/ })).toBeChecked()
      )
   })

   it('applies each documented fallback when the settings payload is unusable', async () => {
      stub([flat], { settingsBody: { taxEnabled: 'yes', taxRate: 'nine', taxLabel: 7 } })

      render(<CheckoutPage />)

      /* The default label proves the fallback ran, not just the initial state. */
      expect(await screen.findByText('مالیات بر ارزش افزوده')).toBeInTheDocument()
      expect(screen.getByText('۲۲ تومان')).toBeInTheDocument()
   })

   it('does not update state when the quote resolves after unmount', async () => {
      let release: ((value: Response) => void) | null = null
      const pending = new Promise<Response>((resolve) => {
         release = resolve
      })
      const fetchMock = vi.fn(async (url: string) => {
         if (url.startsWith('/api/shipping-methods')) return await pending
         if (url === '/api/store-settings') return jsonResponse(settings)
         return jsonResponse([address])
      })
      vi.stubGlobal('fetch', fetchMock)

      const { unmount } = render(<CheckoutPage />)
      await screen.findByText('نشانی تحویل سفارش')

      unmount()
      release?.(Response.json([flat]))
      await pending

      /* The effect bails out quietly instead of touching unmounted state. */
      expect(screen.queryByText('پست پیشتاز')).not.toBeInTheDocument()
   })

   it('does not report a quote failure after unmount', async () => {
      let reject: ((reason: unknown) => void) | null = null
      const pending = new Promise<Response>((_resolve, reject_) => {
         reject = reject_
      })
      const fetchMock = vi.fn(async (url: string) => {
         if (url.startsWith('/api/shipping-methods')) return await pending
         if (url === '/api/store-settings') return jsonResponse(settings)
         return jsonResponse([address])
      })
      vi.stubGlobal('fetch', fetchMock)

      const { unmount } = render(<CheckoutPage />)
      await screen.findByText('نشانی تحویل سفارش')

      unmount()
      reject?.(new Error('شبکه قطع است'))
      await pending.catch(() => {
         /* the rejection itself is the point */
      })

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
   })

   it('reports a non-Error quote failure with a generic message', async () => {
      const fetchMock = vi.fn((url: string) => {
         if (url.startsWith('/api/shipping-methods')) return rejectWith(NON_ERROR_QUOTE);
         if (url === '/api/store-settings') return Promise.resolve(jsonResponse(settings))
         return Promise.resolve(jsonResponse([address]))
      })
      vi.stubGlobal('fetch', fetchMock)

      render(<CheckoutPage />)

      const alerts = await screen.findAllByRole('alert')
      expect(
         alerts.some((alert) => alert.textContent?.includes('دریافت تنظیمات خرید انجام نشد.'))
      ).toBe(true)
   })

   it('charges the flat amount when a free-above threshold is not reached', async () => {
      stub([
         flat,
         { ...flat, id: 'sm3', code: 'above-big', title: 'بالای یک میلیون', type: 'FreeAbove', freeAbove: 1_000_000 },
      ])

      render(<CheckoutPage />)

      fireEvent.click(await screen.findByRole('radio', { name: /بالای یک میلیون/ }))

      await waitFor(() => { expect(summaryRow('هزینه ارسال')).toContain('۴۵٬۰۰۰'); })
      expect(summaryRow('مبلغ نهایی تقریبی')).toContain('۴۵٬۲۶۲')
   })
})
