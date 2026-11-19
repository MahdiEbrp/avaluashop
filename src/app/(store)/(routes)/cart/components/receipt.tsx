'use client'

import { Separator } from '@/components/native/separator'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { useAuthenticated } from '@/hooks/useAuthentication'
import { isVariableValid } from '@/lib/utils'
import { useCartContext } from '@/state/Cart'
import Link from 'next/link'

const toman = new Intl.NumberFormat('fa-IR')
const formatPrice = (value: string) => `${toman.format(Number(value))} تومان`

export function Receipt() {
   const { authenticated } = useAuthenticated()
   const { loading, cart } = useCartContext()

   function calculatePayableCost() {
      let totalAmount = 0
      let discountAmount = 0

      if (isVariableValid(cart?.items)) {
         for (const item of cart?.items) {
            totalAmount += item?.count * item?.product?.price
            discountAmount += item?.count * item?.product?.discount
         }
      }

      const afterDiscountAmount = totalAmount - discountAmount
      const taxAmount = afterDiscountAmount * 0.09
      const payableAmount = afterDiscountAmount + taxAmount

      return {
         totalAmount: totalAmount.toFixed(0),
         discountAmount: discountAmount.toFixed(0),
         taxAmount: taxAmount.toFixed(0),
         payableAmount: payableAmount.toFixed(0),
      }
   }

   const totals = calculatePayableCost()

   return (
      <Card variant={loading ? 'loading' : 'default'} dir="rtl">
         <CardHeader className="p-4 pb-0">
            <h2 className="font-bold tracking-tight">خلاصه سفارش</h2>
         </CardHeader>
         <CardContent className="p-4">
            <div className="space-y-3 text-sm">
               <div className="flex justify-between gap-3">
                  <p>جمع کالاها</p>
                  <h3>{formatPrice(totals.totalAmount)}</h3>
               </div>
               <div className="flex justify-between gap-3">
                  <p>تخفیف</p>
                  <h3>{formatPrice(totals.discountAmount)}</h3>
               </div>
               <div className="flex justify-between gap-3">
                  <p>مالیات</p>
                  <h3>{formatPrice(totals.taxAmount)}</h3>
               </div>
            </div>
            <Separator className="my-4" />
            <div className="flex justify-between gap-3 text-sm font-bold">
               <p>مبلغ قابل پرداخت</p>
               <h3>{formatPrice(totals.payableAmount)}</h3>
            </div>
         </CardContent>
         <Separator />
         <CardFooter>
            <Link href={authenticated ? '/checkout' : '/login'} className="w-full">
               <Button
                  disabled={!isVariableValid(cart?.items) || cart.items.length === 0}
                  className="w-full"
               >
                  ادامه فرایند خرید
               </Button>
            </Link>
         </CardFooter>
      </Card>
   )
}
