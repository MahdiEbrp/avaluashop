'use client'

import { Separator } from '@/components/native/separator'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { useAuthenticated } from '@/hooks/useAuthentication'
import { isVariableValid } from '@/lib/utils'
import { useCartContext } from '@/state/Cart'
import Link from 'next/link'

interface ReceiptCartItem {
   count: number
   product: {
      price: number
      discount: number
   }
}

const toman = new Intl.NumberFormat('fa-IR')
const formatPrice = (value: number) => `${toman.format(Math.round(value))} تومان`

export function Receipt() {
   const { authenticated } = useAuthenticated()
   const { loading, cart } = useCartContext()
   const items: ReceiptCartItem[] = isVariableValid(cart?.items)
      ? (cart.items as ReceiptCartItem[])
      : []

   const subtotal = items.reduce(
      (total, item) => total + item.count * item.product.price,
      0
   )
   const productDiscount = items.reduce(
      (total, item) => total + item.count * item.product.discount,
      0
   )
   const payableBeforeShippingAndTax = Math.max(0, subtotal - productDiscount)
   const hasItems = items.length > 0

   return (
      <Card variant={loading ? 'loading' : 'default'} dir="rtl">
         <CardHeader className="p-4 pb-0">
            <h2 className="font-bold tracking-tight">خلاصه سبد خرید</h2>
         </CardHeader>
         <CardContent className="p-4">
            <div className="space-y-3 text-sm">
               <div className="flex justify-between gap-3">
                  <p>جمع کالاها</p>
                  <span>{formatPrice(subtotal)}</span>
               </div>
               <div className="flex justify-between gap-3">
                  <p>تخفیف محصولات</p>
                  <span className="text-success">{formatPrice(productDiscount)}</span>
               </div>
            </div>
            <Separator className="my-4" />
            <div className="flex justify-between gap-3 text-sm font-bold">
               <p>جمع کالاها پس از تخفیف</p>
               <span>{formatPrice(payableBeforeShippingAndTax)}</span>
            </div>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
               هزینه ارسال، مالیات و تخفیف کدها در مرحله پرداخت بر اساس نشانی و تنظیمات فعلی فروشگاه محاسبه می‌شوند.
            </p>
         </CardContent>
         <Separator />
         <CardFooter className="p-4">
            <Link href={authenticated ? '/checkout' : '/login'} className="w-full">
               <Button disabled={loading || !hasItems} className="w-full">
                  {authenticated ? 'ادامه و انتخاب روش ارسال' : 'ورود برای ادامه خرید'}
               </Button>
            </Link>
         </CardFooter>
      </Card>
   )
}
