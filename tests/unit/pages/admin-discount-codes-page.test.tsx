import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import DiscountCodesPage from '@/app/admin/(dashboard)/codes/page'

const sampleCodes = [
   {
      id: 'c1',
      code: 'WINTER20',
      description: 'تخفیف زمستان',
      percent: 20,
      stock: 15,
      maxDiscountAmount: 500_000,
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-12-01T00:00:00.000Z',
      createdAt: '2026-11-01T00:00:00.000Z',
   },
   {
      id: 'c2',
      code: 'USED10',
      description: null,
      percent: 10,
      stock: 5,
      maxDiscountAmount: 200_000,
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-12-01T00:00:00.000Z',
      createdAt: '2026-11-01T00:00:00.000Z',
      _count: { order: 2 },
   },
]

afterEach(() => {
   vi.unstubAllGlobals()
})

describe('admin discount codes page', () => {
   it('renders the empty state and handles initial load errors', async () => {
      vi.stubGlobal(
         'fetch',
         vi
            .fn()
            .mockResolvedValueOnce(Response.json([], { status: 200 }))
            .mockResolvedValueOnce(new Response('{}', { status: 500 }))
            .mockRejectedValueOnce('network down')
      )

      const { unmount } = render(<DiscountCodesPage />)
      expect(screen.getByText('در حال دریافت...')).toBeInTheDocument()
      await waitFor(() =>
         expect(
            screen.getByText('هنوز کد تخفیفی ثبت نشده است.')
         ).toBeInTheDocument()
      )
      unmount()

      const { unmount: unmount2 } = render(<DiscountCodesPage />)
      await waitFor(() =>
         expect(screen.getByRole('status')).toHaveTextContent(
            'دریافت کدهای تخفیف ناموفق بود.'
         )
      )
      unmount2()

      render(<DiscountCodesPage />)
      await waitFor(() =>
         expect(screen.getByRole('status')).toHaveTextContent(
            'خطای دریافت اطلاعات'
         )
      )
   })

   it('creates a discount code and handles duplicate, invalid, generic, and non-Error create failures', async () => {
      const fetchMock = vi
         .fn()
         .mockResolvedValueOnce(Response.json([], { status: 200 }))
         .mockResolvedValueOnce(Response.json({ id: 'c1' }, { status: 201 }))
         .mockResolvedValueOnce(Response.json(sampleCodes, { status: 200 }))
         .mockResolvedValueOnce(
            Response.json(
               { message: 'DISCOUNT_CODE_ALREADY_EXISTS' },
               { status: 409 }
            )
         )
         .mockResolvedValueOnce(
            Response.json({}, { status: 500 })
         )
         .mockRejectedValueOnce('offline')
      vi.stubGlobal('fetch', fetchMock)

      render(<DiscountCodesPage />)
      await waitFor(() =>
         expect(
            screen.getByText('هنوز کد تخفیفی ثبت نشده است.')
         ).toBeInTheDocument()
      )

      fireEvent.change(screen.getByPlaceholderText('مثلاً WINTER20'), {
         target: { value: 'spring30' },
      })
      fireEvent.change(screen.getByLabelText('درصد تخفیف'), {
         target: { value: '30' },
      })
      fireEvent.change(screen.getByLabelText('تعداد قابل استفاده'), {
         target: { value: '25' },
      })
      fireEvent.change(screen.getByLabelText('حداکثر مبلغ تخفیف (تومان)'), {
         target: { value: '300000' },
      })
      fireEvent.change(screen.getByLabelText('تاریخ شروع'), {
         target: { value: '2026-11-01' },
      })
      fireEvent.change(screen.getByLabelText('تاریخ پایان'), {
         target: { value: '2026-12-01' },
      })
      fireEvent.change(
         screen.getByPlaceholderText('توضیح کوتاه برای تیم فروش'),
         { target: { value: 'بهاره' } }
      )

      fireEvent.submit(
         screen.getByRole('button', { name: 'ثبت کد تخفیف' }).closest('form')
      )

      await waitFor(() =>
         expect(screen.getByText('WINTER20')).toBeInTheDocument()
      )

      // Duplicate error
      fireEvent.change(screen.getByPlaceholderText('مثلاً WINTER20'), {
         target: { value: 'WINTER20' },
      })
      fireEvent.submit(
         screen.getByRole('button', { name: 'ثبت کد تخفیف' }).closest('form')
      )
      await waitFor(() =>
         expect(screen.getByRole('status')).toHaveTextContent(
            'این کد تخفیف قبلاً ثبت شده است.'
         )
      )

      // Generic !response.ok without message
      fireEvent.submit(
         screen.getByRole('button', { name: 'ثبت کد تخفیف' }).closest('form')
      )
      await waitFor(() =>
         expect(screen.getByRole('status')).toHaveTextContent(
            'ثبت کد تخفیف انجام نشد.'
         )
      )

      // Non-Error rejection
      fireEvent.submit(
         screen.getByRole('button', { name: 'ثبت کد تخفیف' }).closest('form')
      )
      await waitFor(() =>
         expect(screen.getByRole('status')).toHaveTextContent(
            'ثبت کد تخفیف ناموفق بود.'
         )
      )

      // Create succeeds, then reload fails (!response.ok in loadCodes)
      fetchMock
         .mockResolvedValueOnce(Response.json({ id: 'c3' }, { status: 201 }))
         .mockResolvedValueOnce(new Response('{}', { status: 500 }))
         .mockResolvedValueOnce(Response.json({ id: 'c4' }, { status: 201 }))
         .mockRejectedValueOnce('reload down')

      fireEvent.submit(
         screen.getByRole('button', { name: 'ثبت کد تخفیف' }).closest('form')
      )
      await waitFor(() =>
         expect(screen.getByRole('status')).toHaveTextContent(
            'دریافت کدهای تخفیف ناموفق بود.'
         )
      )

      fireEvent.submit(
         screen.getByRole('button', { name: 'ثبت کد تخفیف' }).closest('form')
      )
      await waitFor(() =>
         expect(screen.getByRole('status')).toHaveTextContent(
            'خطای دریافت اطلاعات'
         )
      )
   })

   it('updates and deletes discount codes including failure branches', async () => {
      const fetchMock = vi
         .fn()
         .mockResolvedValueOnce(
            Response.json(sampleCodes, { status: 200 })
         )
         // 1. updateCode success -> reload
         .mockResolvedValueOnce(new Response('{}', { status: 200 }))
         .mockResolvedValueOnce(
            Response.json(sampleCodes, { status: 200 })
         )
         // 2. updateCode !response.ok
         .mockResolvedValueOnce(new Response('{}', { status: 500 }))
         // 3. updateCode non-Error rejection
         .mockRejectedValueOnce('save down')
         // 4. deleteCode success -> reload
         .mockResolvedValueOnce(Response.json({ deleted: true }, { status: 200 }))
         .mockResolvedValueOnce(
            Response.json(sampleCodes, { status: 200 })
         )
         // 5. deleteCode DISCOUNT_CODE_IN_USE
         .mockResolvedValueOnce(
            Response.json({ message: 'DISCOUNT_CODE_IN_USE' }, {
               status: 409,
            })
         )
         // 6. deleteCode generic !response.ok
         .mockResolvedValueOnce(new Response('{}', { status: 500 }))
         // 7. deleteCode non-Error rejection
         .mockRejectedValueOnce('delete down')

      vi.stubGlobal('fetch', fetchMock)
      const confirmMock = vi.fn().mockReturnValueOnce(false).mockReturnValue(true)
      vi.stubGlobal('confirm', confirmMock)

      render(<DiscountCodesPage />)
      await waitFor(() =>
         expect(screen.getByText('WINTER20')).toBeInTheDocument()
      )

      fireEvent.change(screen.getByLabelText('درصد WINTER20'), {
         target: { value: '25' },
      })
      fireEvent.change(screen.getByLabelText('موجودی WINTER20'), {
         target: { value: '12' },
      })

      const saveButtons = screen.getAllByRole('button', { name: 'ذخیره' })
      fireEvent.click(saveButtons[0])
      await waitFor(() =>
         expect(screen.getByRole('status')).toHaveTextContent(
            'تغییرات ذخیره شد.'
         )
      )

      fireEvent.click(saveButtons[0])
      await waitFor(() =>
         expect(screen.getByRole('status')).toHaveTextContent(
            'ذخیره تغییرات انجام نشد.'
         )
      )

      fireEvent.click(saveButtons[0])
      await waitFor(() =>
         expect(screen.getByRole('status')).toHaveTextContent('خطا در ذخیره')
      )

      const deleteButtons = screen.getAllByRole('button', { name: 'حذف' })
      // Cancel confirm
      fireEvent.click(deleteButtons[0])
      expect(confirmMock).toHaveBeenCalledTimes(1)

      // Confirm -> success
      fireEvent.click(deleteButtons[0])
      await waitFor(() =>
         expect(screen.getByRole('status')).toHaveTextContent(
            'کد تخفیف حذف شد.'
         )
      )

      // Confirm -> DISCOUNT_CODE_IN_USE
      fireEvent.click(deleteButtons[0])
      await waitFor(() =>
         expect(screen.getByRole('status')).toHaveTextContent(
            'این کد در سفارش ثبت شده و برای حفظ سوابق قابل حذف نیست.'
         )
      )

      // Confirm -> generic !response.ok
      fireEvent.click(deleteButtons[0])
      await waitFor(() =>
         expect(screen.getByRole('status')).toHaveTextContent(
            'حذف کد تخفیف انجام نشد.'
         )
      )

      // Confirm -> non-Error rejection
      fireEvent.click(deleteButtons[0])
      await waitFor(() =>
         expect(screen.getByRole('status')).toHaveTextContent('خطا در حذف')
      )
   })
})
