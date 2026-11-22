import { render, screen } from '@testing-library/react'

import { DataSection } from '@/app/(store)/(routes)/products/[productId]/components/data'
import type { ProductWithIncludes } from '@/types/prisma'

vi.mock('@/app/(store)/(routes)/products/[productId]/components/cart_button', () => ({
   default: () => <button type="button">افزودن به سبد خرید</button>,
}))
vi.mock('@/app/(store)/(routes)/products/[productId]/components/wishlist_button', () => ({
   default: () => <button type="button">علاقه‌مندی‌ها</button>,
}))

const product = {
   id: 'product-1',
   title: 'گردنبند ظریف',
   description: 'طراحی مینیمال',
   images: [],
   keywords: [],
   price: 500000,
   discount: 50000,
   stock: 4,
   isAvailable: true,
   brand: { id: 'brand-1', title: 'آوالونا' },
   categories: [{ id: 'category-1', title: 'زیورآلات' }],
} as unknown as ProductWithIncludes

describe('product detail information', () => {
   it('shows product identity, category, discount and purchase actions', () => {
      render(<DataSection product={product} />)

      expect(screen.getByRole('heading', { name: 'گردنبند ظریف' })).toBeInTheDocument()
      expect(screen.getByText('آوالونا')).toBeInTheDocument()
      expect(screen.getByText('زیورآلات')).toBeInTheDocument()
      expect(screen.getByText('۱۰٪ تخفیف')).toBeInTheDocument()
      expect(screen.getByText('۴۵۰٬۰۰۰ تومان')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'افزودن به سبد خرید' })).toBeInTheDocument()
   })

   it('does not show the add-to-cart action for unavailable products', () => {
      render(<DataSection product={{ ...product, isAvailable: false }} />)

      expect(screen.getByText('فعلاً ناموجود')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'افزودن به سبد خرید' })).not.toBeInTheDocument()
   })
})
