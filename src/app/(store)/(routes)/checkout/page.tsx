'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCartContext } from '@/state/Cart'
import { useUserContext } from '@/state/User'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useMemo, useState } from 'react'

type Address = {
   id: string
   address: string
   city: string
   phone: string
   postalCode: string
}

const money = new Intl.NumberFormat('fa-IR')
const toman = (value: number) => `${money.format(Math.round(value))} تومان`

export default function CheckoutPage() {
   const router = useRouter()
   const { user, loading: userLoading } = useUserContext()
   const { cart, loading: cartLoading } = useCartContext()
   const [addresses, setAddresses] = useState<Address[]>([])
   const [selectedAddress, setSelectedAddress] = useState('')
   const [loadingAddresses, setLoadingAddresses] = useState(true)
   const [savingAddress, setSavingAddress] = useState(false)
   const [submitting, setSubmitting] = useState(false)
   const [error, setError] = useState('')
   const [success, setSuccess] = useState('')
   const [showAddressForm, setShowAddressForm] = useState(false)
   const [form, setForm] = useState({
      city: '',
      address: '',
      phone: '',
      postalCode: '',
   })

   useEffect(() => {
      if (!user) {
         setLoadingAddresses(false)
         return
      }

      let cancelled = false
      fetch('/api/addresses', { cache: 'no-store' })
         .then(async (response) => {
            if (!response.ok) throw new Error('دریافت نشانی‌ها انجام نشد.')
            return response.json()
         })
         .then((items: Address[]) => {
            if (cancelled) return
            setAddresses(items)
            if (items.length) setSelectedAddress(items[0].id)
         })
         .catch((reason) => {
            if (!cancelled) setError(reason.message || 'خطا در دریافت نشانی‌ها')
         })
         .finally(() => {
            if (!cancelled) setLoadingAddresses(false)
         })

      return () => {
         cancelled = true
      }
   }, [user])

   const totals = useMemo(() => {
      const items = cart?.items ?? []
      const subtotal = items.reduce(
         (sum, item) => sum + item.count * item.product.price,
         0
      )
      const productDiscount = items.reduce(
         (sum, item) => sum + item.count * item.product.discount,
         0
      )
      const afterDiscount = Math.max(0, subtotal - productDiscount)
      const tax = afterDiscount * 0.09
      return {
         subtotal,
         productDiscount,
         tax,
         payable: afterDiscount + tax,
      }
   }, [cart])

   async function saveAddress(event: FormEvent<HTMLFormElement>) {
      event.preventDefault()
      setSavingAddress(true)
      setError('')

      try {
         const response = await fetch('/api/addresses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
         })
         if (!response.ok) throw new Error('ذخیره نشانی انجام نشد. اطلاعات را بررسی کنید.')
         const address = (await response.json()) as Address
         setAddresses((current) => [...current, address])
         setSelectedAddress(address.id)
         setShowAddressForm(false)
         setForm({ city: '', address: '', phone: '', postalCode: '' })
      } catch (reason) {
         setError(reason instanceof Error ? reason.message : 'خطا در ذخیره نشانی')
      } finally {
         setSavingAddress(false)
      }
   }

   async function submitOrder() {
      if (!selectedAddress) {
         setError('ابتدا یک نشانی ارسال انتخاب کنید.')
         return
      }

      setSubmitting(true)
      setError('')
      setSuccess('')

      try {
         const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addressId: selectedAddress }),
         })
         if (!response.ok) {
            const message = await response.text()
            throw new Error(
               response.status === 409
                  ? 'موجودی یکی از محصولات تغییر کرده است. سبد خرید را بررسی کنید.'
                  : message || 'ثبت سفارش انجام نشد.'
            )
         }
         const order = await response.json()
         setSuccess(`سفارش شماره ${money.format(order.number)} ثبت شد.`)
      } catch (reason) {
         setError(reason instanceof Error ? reason.message : 'خطا در ثبت سفارش')
      } finally {
         setSubmitting(false)
      }
   }

   if (userLoading || cartLoading || loadingAddresses) {
      return <div className="container mx-auto p-6 text-center" dir="rtl">در حال بارگذاری اطلاعات خرید...</div>
   }

   if (!user) {
      return (
         <div className="container mx-auto max-w-2xl p-6" dir="rtl">
            <Card>
               <CardContent className="space-y-4 p-6 text-center">
                  <h1 className="text-xl font-bold">برای ادامه خرید وارد حساب کاربری شوید</h1>
                  <Link href="/login"><Button className="w-full">ورود به حساب کاربری</Button></Link>
               </CardContent>
            </Card>
         </div>
      )
   }

   if (success) {
      return (
         <div className="container mx-auto max-w-2xl p-6" dir="rtl">
            <Card>
               <CardContent className="space-y-4 p-6 text-center">
                  <h1 className="text-2xl font-bold text-primary">سفارش شما ثبت شد</h1>
                  <p>{success}</p>
                  <p className="text-sm text-muted-foreground">این مرحله ثبت سفارش است؛ پرداخت آنلاین تا زمان اتصال و تأیید درگاه پرداخت فعال نیست.</p>
                  <Link href="/"><Button className="w-full">بازگشت به فروشگاه</Button></Link>
               </CardContent>
            </Card>
         </div>
      )
   }

   if (!cart?.items?.length) {
      return (
         <div className="container mx-auto max-w-2xl p-6" dir="rtl">
            <Card><CardContent className="space-y-4 p-6 text-center">
               <h1 className="text-xl font-bold">سبد خرید شما خالی است</h1>
               <Link href="/products"><Button>مشاهده محصولات</Button></Link>
            </CardContent></Card>
         </div>
      )
   }

   return (
      <div className="container mx-auto max-w-5xl space-y-5 p-4 py-8" dir="rtl">
         <header className="space-y-1">
            <h1 className="text-2xl font-bold">تکمیل اطلاعات سفارش</h1>
            <p className="text-sm text-muted-foreground">نشانی تحویل را انتخاب کنید و جزئیات سفارش را پیش از ثبت بررسی کنید.</p>
         </header>

         {error && <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">{error}</div>}

         <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
            <Card>
               <CardHeader><h2 className="font-bold">نشانی تحویل سفارش</h2></CardHeader>
               <CardContent className="space-y-4">
                  {addresses.length > 0 ? (
                     <div className="space-y-3">
                        {addresses.map((address) => (
                           <label key={address.id} className="flex cursor-pointer gap-3 rounded-lg border p-3">
                              <input
                                 type="radio"
                                 name="shipping-address"
                                 value={address.id}
                                 checked={selectedAddress === address.id}
                                 onChange={() => setSelectedAddress(address.id)}
                                 className="mt-1"
                              />
                              <span className="space-y-1 text-sm">
                                 <span className="block font-semibold">{address.city}</span>
                                 <span className="block">{address.address}</span>
                                 <span className="block text-muted-foreground">کد پستی: {address.postalCode} · {address.phone}</span>
                              </span>
                           </label>
                        ))}
                     </div>
                  ) : <p className="text-sm text-muted-foreground">هنوز نشانی‌ای ثبت نکرده‌اید.</p>}

                  <Button type="button" variant="outline" onClick={() => setShowAddressForm((value) => !value)}>
                     {showAddressForm ? 'بستن فرم نشانی' : 'افزودن نشانی جدید'}
                  </Button>

                  {showAddressForm && (
                     <form onSubmit={saveAddress} className="space-y-3 rounded-lg border p-4">
                        <div className="space-y-1">
                           <Label htmlFor="city">شهر</Label>
                           <Input id="city" required value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
                        </div>
                        <div className="space-y-1">
                           <Label htmlFor="address">نشانی کامل</Label>
                           <Textarea id="address" required value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                           <div className="space-y-1">
                              <Label htmlFor="phone">شماره تماس</Label>
                              <Input id="phone" required inputMode="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                           </div>
                           <div className="space-y-1">
                              <Label htmlFor="postalCode">کد پستی</Label>
                              <Input id="postalCode" required inputMode="numeric" value={form.postalCode} onChange={(event) => setForm({ ...form, postalCode: event.target.value })} />
                           </div>
                        </div>
                        <Button type="submit" disabled={savingAddress}>{savingAddress ? 'در حال ذخیره...' : 'ذخیره نشانی'}</Button>
                     </form>
                  )}
               </CardContent>
            </Card>

            <Card>
               <CardHeader><h2 className="font-bold">خلاصه سفارش</h2></CardHeader>
               <CardContent className="space-y-4">
                  <div className="space-y-3">
                     {cart.items.map((item) => (
                        <div key={item.productId} className="flex justify-between gap-3 text-sm">
                           <span>{item.product.title} × {money.format(item.count)}</span>
                           <span className="whitespace-nowrap">{toman(item.count * item.product.price)}</span>
                        </div>
                     ))}
                  </div>
                  <div className="space-y-2 border-t pt-3 text-sm">
                     <div className="flex justify-between"><span>جمع کالاها</span><span>{toman(totals.subtotal)}</span></div>
                     <div className="flex justify-between"><span>تخفیف محصولات</span><span>{toman(totals.productDiscount)}</span></div>
                     <div className="flex justify-between"><span>مالیات</span><span>{toman(totals.tax)}</span></div>
                     <div className="flex justify-between font-bold"><span>مبلغ نهایی</span><span>{toman(totals.payable)}</span></div>
                     <p className="text-xs text-muted-foreground">هزینه ارسال در این نسخه محاسبه نشده و مبلغ پرداختی نهایی ممکن است پس از تکمیل تنظیمات ارسال تغییر کند.</p>
                  </div>
                  <Button className="w-full" onClick={submitOrder} disabled={submitting || !selectedAddress}>
                     {submitting ? 'در حال ثبت سفارش...' : 'ثبت سفارش'}
                  </Button>
                  <p className="text-xs text-muted-foreground">ثبت سفارش به معنی پرداخت آنلاین نیست. درگاه پرداخت هنوز به این فروشگاه متصل نشده است.</p>
               </CardContent>
            </Card>
         </div>
      </div>
   )
}
