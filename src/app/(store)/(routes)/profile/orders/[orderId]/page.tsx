'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Loader } from '@/components/ui/loader'
import { useAuthenticated } from '@/hooks/useAuthentication'
import { usePathname } from 'next/navigation'
import { use, useEffect, useState } from 'react'

import { UserCombobox } from '../../components/switcher'

/* The API returns the raw enum; the customer reads Persian. */
const STATUS_LABELS: Record<string, string> = {
   Processing: 'در حال پردازش',
   Shipped: 'ارسال شده',
   Delivered: 'تحویل شده',
   ReturnProcessing: 'در حال پردازش مرجوعی',
   ReturnCompleted: 'مرجوعی انجام شده',
   Cancelled: 'لغو شده',
   RefundProcessing: 'در حال پردازش بازگشت وجه',
   RefundCompleted: 'بازگشت وجه انجام شده',
   Denied: 'رد شده',
}

interface OrderTrackingView {
   id: string
   status: string
   shippingTrackingNumber: string | null
   shippingCarrierName: string | null
   shippingMethodName: string | null
}

const ProductPage = ({ params }: { params: Promise<{ orderId: string }> }) => {
   const { orderId } = use(params)
   const { authenticated } = useAuthenticated()
   const [order, setOrder] = useState<OrderTrackingView | null>(null)
   const pathname = usePathname()

   useEffect(() => {
      async function getOrder() {
         try {
            const response = await fetch(`/api/orders/${orderId}`, {
               method: 'GET',
               cache: 'no-store',
            })

            const json = await response.json()
            setOrder(json)
         } catch (error) {
            console.error({ error })
         }
      }

      if (authenticated) void getOrder()
   }, [authenticated, orderId])

   function EditOrderCard() {
      return (
         <Card className="my-4 p-2">
            <CardContent>
               {order ? (
                  <div className="space-y-3">
                     <div>شماره سفارش: {order.id}</div>
                     <div>وضعیت سفارش: {STATUS_LABELS[order.status] ?? order.status}</div>
                     <div>روش ارسال: {order.shippingMethodName ?? '—'}</div>
                     <div>شرکت حمل‌ونقل: {order.shippingCarrierName ?? '—'}</div>
                     <div className="rounded-md border p-3">
                        <div className="font-medium">کد رهگیری مرسوله</div>
                        {order.shippingTrackingNumber ? (
                           <div dir="ltr" className="mt-1 select-all font-mono">{order.shippingTrackingNumber}</div>
                        ) : (
                           <p className="mt-1 text-sm text-muted-foreground">کد رهگیری هنوز ثبت نشده است.</p>
                        )}
                     </div>
                  </div>
               ) : (
                  <div className="h-[20vh]">
                     <div className="h-full my-4 flex items-center justify-center">
                        <Loader />
                     </div>
                  </div>
               )}
            </CardContent>
         </Card>
      )
   }

   return (
      <div className="flex-col">
         <div className="flex-1">
            <div className="flex items-center justify-between">
               <div className="flex items-center justify-between">
                  <UserCombobox initialValue={pathname} />
               </div>
            </div>
            {EditOrderCard()}
         </div>
      </div>
   )
}

export default ProductPage
