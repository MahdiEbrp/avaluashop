'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'

type Method = {
   id: string
   code: string
   title: string
   description: string | null
   type: 'FlatRate' | 'Free' | 'FreeAbove' | 'CarrierCalculated'
   amount: number
   freeAbove: number | null
   isActive: boolean
   sortOrder: number
   allowedCities: string[]
   _count?: { orders: number }
}

type Draft = {
   code: string
   title: string
   description: string
   type: 'FlatRate' | 'Free' | 'FreeAbove'
   amount: string
   freeAbove: string
   sortOrder: string
   allowedCities: string
}

const emptyDraft: Draft = {
   code: '',
   title: '',
   description: '',
   type: 'FlatRate',
   amount: '0',
   freeAbove: '',
   sortOrder: '0',
   allowedCities: '',
}

const inputClass = 'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary'
const methodLabel = (type: Method['type']) => ({
   FlatRate: 'هزینه ثابت',
   Free: 'ارسال رایگان',
   FreeAbove: 'رایگان بالاتر از مبلغ مشخص',
   CarrierCalculated: 'محاسبه توسط شرکت حمل‌ونقل (هنوز متصل نیست)',
})[type]

export default function ShippingPage() {
   const [methods, setMethods] = useState<Method[]>([])
   const [draft, setDraft] = useState<Draft>(emptyDraft)
   const [editingId, setEditingId] = useState('')
   const [loading, setLoading] = useState(true)
   const [saving, setSaving] = useState(false)
   const [message, setMessage] = useState('')
   const [error, setError] = useState(false)

   const load = useCallback(async () => {
      setLoading(true)
      try {
         const response = await fetch('/api/admin/shipping-methods', { cache: 'no-store' })
         const data = await response.json()
         if (!response.ok) throw new Error('دریافت روش‌های ارسال انجام نشد.')
         setMethods(data)
         setError(false)
      } catch (reason) {
         setMessage(reason instanceof Error ? reason.message : 'خطا در دریافت اطلاعات')
         setError(true)
      } finally {
         setLoading(false)
      }
   }, [])

   useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
      void load()
   }, [load])

   function resetForm() {
      setDraft(emptyDraft)
      setEditingId('')
   }

   async function save(event: FormEvent<HTMLFormElement>) {
      event.preventDefault()
      setSaving(true)
      setMessage('')
      setError(false)

      const payload = {
         code: draft.code.trim().toLowerCase(),
         title: draft.title.trim(),
         description: draft.description.trim() || null,
         type: draft.type,
         amount: Number(draft.amount || 0),
         freeAbove: draft.type === 'FreeAbove' ? Number(draft.freeAbove) : null,
         sortOrder: Number(draft.sortOrder || 0),
         ...(editingId ? {} : { isActive: true }),
         allowedCities: draft.allowedCities.split(',').map((city) => city.trim()).filter(Boolean),
      }

      try {
         const response = await fetch(
            editingId ? `/api/admin/shipping-methods/${editingId}` : '/api/admin/shipping-methods',
            {
               method: editingId ? 'PATCH' : 'POST',
               headers: { 'content-type': 'application/json' },
               body: JSON.stringify(payload),
            }
         )
         const result = await response.json()
         if (!response.ok) throw new Error(result.message || 'ذخیره روش ارسال ناموفق بود.')
         setMessage('روش ارسال ذخیره شد.')
         resetForm()
         await load()
      } catch (reason) {
         setMessage(reason instanceof Error ? reason.message : 'ذخیره روش ارسال ناموفق بود.')
         setError(true)
      } finally {
         setSaving(false)
      }
   }

   function edit(method: Method) {
      setEditingId(method.id)
      setDraft({
         code: method.code,
         title: method.title,
         description: method.description ?? '',
         type: method.type === 'CarrierCalculated' ? 'FlatRate' : method.type,
         amount: String(method.amount),
         freeAbove: method.freeAbove == null ? '' : String(method.freeAbove),
         sortOrder: String(method.sortOrder),
         allowedCities: method.allowedCities.join(', '),
      })
   }

   async function toggle(method: Method) {
      try {
         const response = await fetch(`/api/admin/shipping-methods/${method.id}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ isActive: !method.isActive }),
         })
         if (!response.ok) throw new Error()
         await load()
      } catch {
         setMessage('تغییر وضعیت روش ارسال انجام نشد.')
         setError(true)
      }
   }

   async function disable(method: Method) {
      if (!window.confirm('این روش ارسال غیرفعال شود؟ سفارش‌های قبلی بدون تغییر می‌مانند.')) return
      try {
         const response = await fetch(`/api/admin/shipping-methods/${method.id}`, { method: 'DELETE' })
         if (!response.ok) throw new Error()
         setMessage('روش ارسال غیرفعال شد.')
         await load()
      } catch {
         setMessage('غیرفعال‌سازی روش ارسال انجام نشد.')
         setError(true)
      }
   }

   return (
      <main className="my-6 space-y-6" dir="rtl">
         <header>
            <p className="text-sm text-muted-foreground">مدیریت فروشگاه</p>
            <h1 className="mt-1 text-2xl font-bold">روش‌های ارسال</h1>
            <p className="mt-2 text-sm text-muted-foreground">
               هزینه ثابت، ارسال رایگان و ارسال رایگان برای سفارش‌های بالاتر از مبلغ تعیین‌شده را مدیریت کنید.
            </p>
         </header>

         {message && <p role={error ? 'alert' : 'status'} className="rounded-lg border p-3 text-sm">{message}</p>}

         <section className="rounded-xl border p-5">
            <h2 className="mb-4 text-lg font-semibold">{editingId ? 'ویرایش روش ارسال' : 'افزودن روش ارسال'}</h2>
            <form onSubmit={(event) => { void save(event) }} className="grid gap-4 sm:grid-cols-2">
               <label className="space-y-1 text-sm">
                  <span>کد یکتا (انگلیسی)</span>
                  <input className={inputClass} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} />
               </label>
               <label className="space-y-1 text-sm">
                  <span>عنوان نمایشی</span>
                  <input className={inputClass} required minLength={2} maxLength={100} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
               </label>
               <label className="space-y-1 text-sm">
                  <span>نوع روش ارسال</span>
                  <select className={inputClass} value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as Draft['type'] })}>
                     <option value="FlatRate">هزینه ثابت</option>
                     <option value="Free">ارسال رایگان</option>
                     <option value="FreeAbove">رایگان بالاتر از مبلغ مشخص</option>
                  </select>
               </label>
               <label className="space-y-1 text-sm">
                  <span>هزینه ارسال (تومان)</span>
                  <input className={inputClass} type="number" min="0" step="1" value={draft.amount} disabled={draft.type === 'Free'} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} />
               </label>
               {draft.type === 'FreeAbove' && (
                  <label className="space-y-1 text-sm">
                     <span>حداقل مبلغ سفارش برای ارسال رایگان (تومان)</span>
                     <input className={inputClass} type="number" min="0" step="1" required value={draft.freeAbove} onChange={(event) => setDraft({ ...draft, freeAbove: event.target.value })} />
                  </label>
               )}
               <label className="space-y-1 text-sm">
                  <span>اولویت نمایش (عدد کمتر زودتر)</span>
                  <input className={inputClass} type="number" min="0" step="1" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })} />
               </label>
               <label className="space-y-1 text-sm sm:col-span-2">
                  <span>شهرهای مجاز (با کاما جدا کنید؛ خالی یعنی همه شهرها)</span>
                  <input className={inputClass} value={draft.allowedCities} onChange={(event) => setDraft({ ...draft, allowedCities: event.target.value })} placeholder="تهران، کرج، اصفهان" />
               </label>
               <label className="space-y-1 text-sm sm:col-span-2">
                  <span>توضیحات (اختیاری)</span>
                  <input className={inputClass} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} maxLength={500} />
               </label>
               <div className="flex gap-2 sm:col-span-2">
                  <button type="submit" disabled={saving} className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                     {saving ? 'در حال ذخیره...' : editingId ? 'ذخیره تغییرات' : 'افزودن روش ارسال'}
                  </button>
                  {editingId && <button type="button" onClick={resetForm} className="rounded-lg border px-5 py-2 text-sm">انصراف</button>}
               </div>
            </form>
         </section>

         <section className="space-y-3">
            <h2 className="text-lg font-semibold">روش‌های ثبت‌شده ({methods.length})</h2>
            {loading ? <p className="text-sm text-muted-foreground">در حال بارگذاری...</p> : methods.length === 0 ? (
               <p className="rounded-lg border p-5 text-sm text-muted-foreground">هنوز روش ارسالی ثبت نشده است.</p>
            ) : methods.map((method) => (
               <article key={method.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
                  <div className="min-w-0 space-y-1">
                     <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{method.title}</h3>
                        <span className="rounded-full border px-2 py-0.5 text-xs">{method.isActive ? 'فعال' : 'غیرفعال'}</span>
                     </div>
                     <p className="text-xs text-muted-foreground">{method.code} · {methodLabel(method.type)}</p>
                     <p className="text-sm">{method.type === 'Free' ? 'رایگان' : method.type === 'FreeAbove' ? `رایگان از ${method.freeAbove?.toLocaleString('fa-IR')} تومان؛ در غیر این صورت ${method.amount.toLocaleString('fa-IR')} تومان` : `${method.amount.toLocaleString('fa-IR')} تومان`}</p>
                     <p className="text-xs text-muted-foreground">{method.allowedCities.length ? method.allowedCities.join('، ') : 'همه شهرها'} · {method._count?.orders ?? 0} سفارش مرتبط</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                     <button type="button" onClick={() => edit(method)} disabled={method.type === 'CarrierCalculated'} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40">ویرایش</button>
                     <button type="button" onClick={() => void toggle(method)} className="rounded-lg border px-3 py-2 text-xs">{method.isActive ? 'غیرفعال‌کردن' : 'فعال‌کردن'}</button>
                     <button type="button" onClick={() => void disable(method)} disabled={!method.isActive} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40">حذف / توقف</button>
                  </div>
               </article>
            ))}
         </section>

         <aside className="rounded-lg border p-4 text-sm leading-7 text-muted-foreground">
            اتصال زندهٔ API پست، تیپاکس و چاپار هنوز در این مرحله فعال نیست. روش‌های «محاسبه توسط شرکت حمل‌ونقل» تا زمان پیاده‌سازی و آزمون رسمی استعلام کرایه، در checkout قابل انتخاب نخواهند بود.
         </aside>
      </main>
   )
}
