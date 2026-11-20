import SettingsPage from '@/app/admin/(dashboard)/settings/page'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const loaded = {
   taxEnabled: true,
   taxRate: 9,
   taxLabel: 'مالیات بر ارزش افزوده',
   currency: 'IRT',
   gateway: {
      code: 'tabapay',
      title: 'TabaPay',
      isActive: true,
      sandbox: true,
      credentialsConfigured: true,
   },
}

function jsonResponse(body: unknown, ok = true) {
   return Promise.resolve({
      ok,
      json: () => Promise.resolve(body),
   })
}

function stubFetch(...responses: Promise<unknown>[]) {
   const queue = [...responses]
   const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
      const next = queue.shift()
      if (next === undefined) throw new Error('unexpected fetch call')
      return await next
   })
   vi.stubGlobal('fetch', fetchMock)
   return fetchMock
}

afterEach(() => {
   vi.unstubAllGlobals()
})

describe('admin settings page', () => {
   it('shows the loading state before the settings arrive', () => {
      stubFetch(new Promise<never>(() => {
         /* never settles: keeps the in-flight state observable */
      }))

      render(<SettingsPage />)

      expect(screen.getByText('در حال بارگذاری تنظیمات...')).toBeInTheDocument()
   })

   it('renders the stored tax and gateway values', async () => {
      stubFetch(jsonResponse(loaded))

      render(<SettingsPage />)

      expect(await screen.findByText('تنظیمات فروشگاه')).toBeInTheDocument()
      expect(screen.getByLabelText('نرخ مالیات (درصد)')).toHaveValue(9)
      expect(screen.getByLabelText('محاسبه مالیات فعال باشد')).toBeChecked()
      expect(screen.getByText('کلید رمزنگاری‌شده ذخیره شده است.')).toBeInTheDocument()
   })

   it('translates a rejected read into a Persian message and offers a retry', async () => {
      stubFetch(jsonResponse({ message: 'SETTINGS_READ_FAILED' }, false), jsonResponse(loaded))

      render(<SettingsPage />)

      expect(await screen.findByRole('alert')).toHaveTextContent('دریافت تنظیمات ناموفق بود.')

      fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }))

      expect(await screen.findByText('تنظیمات فروشگاه')).toBeInTheDocument()
   })

   it('falls back to a Persian message when the read fails without a known code', async () => {
      stubFetch(Promise.reject(new Error('network down')))

      render(<SettingsPage />)

      expect(await screen.findByRole('alert')).toHaveTextContent('دریافت تنظیمات ناموفق بود.')
   })

   it('saves the tax rate as a fraction and reports success', async () => {
      const fetchMock = stubFetch(
         jsonResponse(loaded),
         jsonResponse({ saved: true }),
         jsonResponse({ ...loaded, taxRate: 10 })
      )

      render(<SettingsPage />)

      const rate = await screen.findByLabelText('نرخ مالیات (درصد)')
      fireEvent.change(rate, { target: { value: '10' } })
      fireEvent.submit(screen.getByRole('button', { name: 'ذخیره تنظیمات' }))

      expect(await screen.findByText('تنظیمات با موفقیت ذخیره شد.')).toBeInTheDocument()

      const putCall = fetchMock.mock.calls[1][1]
      const payload = JSON.parse((putCall.body as string)) as { taxRate: number; gatewayActive: boolean }
      expect(payload.taxRate).toBeCloseTo(0.1)
      expect(payload.gatewayActive).toBe(true)
   })

   it('includes the merchant key only when the operator typed one', async () => {
      const fetchMock = stubFetch(
         jsonResponse(loaded),
         jsonResponse({ saved: true }),
         jsonResponse(loaded)
      )

      render(<SettingsPage />)

      const key = await screen.findByPlaceholderText('برای حفظ کلید فعلی خالی بگذارید')
      fireEvent.change(key, { target: { value: '  secret-key  ' } })
      fireEvent.submit(screen.getByRole('button', { name: 'ذخیره تنظیمات' }))

      await screen.findByText('تنظیمات با موفقیت ذخیره شد.')

      const payload = JSON.parse((fetchMock.mock.calls[1][1]?.body as string)) as {
         merchantKey?: string
      }
      expect(payload.merchantKey).toBe('secret-key')
      expect(key).toHaveValue('')
   })

   it('warns when the gateway is active but its credential is unreadable', async () => {
      stubFetch(
         jsonResponse({
            ...loaded,
            gateway: { ...loaded.gateway, credentialsConfigured: false },
         })
      )

      render(<SettingsPage />)

      expect(
         await screen.findByText(/درگاه فعال است اما کلید پذیرنده قابل خواندن نیست/)
      ).toBeInTheDocument()
   })

   it('explains that a gateway change is blocked by pending payments', async () => {
      stubFetch(
         jsonResponse(loaded),
         jsonResponse({ message: 'GATEWAY_HAS_PENDING_TRANSACTIONS' }, false)
      )

      render(<SettingsPage />)

      fireEvent.click(await screen.findByLabelText('حالت آزمایشی (Sandbox) فعال باشد'))
      fireEvent.submit(screen.getByRole('button', { name: 'ذخیره تنظیمات' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'تا زمانی که پرداخت در حال پردازش وجود دارد، تنظیمات درگاه قابل تغییر نیست.'
      )
   })

   it('explains a missing encryption key', async () => {
      stubFetch(
         jsonResponse(loaded),
         jsonResponse({ message: 'APP_SETTINGS_ENCRYPTION_KEY_REQUIRED' }, false)
      )

      render(<SettingsPage />)

      fireEvent.submit(await screen.findByRole('button', { name: 'ذخیره تنظیمات' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
         /کلید رمزنگاری سرور تنظیم نشده است/
      )
   })

   it('shows the saving state while the request is in flight', async () => {
      stubFetch(jsonResponse(loaded), new Promise<never>(() => {
         /* never settles: keeps the in-flight state observable */
      }))

      render(<SettingsPage />)

      fireEvent.submit(await screen.findByRole('button', { name: 'ذخیره تنظیمات' }))

      await waitFor(() =>
         expect(screen.getByRole('button', { name: 'در حال ذخیره...' })).toBeDisabled()
      )
   })

   it('falls back to a Persian message for an unknown save failure', async () => {
      stubFetch(jsonResponse(loaded), Promise.reject(new Error('boom')))

      render(<SettingsPage />)

      fireEvent.submit(await screen.findByRole('button', { name: 'ذخیره تنظیمات' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('ذخیره تنظیمات ناموفق بود.')
   })

   it('edits every field through its handler', async () => {
      const fetchMock = stubFetch(
         jsonResponse(loaded),
         jsonResponse({ saved: true }),
         jsonResponse(loaded)
      )

      render(<SettingsPage />)

      fireEvent.click(await screen.findByLabelText('محاسبه مالیات فعال باشد'))
      fireEvent.change(screen.getByLabelText('عنوان مالیات'), { target: { value: 'عوارض' } })
      fireEvent.click(screen.getByLabelText('درگاه برای پرداخت‌های جدید فعال باشد'))
      fireEvent.submit(screen.getByRole('button', { name: 'ذخیره تنظیمات' }))

      await screen.findByText('تنظیمات با موفقیت ذخیره شد.')

      const payload = JSON.parse((fetchMock.mock.calls[1][1]?.body as string)) as {
         taxEnabled: boolean
         taxLabel: string
         gatewayActive: boolean
      }
      expect(payload.taxEnabled).toBe(false)
      expect(payload.taxLabel).toBe('عوارض')
      expect(payload.gatewayActive).toBe(false)
   })

   it('falls back to a generic code when the read fails without one', async () => {
      stubFetch(jsonResponse({}, false))

      render(<SettingsPage />)

      expect(await screen.findByRole('alert')).toHaveTextContent('دریافت تنظیمات ناموفق بود.')
   })

   it('survives a rejection that is not an Error', async () => {
      /* Deliberately non-Error: the component must not crash on it. */
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- covering the non-Error rejection path
      stubFetch(Promise.reject('plain string'))

      render(<SettingsPage />)

      expect(await screen.findByRole('alert')).toHaveTextContent('دریافت تنظیمات ناموفق بود.')
   })

   it('survives a non-Error rejection while saving', async () => {
      /* Deliberately non-Error: the component must not crash on it. */
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- covering the non-Error rejection path
      stubFetch(jsonResponse(loaded), Promise.reject('plain string'))

      render(<SettingsPage />)

      fireEvent.submit(await screen.findByRole('button', { name: 'ذخیره تنظیمات' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('ذخیره تنظیمات ناموفق بود.')
   })

   it('falls back to a generic code when saving fails without one', async () => {
      stubFetch(jsonResponse(loaded), jsonResponse({}, false))

      render(<SettingsPage />)

      fireEvent.submit(await screen.findByRole('button', { name: 'ذخیره تنظیمات' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('ذخیره تنظیمات ناموفق بود.')
   })

   it('shows a neutral message when the read returns no settings at all', async () => {
      stubFetch(jsonResponse(null))

      render(<SettingsPage />)

      expect(await screen.findByText('تنظیمات در دسترس نیست.')).toBeInTheDocument()
   })

   it('uses the placeholder that matches whether a key is stored', async () => {
      stubFetch(
         jsonResponse({
            ...loaded,
            gateway: { ...loaded.gateway, credentialsConfigured: false },
         })
      )

      render(<SettingsPage />)

      expect(
         await screen.findByPlaceholderText('کلید پذیرنده را وارد کنید')
      ).toBeInTheDocument()
      expect(screen.getByText('هنوز کلیدی ذخیره نشده است.')).toBeInTheDocument()
   })
})
