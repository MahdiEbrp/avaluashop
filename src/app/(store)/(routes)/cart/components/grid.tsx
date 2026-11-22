'use client'

import { Card, CardContent } from '@/components/ui/card'
import { isVariableValid } from '@/lib/utils'
import { useCartContext } from '@/state/Cart'
import Link from 'next/link'

import { Item } from './item'
import { Receipt } from './receipt'
import { Skeleton } from './skeleton'

export const CartGrid = () => {
   const { cart, loading } = useCartContext()

   if (loading || !isVariableValid(cart?.items)) {
      return (
         <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3" dir="rtl">
            <div className="space-y-3 md:col-span-2">
               {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} />)}
            </div>
            <Receipt />
         </div>
      )
   }

   if (cart.items.length === 0) {
      return (
         <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3" dir="rtl">
            <div className="md:col-span-2">
               <Card className="flex min-h-64 items-center justify-center text-center">
                  <CardContent className="pt-6">
                     <p className="text-lg font-semibold">سبد خرید شما خالی است.</p>
                     <p className="mt-2 text-sm text-muted-foreground">برای شروع، محصولات موردعلاقه‌تان را از فروشگاه انتخاب کنید.</p>
                     <Link href="/products" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
                        مشاهده محصولات
                     </Link>
                  </CardContent>
               </Card>
            </div>
            <Receipt />
         </div>
      )
   }

   return (
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3" dir="rtl">
         <div className="space-y-3 md:col-span-2">
            {cart.items.map((cartItem) => (
               <Item cartItem={cartItem} key={cartItem.productId} />
            ))}
         </div>
         <Receipt />
      </div>
   )
}
