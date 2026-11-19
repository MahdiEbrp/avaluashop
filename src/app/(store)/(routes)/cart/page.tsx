'use client'

import { Heading } from '@/components/native/heading'
import { CartContextProvider } from '@/state/Cart'

import { CartGrid } from './components/grid'

export default function Cart() {
   return (
      <div dir="rtl">
         <CartContextProvider>
            <Heading
               title="سبد خرید"
               description="محصولاتی که برای خرید انتخاب کرده‌اید."
            />
            <CartGrid />
         </CartContextProvider>
      </div>
   )
}
