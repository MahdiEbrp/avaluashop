'use client'

import { useEffect, useState } from 'react'

type Settings = {
   taxEnabled: boolean
   taxRate: number
   taxLabel: string
   currency: 'IRR' | 'IRT'
   gateway: {
      isActive: boolean
      sandbox: boolean
      credentialsConfigured: boolean
   }
}
type ShippingMethod = {
   id: string
   code: string
   title: string
   description: string | null
   cost: number
   freeShippingThreshold: number | null
   isActive: boolean
   sortOrder: number
}

const inputClass = 'w-full rounded-md border bg-background px-3 py-2 text-sm'

export default function SettingsPage() {
   const [settings, setSettings] = useState<Settings | null>(null)
   const [methods, setMethods] = useState<ShippingMethod[]>([])
   const [merchantKey, setMerchantKey] = useState('')
   const [newMethod, setNewMethod] = useState({ code: '', title: '', cost: '0', freeShippingThreshold: '' })
   const [loading, setLoading] = useState(true)
   const [saving, setSaving] = useState(false)
   const [message, setMessage] = useState('')

   async function load() {
      setLoading(true)
      try {
         const [settingsResponse, methodsResponse] = await Promise.all([
            fetch('/api/admin/settings', { cache: 'no-store' }),
            fetch('/api/admin/shipping-methods', { cache: 'no-store' }),
         ])
         if (!settingsResponse.ok || !methodsResponse.ok) throw new Error('دریافت تنظیمات انجام نشد.')
         const [settingsData, methodsData] = await Promise.all([settingsResponse.json(), methodsResponse.json()])
         setSettings(settingsData)
         setMethods(methodsData)
      } catch (error) {
         setMessage(error instanceof Error ? error.message : 'خطا در دریافت اطلاعات')
      } finally {
         setLoading(false)
      }
   }

   useEffect(() => { void load() }, [])

   async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault()
      if (!settings) return
      setSaving(true)
      setMessage('')
      try {
         const response = await fetch('/api/admin/settings', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
               taxEnabled: settings.taxEnabled,
               taxRate: settings.taxRate / 100,
               taxLabel: settings.taxLabel,
               currency: settings.currency,
               gatewayActive: settings.gateway.isActive,
               sandbox: settings.gateway.sandbox,
               merchantKey,
            }),
         })
         const result = await response.json()
         if (!response.ok) throw new Error(result.message || 'ذخیره تنظیمات ناموفق بود.')
         setMerchantKey('')
         setMessage('تنظیمات با موفقیت ذخیره شد.')
         await load()
      } catch (error) {
         setMessage(error instanceof Error ? error.message : 'ذخیره تنظیمات ناموفق بود.')
      } finally {
         setSaving(false)
      }
   }

   async function addShippingMethod(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault()
      setMessage('')
      try {
         const response = await fetch('/api/admin/shipping-methods', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
               code: newMethod.code,
               title: newMethod.title,
               cost: Number(newMethod.cost),
               freeShippingThreshold: newMethod.freeShippingThreshold ? Number(newMethod.freeShippingThreshold) : null,
               isActive: true,
               sortOrder: methods.length,
            }),
         })
         const result = await response.json()
         if (!response.ok) throw new Error(result.message || 'افزودن روش ارسال ناموفق بود.')
         setNewMethod({ code: '', title: '', cost: '0', freeShippingThreshold: '' })
         await load()
         setMessage('روش ارسال اضافه شد.')
      } catch (error) {
         setMessage(error instanceof Error ? error.message : 'خطا در افزودن روش ارسال')
      }
   }

   async function updateMethod(method: ShippingMethod, changes: Partial<ShippingMethod>) {
      const response = await fetch('/api/admin/shipping-methods/' + method.id, {
         method: 'PATCH',
         headers: { 'content-type': 'application/json' },
         body: JSON.stringify(changes),
      })
      if (!response.ok) throw new Error('به‌روزرسانی روش ارسال ناموفق بود.')
      await load()
   }

   async function deleteMethod(method: ShippingMethod) {
      if (!window.confirm('این روش ارسال حذف شود؟')) return
      const response = await fetch('/api/admin/shipping-methods/' + method.id, { method: 'DELETE' })
      if (!response.ok) {
         setMessage('حذف روش ارسال ناموفق بود؛ ممکن است قبلاً در سفارش استفاده شده باشد.')
         return
      }
      await load()
   }

   if (loading) return <div className="py-10 text-center" dir="rtl">در حال بارگذاری تنظیمات...</div>
   if (!settings) return <div className="py-10 text-center" dir="rtl">{message || 'تنظیمات در دسترس نیست.'}</div>

   return (
      <main className="mx-auto max-w-4xl space-y-8 py-8" dir="rtl">
         <header>
            <h1 className="text-2xl font-bold">تنظیمات فروشگاه</h1>
            <p className="mt-1 text-sm text-muted-foreground">مدیریت درگاه پرداخت، مالیات و روش‌های ارسال؛ تنظیمات از دیتابیس خوانده می‌شوند.</p>
         </header>
         {message && <p role="status" className="rounded-md border p-3 text-sm">{message}</p>}

         <form onSubmit={saveSettings} className="space-y-6 rounded-xl border p-5">
            <section className="space-y-4">
               <h2 className="text-lg font-semibold">مالیات و واحد پول</h2>
               <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={settings.taxEnabled} onChange={(event) => setSettings({ ...settings, taxEnabled: event.target.checked })} />
                  محاسبه مالیات فعال باشد
               </label>
               <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">نرخ مالیات (درصد)
                     <input className={inputClass} type="number" min="0" max="100" step="0.01" value={settings.taxRate} onChange={(event) => setSettings({ ...settings, taxRate: Number(event.target.value) })} />
                  </label>
                  <label className="space-y-1 text-sm">عنوان مالیات
                     <input className={inputClass} value={settings.taxLabel} onChange={(event) => setSettings({ ...settings, taxLabel: event.target.value })} />
                  </label>
                  <label className="space-y-1 text-sm">واحد پول
                     <select className={inputClass} value={settings.currency} onChange={(event) => setSettings({ ...settings, currency: event.target.value as 'IRR' | 'IRT' })}>
                        <option value="IRR">ریال</option>
                        <option value="IRT">تومان</option>
                     </select>
                  </label>
               </div>
            </section>
            <hr />
            <section className="space-y-4">
               <h2 className="text-lg font-semibold">درگاه پرداخت تاباپی</h2>
               <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={settings.gateway.isActive} onChange={(event) => setSettings({ ...settings, gateway: { ...settings.gateway, isActive: event.target.checked } })} />
                  فعال‌سازی درگاه
               </label>
               <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={settings.gateway.sandbox} onChange={(event) => setSettings({ ...settings, gateway: { ...settings.gateway, sandbox: event.target.checked } })} />
                  حالت آزمایشی (Sandbox)
               </label>
               <label className="block space-y-1 text-sm">کلید پذیرنده
                  <input className={inputClass} type="password" autoComplete="new-password" value={merchantKey} onChange={(event) => setMerchantKey(event.target.value)} placeholder={settings.gateway.credentialsConfigured ? 'کلید ذخیره شده؛ برای جایگزینی وارد کنید' : 'کلید پذیرنده را وارد کنید'} />
               </label>
               <p className="text-xs text-muted-foreground">
                  وضعیت کلید: {settings.gateway.credentialsConfigured ? 'ذخیره شده و رمزنگاری‌شده' : 'هنوز تنظیم نشده'}. کلید خام هرگز از سرور به مرورگر بازگردانده نمی‌شود.
               </p>
            </section>
            <button disabled={saving} className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
               {saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}
            </button>
         </form>

         <section className="space-y-4 rounded-xl border p-5">
            <div>
               <h2 className="text-lg font-semibold">روش‌های ارسال</h2>
               <p className="text-sm text-muted-foreground">هزینه و حداقل مبلغ ارسال رایگان برای هر روش تعیین می‌شود.</p>
            </div>
            <div className="space-y-3">
               {methods.map((method) => (
                  <div key={method.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                     <div>
                        <p className="font-medium">{method.title}</p>
                        <p className="text-xs text-muted-foreground">{method.code} · هزینه: {method.cost.toLocaleString('fa-IR')} · ارسال رایگان از {method.freeShippingThreshold?.toLocaleString('fa-IR') ?? '—'}</p>
                     </div>
                     <div className="flex items-center gap-3 text-sm">
                        <label className="flex items-center gap-1">
                           <input type="checkbox" checked={method.isActive} onChange={(event) => void updateMethod(method, { isActive: event.target.checked }).catch((error) => setMessage(error.message))} />
                           فعال
                        </label>
                        <button type="button" className="text-destructive" onClick={() => void deleteMethod(method)}>حذف</button>
                     </div>
                  </div>
               ))}
               {!methods.length && <p className="text-sm text-muted-foreground">هنوز روش ارسالی تعریف نشده است.</p>}
            </div>
            <form onSubmit={addShippingMethod} className="grid gap-3 border-t pt-4 sm:grid-cols-2">
               <label className="space-y-1 text-sm">شناسه انگلیسی
                  <input className={inputClass} required pattern="[a-z0-9-]{2,40}" value={newMethod.code} onChange={(event) => setNewMethod({ ...newMethod, code: event.target.value })} placeholder="post-express" />
               </label>
               <label className="space-y-1 text-sm">عنوان
                  <input className={inputClass} required value={newMethod.title} onChange={(event) => setNewMethod({ ...newMethod, title: event.target.value })} placeholder="پست پیشتاز" />
               </label>
               <label className="space-y-1 text-sm">هزینه ارسال
                  <input className={inputClass} required type="number" min="0" value={newMethod.cost} onChange={(event) => setNewMethod({ ...newMethod, cost: event.target.value })} />
               </label>
               <label className="space-y-1 text-sm">ارسال رایگان از مبلغ (اختیاری)
                  <input className={inputClass} type="number" min="0" value={newMethod.freeShippingThreshold} onChange={(event) => setNewMethod({ ...newMethod, freeShippingThreshold: event.target.value })} />
               </label>
               <button className="rounded-md border px-4 py-2 text-sm sm:col-span-2">افزودن روش ارسال</button>
            </form>
         </section>
      </main>
   )
}
