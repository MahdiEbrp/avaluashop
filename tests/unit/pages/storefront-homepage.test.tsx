import { render, screen } from '@testing-library/react'

import HomePage from '@/app/(store)/(routes)/page'
import { prismaMock } from '../support/db'

vi.mock('@/lib/prisma', () => import('../support/db').then((m) => m.prismaModule()))

describe('storefront homepage discovery', () => {
   it('loads available featured products, relevant categories and published banners', async () => {
      prismaMock.product.findMany.mockResolvedValue([])
      prismaMock.category.findMany.mockResolvedValue([
         { id: 'category-1', title: 'زیورآلات', _count: { products: 3 } },
      ])
      prismaMock.banner.findMany.mockResolvedValue([])

      render(await HomePage())

      expect(screen.getByRole('heading', { name: 'جزئیات کوچک، زیبایی ماندگار' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /زیورآلات/ })).toHaveAttribute(
         'href',
         '/products?category=%D8%B2%DB%8C%D9%88%D8%B1%D8%A7%D9%84%D8%A7%D8%AA'
      )
      expect(prismaMock.product.findMany).toHaveBeenCalledWith(
         expect.objectContaining({
            where: expect.objectContaining({ isAvailable: true }),
            take: 8,
         })
      )
      expect(prismaMock.banner.findMany).toHaveBeenCalledWith(
         expect.objectContaining({
            where: { categories: { some: { title: { in: expect.any(Array) } } } },
            take: 3,
         })
      )
   })

   it('keeps the homepage useful when no products or category shortcuts exist', async () => {
      prismaMock.product.findMany.mockResolvedValue([])
      prismaMock.category.findMany.mockResolvedValue([])
      prismaMock.banner.findMany.mockResolvedValue([])

      render(await HomePage())

      expect(screen.getByText('مجموعه آوالونا شاپ در حال تکمیل است')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'مشاهده فروشگاه' })).toHaveAttribute('href', '/products')
   })
})
