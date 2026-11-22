'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'
import { useAuthenticated } from '@/hooks/useAuthentication'
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/order-status'
import { CheckCircle2Icon, CircleIcon, CopyIcon, PackageCheckIcon, TruckIcon } from 'lucide-react'
import Link from 'next/link'
import { use, useEffect, useState } from 'react'

import { UserCombobox } from '../../components/switcher'

interface OrderTrackingView {
   id: string
   number: number
   status: string
   isPaid: boolean
   payable: number
   shipping: number
   createdAt: string
   shippingTrackingNumber: string | null
   shippingCarrierName: string | null
   shippingMethodName: string | null
   orderItems: Array<{
      count: number
      price: number
      discount: number
      product: { title: string }
   }>
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
   const [error, setError] = useState('')
   const [copied, setCopied] = useState(false)

   useEffect(() => {
      if (!authenticated) {
         setLoading(false)
         return
      }

      const controller = new AbortController()
      async function getOrder() {
         try {
            setLoading(true)
            setError('')
            const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
               method: 'GET',
               cache: 'no-store',
               signal: controller.signal,
            })
            if (!response.ok) {
               if (response.status === 404) throw new Error('سفارش پیدا نشد یا به حساب شما تعلق ندارد.')
               throw new Error('دریافت اطلاعات سفارش انجام نشد.')
            }
            setOrder(await response.json())
         } catch (error_) {
            if (!controller.signal.aborted) {
               setError(error_ instanceof Error ? error_.message : 'خطا در دریافت سفارش')
            }
         } finally {
            if (!controller.signal.aborted) setLoading(false)
         }
      }

      void getOrder()
      return () => controller.abort()
   }, [authenticated, orderId])

   const currentStep = fulfilmentSteps.findIndex((step) => step.status === order?.status)

   async function copyTrackingNumber() {
      if (!order?.shippingTrackingNumber || !globalThis.navigator?.clipboard) return
      try {
         await globalThis.navigator.clipboard.writeText(order.shippingTrackingNumber)
         setCopied(true)
      } catch {
         setCopied(false)
      }
   }

   return (
      <div dir="rtl" className="pb-8">
         <div className="mb-4 flex items-center justify-between">
            <UserCombobox initialValue="/profile/orders" />
            <Link href="/profile/orders" className="text-sm text-primary hover:underline">بازگشت به سفارش‌ها</Link>
         </div>

         {!authenticated ? (
            <Card>
               <CardContent className="py-10 text-center">
                  <p className="font-semibold">برای مشاهده جزئیات سفارش وارد حساب خود شوید.</p>
                  <Button asChild className="mt-4"><Link href="/login">ورود به حساب</Link></Button>
               </CardContent>
            </Card>
         ) : loading ? (
            <Card>
               <CardContent className="flex min-h-48 items-center justify-center">
                  <Loader />
               </CardContent>
            </Card>
         ) : error ? (
            <Card>
               <CardContent className="py-10 text-center">
                  <p role="alert" className="text-sm text-destructive">{error}</p>
                  <Button asChild variant="outline" className="mt-4"><Link href="/profile/orders">رفتن به فهرست سفارش‌ها</Link></Button>
               </CardContent>
            </Card>
         ) : order ? (
            <div className="space-y-4">
               <Card>
                  <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                     <div>
                        <h1 className="text-lg font-bold">سفارش شماره {money.format(order.number)}</h1>
                        <p className="mt-1 text-xs text-muted-foreground">
                           ثبت‌شده در {new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(order.createdAt))}
                        </p>
                     </div>
                     <span className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                        {ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status}
                     </span>
                  </CardHeader>
                  <CardContent className="grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
                     <div className="flex justify-between gap-3"><span className="text-muted-foreground">وضعیت پرداخت</span><strong>{order.isPaid ? 'پرداخت تأیید شده' : 'پرداخت تأیید نشده'}</strong></div>
                     <div className="flex justify-between gap-3"><span className="text-muted-foreground">مبلغ نهایی</span><strong>{toman(order.payable)}</strong></div>
                     <div className="flex justify-between gap-3"><span className="text-muted-foreground">هزینه ارسال</span><span>{toman(order.shipping)}</span></div>
                  </CardContent>
               </Card>

               {currentStep >= 0 ? (
                  <Card>
                     <CardHeader><h2 className="font-bold">مراحل آماده‌سازی و ارسال</h2></CardHeader>
                     <CardContent>
                        <ol className="grid gap-4 sm:grid-cols-3">
                           {fulfilmentSteps.map((step, index) => {
                              const complete = currentStep >= index
                              const StepIcon = step.icon
                              return (
                                 <li key={step.status} className="flex items-center gap-3">
                                    {complete ? <CheckCircle2Icon className="h-6 w-6 text-success" /> : <CircleIcon className="h-6 w-6 text-muted-foreground/40" />}
                                    <span className={complete ? 'text-sm font-semibold text-foreground' : 'text-sm text-muted-foreground'}>{step.label}</span>
                                    <StepIcon className="ms-auto hidden h-4 w-4 text-muted-foreground sm:block" />
                                 </li>
                              )
                           })}
                        </ol>
                     </CardContent>
                  </Card>
               ) : null}

               <Card>
                  <CardHeader><h2 className="font-bold">اطلاعات ارسال</h2></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                     <div className="flex justify-between gap-3"><span className="text-muted-foreground">روش ارسال</span><span>{order.shippingMethodName ?? '—'}</span></div>
                     <div className="flex justify-between gap-3"><span className="text-muted-foreground">شرکت حمل‌ونقل</span><span>{order.shippingCarrierName ?? '—'}</span></div>
                     <div className="rounded-xl border border-border bg-muted/40 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                           <span className="font-semibold">کد رهگیری مرسوله</span>
                           {order.shippingTrackingNumber ? (
                              <Button type="button" variant="outline" size="sm" onClick={() => void copyTrackingNumber()}>
                                 <CopyIcon className="me-2 h-4 w-4" />
                                 {copied ? 'کپی شد' : 'کپی کد'}
                              </Button>
                           ) : null}
                        </div>
                        {order.shippingTrackingNumber ? (
                           <p dir="ltr" className="mt-3 select-all break-all text-left font-mono text-base">{order.shippingTrackingNumber}</p>
                        ) : (
                           <p className="mt-2 text-xs leading-6 text-muted-foreground">کد رهگیری پس از ثبت اطلاعات ارسال توسط فروشگاه در این قسمت نمایش داده می‌شود.</p>
                        )}
                     </div>
                  </CardContent>
               </Card>

               <Card>
                  <CardHeader><h2 className="font-bold">اقلام سفارش</h2></CardHeader>
                  <CardContent className="space-y-3">
                     {order.orderItems.map((item, index) => (
                        <div key={`${item.product.title}-${index}`} className="flex items-center justify-between gap-3 border-b border-border/60 pb-3 text-sm last:border-0 last:pb-0">
                           <span>{item.product.title} <span className="text-muted-foreground">× {money.format(item.count)}</span></span>
                           <strong className="whitespace-nowrap">{toman(item.count * (item.price - item.discount))}</strong>
                        </div>
                     ))}
                  </CardContent>
               </Card>
            </div>
         ) : null}
      </div>
   )
}

export default ProductPage
