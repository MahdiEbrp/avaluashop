'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CartContextProvider, useCartContext } from '@/state/Cart'
import { UserContextProvider, useUserContext } from '@/state/User'
import { redirectToPayment } from '@/lib/payments/redirect'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

interface Address {
   id: string
   address: string
   city: string
   phone: string
   postalCode: string
}

interface ShippingMethod {
   id: string
   code: string
   title: string
   description: string | null
   type: 'FlatRate' | 'Free' | 'FreeAbove' | 'CarrierCalculated'
   amount: number
   freeAbove: number | null
   available: boolean
   unavailableReason: string | null
}

interface CartLine {
   count: number
   product: { price: number; discount: number }
}

interface StoreSettings {
   taxEnabled: boolean
   taxRate: number
   taxLabel: string
}

/* React 19 deprecates FormEvent; only preventDefault is used here. */
interface SubmitEvent {
   preventDefault: () => void
}

/* The orders route answers in two shapes: plain text for the legacy errors and
   JSON for the shipping ones. Reading only one of them showed raw JSON (or the
   wrong message) to the customer. */
const ORDER_MESSAGES: Record<string, string> = {
   'Discount code is invalid or expired': 'کد تخفیف نامعتبر یا منقضی شده است.',
   SHIPPING_METHOD_REQUIRED: 'لطفاً روش ارسال را انتخاب کنید.',
   SHIPPING_METHOD_UNAVAILABLE:
      'روش ارسال انتخاب‌شده برای این نشانی در دسترس نیست. دوباره انتخاب کنید.',
   SHIPPING_NOT_AVAILABLE_FOR_CITY: 'به این نشانی ارسال نداریم. نشانی دیگری انتخاب کنید.',
   INVALID_ORDER_REQUEST: 'اطلاعات سفارش کامل نیست.',
   INSUFFICIENT_STOCK: 'موجودی یکی از محصولات تغییر کرده است. سبد خرید را بررسی کنید.',
}

async function orderErrorMessage(response: Response) {
   const raw = await response.text()
   let code = raw.trim()

   try {
      const parsed = JSON.parse(raw) as { message?: unknown }
      if (typeof parsed?.message === 'string') code = parsed.message
   } catch {
      /* Plain-text body; `code` already holds it. */
   }

   if (ORDER_MESSAGES[code]) return ORDER_MESSAGES[code]

   /* Still map an unexplained 409 to the stock message, but only after the
      known codes have had their chance. */
   if (response.status === 409) {
      return 'موجودی یکی از محصولات تغییر کرده است. سبد خرید را بررسی کنید.'
   }

   return code || 'ثبت سفارش انجام نشد.'
}

const money = new Intl.NumberFormat('fa-IR')
const toman = (value: number) => `${money.format(Math.round(value))} تومان`

/* A method the shopper cannot use costs nothing; a free-above method is free
   once the discounted subtotal clears its threshold. */
function shippingFee(method: ShippingMethod | undefined, afterDiscount: number) {
   if (!method?.available) return 0
   if (method.type === 'Free') return 0
   if (method.type === 'FreeAbove') {
      const threshold = method.freeAbove ?? Infinity
      return afterDiscount >= threshold ? 0 : method.amount
   }
   return method.amount
}


function isShippingMethod(value: unknown): value is ShippingMethod {
   if (typeof value !== 'object' || value === null) return false
   const candidate = value as Partial<ShippingMethod>
   return typeof candidate.id === 'string' && typeof candidate.available === 'boolean'
}

function methodNote(method: ShippingMethod) {
   if (!method.available) {
      return method.unavailableReason === 'CITY_NOT_SUPPORTED'
         ? 'برای شهر انتخاب‌شده ارائه نمی‌شود.'
         : 'استعلام آنلاین این شرکت هنوز متصل نشده است.'
   }
   if (method.type === 'Free') return 'رایگان'
   if (method.type === 'FreeAbove') {
      return `از ${money.format(method.freeAbove ?? 0)} تومان رایگان؛ در غیر این صورت ${toman(method.amount)}`
   }
   return toman(method.amount)
}

type ShippingSectionState = 'loading' | 'failed' | 'none' | 'blocked' | 'list'

function shippingSectionState(
   loading: boolean,
   failed: boolean,
   methods: ShippingMethod[]
): ShippingSectionState {
   if (loading) return 'loading'
   if (failed) return 'failed'
   if (methods.length === 0) return 'none'
   if (methods.some((method) => method.available)) return 'list'
   return 'blocked'
}

function submitLabel(submitting: boolean, paymentPending: boolean) {
   if (paymentPending) return 'در انتظار بررسی تراکنش'
   if (submitting) return 'در حال انتقال به درگاه...'
   return 'پرداخت و ثبت سفارش'
}

function paymentErrorMessage(code: unknown) {
   if (code === 'TABAPAY_AMOUNT_OUT_OF_RANGE') return 'مبلغ سفارش خارج از محدوده مجاز درگاه است.'
   if (code === 'TABAPAY_NOT_CONFIGURED') {
      return 'درگاه پرداخت موقتاً آماده نیست. سفارش لغو شده و می‌توانید بعداً دوباره تلاش کنید.'
   }
   return 'اتصال به درگاه پرداخت انجام نشد. اگر سفارش ثبت شده، پیش از تلاش مجدد وضعیت آن را بررسی کنید.'
}

export default function CheckoutPage() {
   return (
      <UserContextProvider>
         <CartContextProvider>
            <CheckoutContent />
         </CartContextProvider>
      </UserContextProvider>
   )
}

function CheckoutContent() {
   const { user, loading: userLoading } = useUserContext()
   const { cart, loading: cartLoading } = useCartContext()
   const [addresses, setAddresses] = useState<Address[]>([])
   const [selectedAddress, setSelectedAddress] = useState('')
   const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([])
   const [selectedShippingMethod, setSelectedShippingMethod] = useState('')
   const [shippingLoading, setShippingLoading] = useState(true)
   const [shippingLoadFailed, setShippingLoadFailed] = useState(false)
   const [storeSettings, setStoreSettings] = useState<StoreSettings>({
      taxEnabled: true,
      taxRate: 0.09,
      taxLabel: 'مالیات بر ارزش افزوده',
   })
   const [discountCode, setDiscountCode] = useState('')
   const [loadingAddresses, setLoadingAddresses] = useState(true)
   const [savingAddress, setSavingAddress] = useState(false)
   const [submitting, setSubmitting] = useState(false)
   // Keep one key for this checkout view so retries after an uncertain response
   // resolve to the same server-side order rather than reserving stock twice.
   const orderRequestKey = useRef<string | null>(null)
   const [paymentPending, setPaymentPending] = useState(false)
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
      const params = new URLSearchParams(globalThis.location.search)
      const paymentResult = params.get('payment')

      if (paymentResult === 'success') {
         const orderId = params.get('orderId')
         if (!orderId) {
            setError('شناسه سفارش برای بررسی نتیجه پرداخت وجود ندارد.')
            return
         }

         let cancelled = false
         fetch('/api/orders', { cache: 'no-store' })
            .then(async (response) => {
               if (!response.ok) throw new Error('دریافت وضعیت سفارش انجام نشد.')
               return response.json()
            })
            .then((orders: { id: string; number: number; isPaid: boolean }[]) => {
               const confirmedOrder = orders.find((order) => order.id === orderId)
               if (!confirmedOrder?.isPaid) {
                  throw new Error('وضعیت پرداخت این سفارش هنوز در سامانه تأیید نشده است.')
               }
               if (!cancelled) {
                  setSuccess(
                     `پرداخت سفارش شماره ${money.format(confirmedOrder.number)} با موفقیت تأیید شد.`
                  )
               }
            })
            .catch((error_: unknown) => {
               if (!cancelled) {
                  setError(
                     error_ instanceof Error
                        ? error_.message
                        : 'بررسی وضعیت پرداخت انجام نشد.'
                  )
               }
            })

         return () => {
            cancelled = true
         }
      }

      if (paymentResult === 'failed') {
         setError('پرداخت تأیید نشد. اگر مبلغی از حساب شما کسر شده، وضعیت تراکنش را از پشتیبانی پیگیری کنید.')
      } else if (paymentResult === 'pending') {
         setPaymentPending(true)
         setError('تأیید پرداخت هنوز قطعی نیست. لطفاً از ثبت دوباره سفارش خودداری کنید و وضعیت تراکنش را با پشتیبانی بررسی کنید.')
      }
   }, [])

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
            if (items.length > 0) setSelectedAddress(items[0].id)
         })
         .catch((error_: unknown) => {
            if (!cancelled) setError(error_ instanceof Error ? error_.message : 'خطا در دریافت نشانی‌ها')
         })
         .finally(() => {
            if (!cancelled) setLoadingAddresses(false)
         })

      return () => {
         cancelled = true
      }
   }, [user])

   useEffect(() => {
      const address = addresses.find((item) => item.id === selectedAddress)
      if (!user || !address) {
         // eslint-disable-next-line react-hooks/set-state-in-effect -- reset loading when no destination is selected
         setShippingLoading(false)
         return
      }

      let cancelled = false
      setShippingLoading(true)
      setShippingLoadFailed(false)

      Promise.all([
         fetch(`/api/shipping-methods?city=${encodeURIComponent(address.city)}`, { cache: 'no-store' }),
         fetch('/api/store-settings', { cache: 'no-store' }),
      ])
         .then(async ([shippingResponse, settingsResponse]) => {
            if (!shippingResponse.ok || !settingsResponse.ok) {
               throw new Error('دریافت هزینه ارسال یا تنظیمات مالیات انجام نشد.')
            }
            const [rawMethods, settings] = await Promise.all([
               shippingResponse.json() as Promise<unknown>,
               settingsResponse.json() as Promise<StoreSettings>,
            ])
            if (cancelled) return
            const methods = Array.isArray(rawMethods) ? rawMethods.filter(isShippingMethod) : []
            setShippingMethods(methods)
            setSelectedShippingMethod((current) =>
               methods.some((method) => method.id === current && method.available)
                  ? current
                  : methods.find((method) => method.available)?.id ?? ''
            )
            setStoreSettings({
               taxEnabled: typeof settings.taxEnabled === 'boolean' ? settings.taxEnabled : true,
               taxRate: typeof settings.taxRate === 'number' ? settings.taxRate : 0.09,
               taxLabel: typeof settings.taxLabel === 'string' ? settings.taxLabel : 'مالیات بر ارزش افزوده',
            })
         })
         .catch((error_: unknown) => {
            if (!cancelled) {
               setShippingLoadFailed(true)
               setError(error_ instanceof Error ? error_.message : 'دریافت تنظیمات خرید انجام نشد.')
            }
         })
         .finally(() => {
            if (!cancelled) setShippingLoading(false)
         })

      return () => {
         cancelled = true
      }
   }, [user, addresses, selectedAddress])

   const sectionState = shippingSectionState(
      shippingLoading,
      shippingLoadFailed,
      shippingMethods
   )

   const totals = useMemo(() => {
      /* The cart API sends plain numbers; the context type is loose. */
      const items: CartLine[] = cart?.items ?? []
      const subtotal = items.reduce(
         (sum, item) => sum + item.count * item.product.price,
         0
      )
      const productDiscount = items.reduce(
         (sum, item) => sum + item.count * item.product.discount,
         0
      )
      const afterDiscount = Math.max(0, subtotal - productDiscount)
      const method = shippingMethods.find((item) => item.id === selectedShippingMethod)
      const shipping = shippingFee(method, afterDiscount)
      const tax = storeSettings.taxEnabled ? afterDiscount * storeSettings.taxRate : 0
      return {
         subtotal,
         productDiscount,
         shipping,
         tax,
         payable: afterDiscount + tax + shipping,
      }
   }, [cart, shippingMethods, selectedShippingMethod, storeSettings])

   async function saveAddress(event: SubmitEvent) {
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
      } catch (error_: unknown) {
         setError(error_ instanceof Error ? error_.message : 'خطا در ذخیره نشانی')
      } finally {
         setSavingAddress(false)
      }
   }

   async function submitOrder() {
      /* The trigger button is already disabled without a selection; this guard
         only protects a programmatic call. */
      /* v8 ignore next 3 */
      if (!selectedAddress) {
         setError('ابتدا یک نشانی ارسال انتخاب کنید.')
         return
      }

      setSubmitting(true)
      setError('')
      setSuccess('')

      try {
         if (!orderRequestKey.current) orderRequestKey.current = globalThis.crypto.randomUUID()
         const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               addressId: selectedAddress,
               idempotencyKey: orderRequestKey.current,
               shippingMethodId: selectedShippingMethod || undefined,
               discountCode: discountCode.trim() || undefined,
            }),
         })
         if (!response.ok) throw new Error(await orderErrorMessage(response))
         const order = await response.json()
         const paymentResponse = await fetch('/api/payments/tabapay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: order.id }),
         })
         const paymentBody = await paymentResponse.json().catch(() => ({}))
         if (paymentResponse.status === 202) {
            setPaymentPending(true)
            setError('وضعیت ایجاد تراکنش هنوز مشخص نیست. سفارش و موجودی آن برای بررسی حفظ شده است؛ لطفاً سفارش دیگری ثبت نکنید و وضعیت را از پشتیبانی پیگیری کنید.')
            return
         }
         if (!paymentResponse.ok) {
            throw new Error(paymentErrorMessage(paymentBody.message))
         }
         /* The body was already consumed for the 202 check above; reading it a
            second time throws and would abort the redirect entirely. */
         const { paymentUrl } = paymentBody
         if (typeof paymentUrl !== 'string') throw new Error('نشانی درگاه نامعتبر است.')
         redirectToPayment(paymentUrl)
      } catch (error_: unknown) {
         setError(error_ instanceof Error ? error_.message : 'خطا در ثبت سفارش')
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
                  <h1 className="text-2xl font-bold text-primary">پرداخت تأیید شد</h1>
                  <p>{success}</p>
                  <p className="text-sm text-muted-foreground">تراکنش از سمت سرور تأیید شده است. می‌توانید برای مشاهده فروشگاه بازگردید.</p>
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

         <div className="grid gap-5 md:grid-cols-3">
            <div className="space-y-5 md:col-span-2">
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
                                 onChange={() => { setSelectedAddress(address.id) }}
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

                  <Button type="button" variant="outline" onClick={() => { setShowAddressForm((value) => !value) }}>
                     {showAddressForm ? 'بستن فرم نشانی' : 'افزودن نشانی جدید'}
                  </Button>

                  {showAddressForm && (
                     <form onSubmit={(event) => { void saveAddress(event) }} className="space-y-3 rounded-lg border p-4">
                        <div className="space-y-1">
                           <Label htmlFor="city">شهر</Label>
                           <Input id="city" required value={form.city} onChange={(event) => { setForm({ ...form, city: event.target.value }) }} />
                        </div>
                        <div className="space-y-1">
                           <Label htmlFor="address">نشانی کامل</Label>
                           <Textarea id="address" required value={form.address} onChange={(event) => { setForm({ ...form, address: event.target.value }) }} />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                           <div className="space-y-1">
                              <Label htmlFor="phone">شماره تماس</Label>
                              <Input id="phone" required inputMode="tel" value={form.phone} onChange={(event) => { setForm({ ...form, phone: event.target.value }) }} />
                           </div>
                           <div className="space-y-1">
                              <Label htmlFor="postalCode">کد پستی</Label>
                              <Input id="postalCode" required inputMode="numeric" value={form.postalCode} onChange={(event) => { setForm({ ...form, postalCode: event.target.value }) }} />
                           </div>
                        </div>
                        <Button type="submit" disabled={savingAddress}>{savingAddress ? 'در حال ذخیره...' : 'ذخیره نشانی'}</Button>
                     </form>
                  )}
               </CardContent>
               </Card>

               <Card>
                  <CardHeader><h2 className="font-bold">روش ارسال</h2></CardHeader>
                  <CardContent className="space-y-3">
                     {sectionState === 'loading' && (
                        <p className="text-sm text-muted-foreground">در حال بررسی روش‌های ارسال...</p>
                     )}
                     {sectionState === 'failed' && (
                        <p role="alert" className="text-sm text-destructive">روش‌های ارسال در دسترس نیستند. لطفاً صفحه را تازه‌سازی کنید.</p>
                     )}
                     {sectionState === 'none' && (
                        <p className="text-sm text-muted-foreground">روش ارسالی تعریف نشده است؛ هزینه ارسال فعلاً صفر محاسبه می‌شود.</p>
                     )}
                     {sectionState === 'list' && shippingMethods.map((method) => (
                           <label key={method.id} className={`flex items-start gap-3 rounded-lg border p-3 ${method.available ? 'cursor-pointer' : 'opacity-50'}`}>
                              <input
                                 type="radio"
                                 name="shipping-method"
                                 value={method.id}
                                 checked={selectedShippingMethod === method.id}
                                 disabled={!method.available}
                                 onChange={() => { setSelectedShippingMethod(method.id) }}
                                 className="mt-1"
                              />
                              <span className="min-w-0 flex-1 space-y-1 text-sm">
                                 <span className="block font-semibold">{method.title}</span>
                                 {method.description && <span className="block text-muted-foreground">{method.description}</span>}
                                 <span className="block text-muted-foreground">{methodNote(method)}</span>
                              </span>
                           </label>
                     ))}
                     {sectionState === 'blocked' && (
                        <p className="text-sm text-muted-foreground">برای شهر این نشانی روش ارسال فعالی وجود ندارد.</p>
                     )}
                  </CardContent>
               </Card>
            </div>

            <Card className="md:col-span-1">
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
                     <div className="space-y-1">
                        <Label htmlFor="discountCode">کد تخفیف</Label>
                        <Input
                           id="discountCode"
                           value={discountCode}
                           onChange={(event) => { setDiscountCode(event.target.value) }}
                           placeholder="در صورت داشتن کد وارد کنید"
                           autoComplete="off"
                        />
                        <p className="text-xs text-muted-foreground">اعتبار کد و مقدار تخفیف هنگام ثبت سفارش در سرور بررسی می‌شود.</p>
                     </div>
                     <div className="flex justify-between"><span>جمع کالاها</span><span>{toman(totals.subtotal)}</span></div>
                     <div className="flex justify-between"><span>تخفیف محصولات</span><span>{toman(totals.productDiscount)}</span></div>
                     <div className="flex justify-between"><span>هزینه ارسال</span><span>{toman(totals.shipping)}</span></div>
                     <div className="flex justify-between"><span>{storeSettings.taxLabel}</span><span>{toman(totals.tax)}</span></div>
                     <div className="flex justify-between font-bold"><span>مبلغ نهایی تقریبی</span><span>{toman(totals.payable)}</span></div>
                     <p className="text-xs text-muted-foreground">مبلغ نهایی، تخفیف کد و هزینه ارسال دوباره در سرور اعتبارسنجی و محاسبه می‌شوند.</p>
                  </div>
                  <Button className="w-full" onClick={() => { void submitOrder() }} disabled={submitting || paymentPending || !selectedAddress || shippingLoading || shippingLoadFailed || (shippingMethods.length > 0 && !selectedShippingMethod)}>
                     {submitLabel(submitting, paymentPending)}
                  </Button>
                  <p className="text-xs text-muted-foreground">پس از پرداخت، نتیجه تراکنش از طریق استعلام امن سرور بررسی می‌شود.</p>
               </CardContent>
            </Card>
         </div>
      </div>
   )
}
