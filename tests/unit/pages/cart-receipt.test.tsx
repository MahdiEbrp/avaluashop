import { render, screen } from '@testing-library/react'

import { Receipt } from '@/app/(store)/(routes)/cart/components/receipt'

vi.mock('@/state/Cart', () => ({
   useCartContext: () => ({
      loading: false,
      cart: {
         items: [
            { productId: 'p1', count: 2, product: { price: 100000, discount: 10000 } },
         ],
      },
   }),
}))
vi.mock('@/hooks/useAuthentication', () => ({
   useAuthenticated: () => ({ authenticated: true }),
}))

describe('cart receipt', () => {
   it('shows product subtotal and discount without guessing tax or shipping', () => {
      render(<Receipt />)

      expect(screen.getByText('جمع کالاها')).toBeInTheDocument()
      expect(screen.getByText('۲۰۰٬۰۰۰ تومان')).toBeInTheDocument()
      expect(screen.getByText('۲۰٬۰۰۰ تومان')).toBeInTheDocument()
      expect(screen.getByText('هزینه ارسال، مالیات و تخفیف کدها در مرحله پرداخت بر اساس نشانی و تنظیمات فعلی فروشگاه محاسبه می‌شوند.')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'ادامه و انتخاب روش ارسال' })).toHaveAttribute('href', '/checkout')
   })
})
