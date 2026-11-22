'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Loader } from '@/components/ui/loader'
import { useAuthenticated } from '@/hooks/useAuthentication'
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/order-status'
import {
   CheckCircle2Icon,
   CircleIcon,
   PackageCheckIcon,
   TruckIcon,
} from 'lucide-react'
import Link from 'next/link'
import { use, useEffect, useState } from 'react'

import { UserCombobox } from '../../components/switcher'

interface OrderLineItem {
   count: number
   price: number
   discount: number
   product: { title: string }
}

interface OrderTrackingView {
   id: string
   number?: number
   status: string
   isPaid?: boolean
   payable?: number
   shipping?: number
   createdAt?: string
   shippingTrackingNumber: string | null
   shippingCarrierName: string | null
   shippingMethodName: string | null
   orderItems?: OrderLineItem[]
}

const money = new Intl.NumberFormat('fa-IR')
const toman = (value: number) => `${money.format(Math.round(value))} تومان`

const fulfilmentSteps = [
   { status: 'Processing', label: 'در حال آماده‌سازی', icon: PackageCheckIcon },
   { status: 'Shipped', label: 'تحویل به شرکت ارسال', icon: TruckIcon },
   { status: 'Delivered', label: 'تحویل سفارش', icon: CheckCircle2Icon },
]

const ProductPage = ({ params }: { params: Promise<{ orderId: string }> }) => {
   const { orderId } = use(params)
   const { authenticated } = useAuthenticated()
   const [order, setOrder] = useState<OrderTrackingView | null>(null)
   const [loading, setLoading] = useState(true)

   useEffect(() => {
      async function getOrder() {
         try {
            setLoading(true)
            const response = await fetch(
               `/api/orders/${encodeURIComponent(orderId)}`,
               {
                  method: 'GET',
                  cache: 'no-store',
               }
            )
            setOrder(await response.json())
         } catch (error) {
            console.error({ error })
         } finally {
            setLoading(false)
         }
      }

      if (authenticated) void getOrder()
   }, [authenticated, orderId])

   const currentStep = fulfilmentSteps.findIndex(
      (step) => step.status === order?.status
   )
   const items = order?.orderItems ?? []

   function renderOrderBody() {
      if (!authenticated) {
         return (
            <Card>
               <CardContent className="py-10 text-center">
                  <p className="font-semibold">
                     برای مشاهده جزئیات سفارش وارد حساب خود شوید.
                  </p>
                  <Button asChild className="mt-4">
                     <Link href="/login">ورود به حساب</Link>
                  </Button>
               </CardContent>
            </Card>
         )
      }
      if (loading || !order) {
         return (
            <Card>
               <CardContent className="flex min-h-48 items-center justify-center">
                  <Loader />
               </CardContent>
            </Card>
         )
      }
      return (
         <div className="space-y-4">
            <Card>
               <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                  <div>
                     <h1 className="text-lg font-bold">
                        شماره سفارش: {order.id}
                     </h1>
                     {order.createdAt ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                           ثبت‌شده در{' '}
                           {new Intl.DateTimeFormat('fa-IR', {
                              dateStyle: 'medium',
                           }).format(new Date(order.createdAt))}
                        </p>
                     ) : null}
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                     وضعیت سفارش:{' '}
                     {ORDER_STATUS_LABELS[order.status as OrderStatus] ??
                        order.status}
                  </span>
               </CardHeader>
               <CardContent>
                  <div className="grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
                     <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">
                           وضعیت پرداخت
                        </span>
                        <strong>
                           {order.isPaid
                              ? 'پرداخت تأیید شده'
                              : 'پرداخت تأیید نشده'}
                        </strong>
                     </div>
                     <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">مبلغ نهایی</span>
                        <strong>{toman(order.payable ?? 0)}</strong>
                     </div>
                     <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">هزینه ارسال</span>
                        <span>{toman(order.shipping ?? 0)}</span>
                     </div>
                  </div>
               </CardContent>
            </Card>

            {currentStep === -1 ? null : (
               <Card>
                  <CardHeader>
                     <h2 className="font-bold">مراحل آماده‌سازی و ارسال</h2>
                  </CardHeader>
                  <CardContent>
                     <ol className="grid gap-4 sm:grid-cols-3">
                        {fulfilmentSteps.map((step, index) => {
                           const complete = currentStep >= index
                           const StepIcon = step.icon
                           return (
                              <li
                                 key={step.status}
                                 className="flex items-center gap-3"
                              >
                                 {complete ? (
                                    <CheckCircle2Icon className="h-6 w-6 text-success" />
                                 ) : (
                                    <CircleIcon className="h-6 w-6 text-muted-foreground/40" />
                                 )}
                                 <span
                                    className={
                                       complete
                                          ? 'text-sm font-semibold text-foreground'
                                          : 'text-sm text-muted-foreground'
                                    }
                                 >
                                    {step.label}
                                 </span>
                                 <StepIcon className="ms-auto hidden h-4 w-4 text-muted-foreground sm:block" />
                              </li>
                           )
                        })}
                     </ol>
                  </CardContent>
               </Card>
            )}

            <Card>
               <CardHeader>
                  <h2 className="font-bold">اطلاعات ارسال</h2>
               </CardHeader>
               <CardContent>
                  <div className="space-y-3 text-sm">
                     <div>روش ارسال: {order.shippingMethodName ?? '—'}</div>
                     <div>شرکت حمل‌ونقل: {order.shippingCarrierName ?? '—'}</div>
                     <div className="rounded-xl border border-border bg-muted/40 p-4">
                        <span className="font-semibold">کد رهگیری مرسوله</span>
                        {order.shippingTrackingNumber ? (
                           <p
                              dir="ltr"
                              className="mt-3 select-all break-all text-left font-mono text-base"
                           >
                              {order.shippingTrackingNumber}
                           </p>
                        ) : (
                           <p className="mt-2 text-xs leading-6 text-muted-foreground">
                              کد رهگیری هنوز ثبت نشده است.
                           </p>
                        )}
                     </div>
                  </div>
               </CardContent>
            </Card>

            <Card>
               <CardHeader>
                  <h2 className="font-bold">اقلام سفارش</h2>
               </CardHeader>
               <CardContent className="space-y-3">
                  {items.map((item, index) => (
                     <div
                        key={`${item.product.title}-${index}`}
                        className="flex items-center justify-between gap-3 border-b border-border/60 pb-3 text-sm last:border-0 last:pb-0"
                     >
                        <span>
                           {item.product.title}{' '}
                           <span className="text-muted-foreground">
                              × {money.format(item.count)}
                           </span>
                        </span>
                        <strong className="whitespace-nowrap">
                           {toman(item.count * (item.price - item.discount))}
                        </strong>
                     </div>
                  ))}
               </CardContent>
            </Card>
         </div>
      )
   }

   return (
      <div dir="rtl" className="pb-8">
         <div className="mb-4 flex items-center justify-between">
            <UserCombobox initialValue="/profile/orders" />
            <Link
               href="/profile/orders"
               className="text-sm text-primary hover:underline"
            >
               بازگشت به سفارش‌ها
            </Link>
         </div>
         {renderOrderBody()}
      </div>
   )
}

export default ProductPage
