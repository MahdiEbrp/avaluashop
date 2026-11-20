'use client'

import { useCallback, useEffect, useState } from 'react'

type Settings = {
   taxEnabled: boolean
   taxRate: number
   taxLabel: string
   currency: 'IRT'
   gateway: {
      isActive: boolean
      sandbox: boolean
      credentialsConfigured: boolean
   }
}

const inputClass = 'w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary'

export default function SettingsPage() {
   const [settings, setSettings] = useState<Settings | null>(null)
   const [merchantKey, setMerchantKey] = useState('')
   const [loading, setLoading] = useState(true)
   const [saving, setSaving] = useState(false)
   const [message, setMessage] = useState('')
   const [error, setError] = useState(false)

   const load = useCallback(async () => {
      setLoading(true)
      try {
         const response = await fetch('/api/admin/settings', { cache: 'no-store' })
         const data = await response.json()
         if (!response.ok) throw new Error(data.message || 'دریافت تنظیمات ناموفق بود.')
         setSettings(data)
         setError(false)
      } catch (reason) {
         setMessage(reason instanceof Error ? reason.message : 'خطا در دریافت تنظیمات')
         setError(true)
      } finally {
         setLoading(false)
      }
   }, [])

   useEffect(() => { void load() }, [load])

   async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault()
      if (!settings) return
      setSaving(true)
      setMessage('')
      setError(false)

      try {
         const response = await fetch('/api/admin/settings', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
               taxEnabled: settings.taxEnabled,
               taxRate: settings.taxRate / 100,
               taxLabel: settings.taxLabel,
               currency: 'IRT',
               gatewayActive: settings.gateway.isActive,
               sandbox: settings.gateway.sandbox,
               ...(merchantKey.trim() ? { merchantKey: merchantKey.trim() } : {}),
            }),
         })
         const result = await response.json()
         if (!response.ok) throw new Error(result.message || 'ذخیره تنظیمات ناموفق بود.')
         setMerchantKey('')
         setMessage('تنظیمات با موفقیت ذخیره شد.')
         await load()
      } catch (reason) {
         setMessage(reason instanceof Error ? reason.message : 'ذخیره تنظیمات ناموفق بود.')
         setError(true)
      } finally {
         setSaving(false)
      }
   }

   if (loading) {
      return <div className="py-16 text-center text-sm text-muted-foreground" dir="rtl">در حال بارگذاری تنظیمات...</div>
   }

   if (!settings) {
      return (
         <main className="mx-auto max-w-3xl py-10" dir="rtl">
            <h1 className="text-2xl font-bold">تنظیمات فروشگاه</h1>
            <p role="alert" className="mt-4 rounded-lg border p-4 text-sm">{message || 'تنظیمات در دسترس نیست.'}</p>
            <button type="button" onClick={() => void load()} className="mt-4 rounded-lg border px-4 py-2 text-sm">تلاش دوباره</button>
         </main>
      )
   }

   return (
      <main className="mx-auto max-w-3xl space-y-6 py-8" dir="rtl">
         <header>
            <p className="text-sm text-muted-foreground">مدیریت فروشگاه</p>
            <h1 className="mt-1 text-2xl font-bold">تنظیمات فروشگاه</h1>
            <p className="mt-2 text-sm text-muted-foreground">تنظیمات مالیات و درگاه پرداخت از دیتابیس خوانده و ذخیره می‌شوند.</p>
         </header>

         {message && (
            <p role={error ? 'alert' : 'status'} className="rounded-lg border p-3 text-sm">
               {message}
            </p>
         )}

         <form onSubmit={saveSettings} className="space-y-6">
            <section className="space-y-5 rounded-xl border p-5">
               <div>
                  <h2 className="text-lg font-semibold">مالیات و واحد پول</h2>
                  <p className="mt-1 text-sm text-muted-foreground">نرخ مالیات به‌صورت درصد وارد می‌شود؛ مقدار ذخیره‌شده در دیتابیس اعشاری است.</p>
               </div>

               <label className="flex items-center gap-3 text-sm">
                  <input
                     type="checkbox"
                     checked={settings.taxEnabled}
                     onChange={(event) => setSettings({ ...settings, taxEnabled: event.target.checked })}
                     className="size-4 accent-primary"
                  />
                  محاسبه مالیات فعال باشد
               </label>

               <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm">
                     <span>نرخ مالیات (درصد)</span>
                     <input
                        className={inputClass}
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={settings.taxRate}
                        onChange={(event) => setSettings({ ...settings, taxRate: Number(event.target.value) })}
                        required
                     />
                  </label>
                  <label className="space-y-2 text-sm">
                     <span>عنوان مالیات</span>
                     <input
                        className={inputClass}
                        maxLength={80}
                        value={settings.taxLabel}
                        onChange={(event) => setSettings({ ...settings, taxLabel: event.target.value })}
                        required
                     />
                  </label>
               </div>
               <p className="text-xs text-muted-foreground">واحد پول فعلی فروشگاه: تومان (IRT)</p>
            </section>

            <section className="space-y-5 rounded-xl border p-5">
               <div>
                  <h2 className="text-lg font-semibold">درگاه پرداخت تاباپی</h2>
                  <p className="mt-1 text-sm text-muted-foreground">کلید پذیرنده فقط در سرور رمزگشایی می‌شود و هرگز در پاسخ API برگردانده نمی‌شود.</p>
               </div>

               <label className="flex items-center gap-3 text-sm">
                  <input
                     type="checkbox"
                     checked={settings.gateway.sandbox}
                     onChange={(event) => setSettings({
                        ...settings,
                        gateway: { ...settings.gateway, sandbox: event.target.checked },
                     })}
                     className="size-4 accent-primary"
                  />
                  حالت آزمایشی (Sandbox) فعال باشد
               </label>

               <label className="block space-y-2 text-sm">
                  <span>کلید پذیرنده</span>
                  <input
                     className={inputClass}
                     type="password"
                     autoComplete="new-password"
                     value={merchantKey}
                     onChange={(event) => setMerchantKey(event.target.value)}
                     placeholder={settings.gateway.credentialsConfigured ? 'برای حفظ کلید فعلی خالی بگذارید' : 'کلید پذیرنده را وارد کنید'}
                  />
                  <span className="block text-xs text-muted-foreground">
                     {settings.gateway.credentialsConfigured ? 'کلید رمزنگاری‌شده ذخیره شده است.' : 'هنوز کلیدی ذخیره نشده است.'}
                  </span>
               </label>

               <label className="flex items-center gap-3 text-sm">
                  <input
                     type="checkbox"
                     checked={settings.gateway.isActive}
                     onChange={(event) => setSettings({
                        ...settings,
                        gateway: { ...settings.gateway, isActive: event.target.checked },
                     })}
                     className="size-4 accent-primary"
                  />
                  درگاه برای پرداخت‌های جدید فعال باشد
               </label>

               <p className="rounded-lg bg-muted/50 p-3 text-xs leading-6 text-muted-foreground">
                  برای فعال‌سازی درگاه، ابتدا کلید رمزنگاری سرور و کلید پذیرنده باید تنظیم شده باشند. حالت Sandbox را تا پایان آزمون‌های کامل پرداخت روشن نگه دارید.
               </p>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3">
               <p className="text-xs text-muted-foreground">تغییر تنظیمات درگاه هنگام وجود پرداخت در حال پردازش پذیرفته نمی‌شود.</p>
               <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
               >
                  {saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}
               </button>
            </div>
         </form>
      </main>
   )
}
