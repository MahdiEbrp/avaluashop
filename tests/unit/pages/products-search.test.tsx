import { render, screen } from '@testing-library/react'

import ProductsPage from '@/app/(store)/(routes)/products/page'
import { prismaMock } from '../support/db'

vi.mock('@/lib/prisma', () => import('../support/db').then((m) => m.prismaModule()))
vi.mock('next/navigation', () => import('../support/navigation'))

describe('storefront product discovery', () => {
   it('searches product title, description, brand and keywords', async () => {
      prismaMock.product.count.mockResolvedValue(1)
      prismaMock.product.findMany.mockResolvedValue([])

      const page = await ProductsPage({
         searchParams: Promise.resolve({ q: 'گردنبند', sort: 'least_expensive' }),
      })
      render(page)

      expect(screen.getByRole('searchbox', { name: 'جستجوی محصولات' })).toHaveValue('گردنبند')
      expect(prismaMock.product.count).toHaveBeenCalledWith({
         where: expect.objectContaining({
            OR: [
               { title: { contains: 'گردنبند', mode: 'insensitive' } },
               { description: { contains: 'گردنبند', mode: 'insensitive' } },
               { brand: { is: { title: { contains: 'گردنبند', mode: 'insensitive' } } } },
               { keywords: { has: 'گردنبند' } },
            ],
         }),
      })
   })

   it('preserves active filters while paging and resets pagination through filtering', async () => {
      prismaMock.product.count.mockResolvedValue(25)
      prismaMock.product.findMany.mockResolvedValue([])

      const page = await ProductsPage({
         searchParams: Promise.resolve({
            q: 'کیف',
            category: 'کیف زنانه',
            isAvailable: 'true',
            page: '2',
         }),
      })
      render(page)

      expect(screen.getByText(/صفحه ۲ از ۳/)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'قبلی' })).toHaveAttribute(
         'href',
         expect.stringContaining('q=%DA%A9%DB%8C%D9%81')
      )
      expect(screen.getByRole('link', { name: 'بعدی' })).toHaveAttribute(
         'href',
         expect.stringContaining('page=3')
      )
      expect(prismaMock.product.findMany).toHaveBeenCalledWith(
         expect.objectContaining({ skip: 12, take: 12 })
      )
   })

   it('disables previous on page 1 and next on the final page', async () => {
      prismaMock.product.count.mockResolvedValue(25)
      prismaMock.product.findMany.mockResolvedValue([])

      const firstPage = await ProductsPage({ searchParams: Promise.resolve({ page: '1' }) })
      const { unmount } = render(firstPage)
      expect(screen.getByText('قبلی')).toHaveAttribute('aria-disabled', 'true')
      expect(screen.getByRole('link', { name: 'بعدی' })).toBeInTheDocument()
      unmount()

      prismaMock.product.count.mockResolvedValue(25)
      prismaMock.product.findMany.mockResolvedValue([])
      const lastPage = await ProductsPage({ searchParams: Promise.resolve({ page: '3' }) })
      render(lastPage)
      expect(screen.getByRole('link', { name: 'قبلی' })).toBeInTheDocument()
      expect(screen.getByText('بعدی')).toHaveAttribute('aria-disabled', 'true')
   })

   it('shows an empty state when there are no matching products', async () => {
      prismaMock.product.count.mockResolvedValue(0)
      prismaMock.product.findMany.mockResolvedValue([])

      render(await ProductsPage({ searchParams: Promise.resolve({ q: 'ناموجود' }) }))

      expect(screen.getByText('محصولی پیدا نشد')).toBeInTheDocument()
      expect(screen.getByText('۰ محصول پیدا شد')).toBeInTheDocument()
   })
})
