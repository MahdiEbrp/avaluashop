import ShippingPage from '@/app/admin/(dashboard)/shipping/page'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const flat = {
   id: 'sm1',
   code: 'post-pishtaz',
   title: 'پست پیشتاز',
   description: null,
   type: 'FlatRate' as const,
   amount: 45_000,
   freeAbove: null,
   isActive: true,
   sortOrder: 0,
   allowedCities: ['تهران', 'کرج'],
   _count: { orders: 3 },
}

const free = {
   ...flat,
   id: 'sm2',
   code: 'free-shipping',
   title: 'ارسال رایگان',
   type: 'Free' as const,
   amount: 0,
   allowedCities: [],
}

const freeAbove = {
   ...flat,
   id: 'sm3',
   code: 'free-above',
   title: 'بالای ۵۰۰ هزار',
   type: 'FreeAbove' as const,
   freeAbove: 500_000,
   isActive: false,
}

const carrier = {
   ...flat,
   id: 'sm4',
   code: 'tipax-live',
   title: 'تیپاکس',
   type: 'CarrierCalculated' as const,
}

function jsonResponse(body: unknown, ok = true) {
   return Promise.resolve({ ok, json: () => Promise.resolve(body) })
}

function stubFetch(...responses: Promise<unknown>[]) {
   for (const r of responses) r.catch(() => {/* noop */ })
   const queue = [...responses]
   const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
      const next = queue.shift()
      if (next === undefined) throw new Error('unexpected fetch call')
      return await next
   })
   vi.stubGlobal('fetch', fetchMock)
   return fetchMock
}

function payloadOf(fetchMock: ReturnType<typeof stubFetch>, index = 1) {
   return JSON.parse(String(fetchMock.mock.calls[index][1]?.body)) as Record<string, unknown>
}

afterEach(() => {
   vi.unstubAllGlobals()
})

describe('admin shipping page', () => {
   it('shows a loading state first', () => {
      stubFetch(new Promise(() => new Response('{}')))

      render(<ShippingPage />)

      expect(screen.getByText('در حال بارگذاری...')).toBeInTheDocument()
   })

   it('lists methods with their price, city list and order count', async () => {
      stubFetch(jsonResponse([flat, free, freeAbove, carrier]))

      render(<ShippingPage />)

      expect(await screen.findByText('پست پیشتاز')).toBeInTheDocument()
      expect(screen.getAllByText('۴۵٬۰۰۰ تومان').length).toBeGreaterThan(0)
      expect(screen.getAllByText('رایگان').length).toBeGreaterThan(0)
      expect(screen.getByText(/رایگان از ۵۰۰٬۰۰۰ تومان/)).toBeInTheDocument()
      expect(screen.getAllByText(/تهران، کرج · 3 سفارش مرتبط/).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/همه شهرها · 3 سفارش مرتبط/).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/محاسبه توسط شرکت حمل‌ونقل/).length).toBeGreaterThan(0)
      expect(screen.getByText('روش‌های ثبت‌شده (4)')).toBeInTheDocument()
   })

   it('shows the empty state when nothing is stored', async () => {
      stubFetch(jsonResponse([]))

      render(<ShippingPage />)

      expect(await screen.findByText('هنوز روش ارسالی ثبت نشده است.')).toBeInTheDocument()
   })

   it('translates a read failure and offers no form data', async () => {
      stubFetch(jsonResponse({ message: 'SHIPPING_METHODS_READ_FAILED' }, false))

      render(<ShippingPage />)

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'دریافت روش‌های ارسال انجام نشد.'
      )
   })

   it('falls back to a Persian message for an unknown read failure', async () => {
      stubFetch(Promise.reject(new Error('boom')))

      render(<ShippingPage />)

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'دریافت روش‌های ارسال انجام نشد.'
      )
   })

   it('creates a method and splits the city list on Persian commas', async () => {
      const fetchMock = stubFetch(jsonResponse([]), jsonResponse({ id: 'new' }, true), jsonResponse([flat]))

      render(<ShippingPage />)
      await screen.findByText('هنوز روش ارسالی ثبت نشده است.')

      fireEvent.change(screen.getByLabelText('کد یکتا (انگلیسی)'), { target: { value: ' Post ' } })
      fireEvent.change(screen.getByLabelText('عنوان نمایشی'), { target: { value: 'پست' } })
      fireEvent.change(screen.getByLabelText('هزینه ارسال (تومان)'), { target: { value: '45000' } })
      fireEvent.change(screen.getByLabelText(/شهرهای مجاز/), {
         target: { value: 'تهران، کرج' },
      })
      fireEvent.submit(screen.getByRole('button', { name: 'افزودن روش ارسال' }))

      expect(await screen.findByRole('status')).toHaveTextContent('روش ارسال ذخیره شد.')

      expect(payloadOf(fetchMock)).toMatchObject({
         code: 'post',
         title: 'پست',
         type: 'FlatRate',
         amount: 45_000,
         freeAbove: null,
         isActive: true,
         allowedCities: ['تهران', 'کرج'],
      })
      expect(fetchMock.mock.calls[1][0]).toBe('/api/admin/shipping-methods')
      expect(fetchMock.mock.calls[1][1]?.method).toBe('POST')
   })

   it('reveals the threshold field only for the free-above type', async () => {
      stubFetch(jsonResponse([]))

      render(<ShippingPage />)
      await screen.findByText('هنوز روش ارسالی ثبت نشده است.')

      expect(screen.queryByLabelText(/حداقل مبلغ سفارش/)).not.toBeInTheDocument()

      fireEvent.change(screen.getByLabelText('نوع روش ارسال'), { target: { value: 'FreeAbove' } })

      fireEvent.change(screen.getByLabelText(/حداقل مبلغ سفارش/), { target: { value: '500000' } })
      expect(screen.getByLabelText('هزینه ارسال (تومان)')).not.toBeDisabled()
   })

   it('disables the amount field for a free method', async () => {
      stubFetch(jsonResponse([]))

      render(<ShippingPage />)
      await screen.findByText('هنوز روش ارسالی ثبت نشده است.')

      fireEvent.change(screen.getByLabelText('نوع روش ارسال'), { target: { value: 'Free' } })

      expect(screen.getByLabelText('هزینه ارسال (تومان)')).toBeDisabled()
   })

   it('sends a PATCH when editing an existing method', async () => {
      const fetchMock = stubFetch(jsonResponse([flat]), jsonResponse({ id: 'sm1' }), jsonResponse([flat]))

      render(<ShippingPage />)

      fireEvent.click(await screen.findByRole('button', { name: 'ویرایش' }))
      expect(screen.getByText('ویرایش روش ارسال')).toBeInTheDocument()
      expect(screen.getByLabelText('عنوان نمایشی')).toHaveValue('پست پیشتاز')

      fireEvent.change(screen.getByLabelText('عنوان نمایشی'), { target: { value: 'پست نو' } })
      fireEvent.submit(screen.getByRole('button', { name: 'ذخیره تغییرات' }))

      await waitFor(() => { expect(fetchMock.mock.calls[1][0]).toBe('/api/admin/shipping-methods/sm1'); }
      )
      expect(fetchMock.mock.calls[1][1]?.method).toBe('PATCH')
      expect(payloadOf(fetchMock).isActive).toBeUndefined()
   })

   it('clears the form when the operator cancels an edit', async () => {
      stubFetch(jsonResponse([flat]))

      render(<ShippingPage />)

      fireEvent.click(await screen.findByRole('button', { name: 'ویرایش' }))
      fireEvent.click(screen.getByRole('button', { name: 'انصراف' }))

      expect(screen.queryByRole('button', { name: 'انصراف' })).not.toBeInTheDocument()
      expect(screen.getByLabelText('عنوان نمایشی')).toHaveValue('')
      expect(
         screen.getByRole('heading', { name: 'افزودن روش ارسال' })
      ).toBeInTheDocument()
   })

   it('shows the API code translated when saving is rejected', async () => {
      stubFetch(jsonResponse([]), jsonResponse({ message: 'SHIPPING_METHOD_CODE_EXISTS' }, false))

      render(<ShippingPage />)
      await screen.findByText('هنوز روش ارسالی ثبت نشده است.')

      fireEvent.submit(screen.getByRole('button', { name: 'افزودن روش ارسال' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'این کد قبلاً برای روش دیگری ثبت شده است.'
      )
   })

   it('falls back to a Persian message when saving fails unexpectedly', async () => {
      stubFetch(jsonResponse([]), Promise.reject(new Error('boom')))

      render(<ShippingPage />)
      await screen.findByText('هنوز روش ارسالی ثبت نشده است.')

      fireEvent.submit(screen.getByRole('button', { name: 'افزودن روش ارسال' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('ذخیره روش ارسال ناموفق بود.')
   })

   it('toggles a method off', async () => {
      const fetchMock = stubFetch(jsonResponse([flat]), jsonResponse({ id: 'sm1' }), jsonResponse([{ ...flat, isActive: false }]))

      render(<ShippingPage />)

      fireEvent.click(await screen.findByRole('button', { name: 'غیرفعال‌کردن' }))

      await waitFor(() => { expect(fetchMock.mock.calls[1][1]?.body).toBe('{"isActive":false}'); })
      expect(await screen.findByText('غیرفعال')).toBeInTheDocument()
   })

   it('reports a failed toggle', async () => {
      stubFetch(jsonResponse([flat]), jsonResponse({}, false))

      render(<ShippingPage />)

      fireEvent.click(await screen.findByRole('button', { name: 'غیرفعال‌کردن' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'تغییر وضعیت روش ارسال انجام نشد.'
      )
   })

   it('asks before disabling and sends DELETE when confirmed', async () => {
      const confirmMock = vi.fn(() => true)
      vi.stubGlobal('confirm', confirmMock)
      const fetchMock = stubFetch(jsonResponse([flat]), jsonResponse({ deleted: true }), jsonResponse([]))

      render(<ShippingPage />)

      fireEvent.click(await screen.findByRole('button', { name: 'حذف / توقف' }))

      expect(confirmMock).toHaveBeenCalled()
      await waitFor(() => { expect(fetchMock.mock.calls[1][1]?.method).toBe('DELETE'); })
      expect(await screen.findByRole('status')).toHaveTextContent('روش ارسال غیرفعال شد.')
   })

   it('does nothing when the operator cancels the confirmation', async () => {
      const confirmMock = vi.fn(() => false)
      vi.stubGlobal('confirm', confirmMock)
      const fetchMock = stubFetch(jsonResponse([flat]))

      render(<ShippingPage />)

      fireEvent.click(await screen.findByRole('button', { name: 'حذف / توقف' }))

      expect(confirmMock).toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledTimes(1)
   })

   it('reports a failed disable', async () => {
      vi.stubGlobal('confirm', vi.fn(() => true))
      stubFetch(jsonResponse([flat]), jsonResponse({}, false))

      render(<ShippingPage />)

      fireEvent.click(await screen.findByRole('button', { name: 'حذف / توقف' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'غیرفعال‌سازی روش ارسال انجام نشد.'
      )
   })

   it('does not let a carrier-calculated method be edited', async () => {
      stubFetch(jsonResponse([carrier]))

      render(<ShippingPage />)

      expect(await screen.findByRole('button', { name: 'ویرایش' })).toBeDisabled()
   })

   it('shows an inactive method as re-enablable', async () => {
      stubFetch(jsonResponse([freeAbove]))

      render(<ShippingPage />)

      const article = (await screen.findByText('بالای ۵۰۰ هزار')).closest('article')
      expect(article).not.toBeNull()
      expect(within(article).getByRole('button', { name: 'فعال‌کردن' })).toBeInTheDocument()
      expect(within(article).getByRole('button', { name: 'حذف / توقف' })).toBeDisabled()
   })
})

describe('admin shipping page — remaining branches', () => {
   it('falls back when a read failure carries no code', async () => {
      stubFetch(jsonResponse({}, false))

      render(<ShippingPage />)

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'دریافت روش‌های ارسال انجام نشد.'
      )
   })

   it('survives a non-Error rejection while reading', async () => {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- covering the non-Error rejection path
      stubFetch(Promise.reject('boom'))

      render(<ShippingPage />)

      expect(await screen.findByRole('alert')).toHaveTextContent(
         'دریافت روش‌های ارسال انجام نشد.'
      )
   })

   it('defaults empty amount and sort order to zero and keeps the threshold', async () => {
      const fetchMock = stubFetch(jsonResponse([]), jsonResponse({ id: 'new' }), jsonResponse([]))

      render(<ShippingPage />)
      await screen.findByText('هنوز روش ارسالی ثبت نشده است.')

      fireEvent.change(screen.getByLabelText('کد یکتا (انگلیسی)'), { target: { value: 'free-above' } })
      fireEvent.change(screen.getByLabelText('عنوان نمایشی'), { target: { value: 'آستانه' } })
      fireEvent.change(screen.getByLabelText('نوع روش ارسال'), { target: { value: 'FreeAbove' } })
      fireEvent.change(screen.getByLabelText(/حداقل مبلغ سفارش/), { target: { value: '500000' } })
      fireEvent.change(screen.getByLabelText(/هزینه ارسال \(تومان\)/), { target: { value: '' } })
      fireEvent.change(screen.getByLabelText(/اولویت نمایش/), { target: { value: '' } })
      fireEvent.submit(screen.getByRole('button', { name: 'افزودن روش ارسال' }))

      await waitFor(() => { expect(fetchMock).toHaveBeenCalledTimes(3); })

      expect(payloadOf(fetchMock)).toMatchObject({
         type: 'FreeAbove',
         freeAbove: 500_000,
         amount: 0,
         sortOrder: 0,
      })
   })

   it('falls back when a save failure carries no code', async () => {
      stubFetch(jsonResponse([]), jsonResponse({}, false))

      render(<ShippingPage />)
      await screen.findByText('هنوز روش ارسالی ثبت نشده است.')

      fireEvent.submit(screen.getByRole('button', { name: 'افزودن روش ارسال' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('ذخیره روش ارسال ناموفق بود.')
   })

   it('survives a non-Error rejection while saving', async () => {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- covering the non-Error rejection path
      stubFetch(jsonResponse([]), Promise.reject('boom'))

      render(<ShippingPage />)
      await screen.findByText('هنوز روش ارسالی ثبت نشده است.')

      fireEvent.submit(screen.getByRole('button', { name: 'افزودن روش ارسال' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('ذخیره روش ارسال ناموفق بود.')
   })

   it('loads a method without description, with a threshold and no order count into the form', async () => {
      stubFetch(
         jsonResponse([
            {
               ...flat,
               id: 'sm9',
               code: 'free-above',
               title: 'آستانه‌دار',
               description: null,
               type: 'FreeAbove',
               freeAbove: 250_000,
               allowedCities: [],
               _count: undefined,
            },
         ])
      )

      render(<ShippingPage />)

      fireEvent.click(await screen.findByRole('button', { name: 'ویرایش' }))

      expect(screen.getByLabelText('توضیحات (اختیاری)')).toHaveValue('')
      expect(screen.getByLabelText(/حداقل مبلغ سفارش/)).toHaveValue(250_000)

      /* Editing updates every draft field, including the plain text ones. */
      fireEvent.change(screen.getByLabelText('توضیحات (اختیاری)'), { target: { value: 'توضیح' } })
      fireEvent.change(screen.getByLabelText(/اولویت نمایش/), { target: { value: '7' } })

      expect(screen.getByLabelText('توضیحات (اختیاری)')).toHaveValue('توضیح')
      expect(screen.getByLabelText(/اولویت نمایش/)).toHaveValue(7)
      expect(screen.getByText(/0 سفارش مرتبط/)).toBeInTheDocument()
   })

   it('keeps carrier-priced methods out of the edit form', async () => {
      stubFetch(jsonResponse([carrier]))

      render(<ShippingPage />)

      expect(await screen.findByRole('button', { name: 'ویرایش' })).toBeDisabled()
      expect(screen.getByLabelText('کد یکتا (انگلیسی)')).toHaveValue('')
   })
})
