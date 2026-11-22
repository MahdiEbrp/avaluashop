'use client'

import { useEffect, useState } from 'react'

type DiscountCode = {
   id: string
   code: string
   description: string | null
   percent: number
   stock: number
   maxDiscountAmount: number
   startDate: string
   endDate: string
   createdAt: string
   _count?: { order: number }
}

const today = () => new Date().toISOString().slice(0, 10)
const formatDate = (value: string) =>
   new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(value))

export function DiscountCodesClient() {
   const [codes, setCodes] = useState<DiscountCode[]>([])
   const [loading, setLoading] = useState(true)
   const [saving, setSaving] = useState(false)
   const [message, setMessage] = useState('')
   const [form, setForm] = useState({
      code: '',
      description: '',
      percent: '10',
      stock: '10',
      maxDiscountAmount: '500000',
      startDate: today(),
      endDate: '',
   })

   async function loadCodes() {
      setLoading(true)
      try {
         const response = await fetch('/api/admin/codes', { cache: 'no-store' })
         if (!response.ok) throw new Error('دریافت کدهای تخفیف ناموفق بود.')
         setCodes((await response.json()) as DiscountCode[])
      } catch (error) {
         setMessage(error instanceof Error ? error.message : 'خطای دریافت اطلاعات')
      } finally {
         setLoading(false)
      }
   }

   useEffect(() => {
      void loadCodes()
   }, [])

   async function createCode(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault()
      setSaving(true)
      setMessage('')
      try {
         const response = await fetch('/api/admin/codes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               ...form,
               percent: Number(form.percent),
               stock: Number(form.stock),
               maxDiscountAmount: Number(form.maxDiscountAmount),
               startDate: new Date(form.startDate + 'T00:00:00.000Z').toISOString(),
               endDate: new Date(form.endDate + 'T23:59:59.999Z').toISOString(),
            }),
         })
         const result = (await response.json()) as { message?: string }
         if (!response.ok) {
            const messages: Record<string, string> = {
               DISCOUNT_CODE_ALREADY_EXISTS: 'این کد تخفیف قبلاً ثبت شده است.',
               INVALID_DISCOUNT_CODE: 'اطلاعات کد تخفیف معتبر نیست.',
            }
            throw new Error(messages[result.message ?? ''] ?? 'ثبت کد تخفیف انجام نشد.')
         }
         setForm({ ...form, code: '', description: '' })
         setMessage('کد تخفیف با موفقیت ثبت شد.')
         await loadCodes()
      } catch (error) {
         setMessage(error instanceof Error ? error.message : 'ثبت کد تخفیف ناموفق بود.')
      } finally {
         setSaving(false)
      }
   }

   async function updateCode(code: DiscountCode) {
      setSaving(true)
      setMessage('')
      try {
         const response = await fetch('/api/admin/codes/' + code.id, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ percent: code.percent, stock: code.stock, description: code.description }),
         })
         if (!response.ok) throw new Error('ذخیره تغییرات انجام نشد.')
         setMessage('تغییرات ذخیره شد.')
         await loadCodes()
      } catch (error) {
         setMessage(error instanceof Error ? error.message : 'خطا در ذخیره')
      } finally {
         setSaving(false)
      }
   }

   async function deleteCode(code: DiscountCode) {
      if (!window.confirm('کد تخفیف ' + code.code + ' حذف شود؟')) return
      setSaving(true)
      setMessage('')
      try {
         const response = await fetch('/api/admin/codes/' + code.id, { method: 'DELETE' })
         const result = (await response.json()) as { message?: string }
         if (!response.ok) {
            if (result.message === 'DISCOUNT_CODE_IN_USE') {
               throw new Error('این کد در سفارش ثبت شده و برای حفظ سوابق قابل حذف نیست.')
            }
            throw new Error('حذف کد تخفیف انجام نشد.')
         }
         setMessage('کد تخفیف حذف شد.')
         await loadCodes()
      } catch (error) {
         setMessage(error instanceof Error ? error.message : 'خطا در حذف')
      } finally {
         setSaving(false)
      }
   }

   function patchLocal(id: string, patch: Partial<DiscountCode>) {
      setCodes((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item))
   }

   return (
      <div dir="rtl" className="space-y-8">
         <form onSubmit={(event) => void createCode(event)} className="grid gap-4 rounded-xl border p-4 md:grid-cols-3">
            <label className="space-y-1 text-sm">کد تخفیف
               <input required minLength={3} maxLength={40} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} className="w-full rounded-md border bg-background p-2" placeholder="مثلاً WINTER20" />
            </label>
            <label className="space-y-1 text-sm">درصد تخفیف
               <input required type="number" min="1" max="100" value={form.percent} onChange={(event) => setForm({ ...form, percent: event.target.value })} className="w-full rounded-md border bg-background p-2" />
            </label>
            <label className="space-y-1 text-sm">تعداد قابل استفاده
               <input required type="number" min="0" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} className="w-full rounded-md border bg-background p-2" />
            </label>
            <label className="space-y-1 text-sm">حداکثر مبلغ تخفیف (تومان)
               <input required type="number" min="1" value={form.maxDiscountAmount} onChange={(event) => setForm({ ...form, maxDiscountAmount: event.target.value })} className="w-full rounded-md border bg-background p-2" />
            </label>
            <label className="space-y-1 text-sm">تاریخ شروع
               <input required type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} className="w-full rounded-md border bg-background p-2" />
            </label>
            <label className="space-y-1 text-sm">تاریخ پایان
               <input required type="date" min={form.startDate} value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} className="w-full rounded-md border bg-background p-2" />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">توضیحات
               <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="w-full rounded-md border bg-background p-2" placeholder="توضیح کوتاه برای تیم فروش" />
            </label>
            <div className="flex items-end">
               <button disabled={saving} className="rounded-md bg-primary px-5 py-2 text-primary-foreground disabled:opacity-50" type="submit">ثبت کد تخفیف</button>
            </div>
         </form>

         {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}

         <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[760px] text-right text-sm">
               <thead className="bg-muted/50">
                  <tr>
                     <th className="p-3">کد</th>
                     <th className="p-3">درصد</th>
                     <th className="p-3">موجودی</th>
                     <th className="p-3">سفارش‌ها</th>
                     <th className="p-3">اعتبار</th>
                     <th className="p-3">عملیات</th>
                  </tr>
               </thead>
               <tbody>
                  {loading ? <tr><td className="p-4" colSpan={6}>در حال دریافت...</td></tr> : null}
                  {!loading && codes.length === 0 ? <tr><td className="p-4 text-muted-foreground" colSpan={6}>هنوز کد تخفیفی ثبت نشده است.</td></tr> : null}
                  {codes.map((code) => (
                     <tr key={code.id} className="border-t">
                        <td className="p-3"><strong dir="ltr">{code.code}</strong><div className="text-xs text-muted-foreground">{code.description}</div></td>
                        <td className="p-3"><input aria-label={'درصد ' + code.code} type="number" min="1" max="100" value={code.percent} onChange={(event) => patchLocal(code.id, { percent: Number(event.target.value) })} className="w-20 rounded border bg-background p-1" /></td>
                        <td className="p-3"><input aria-label={'موجودی ' + code.code} type="number" min="0" value={code.stock} onChange={(event) => patchLocal(code.id, { stock: Number(event.target.value) })} className="w-24 rounded border bg-background p-1" /></td>
                        <td className="p-3">{code._count?.order ?? 0}</td>
                        <td className="p-3">{formatDate(code.startDate)} تا {formatDate(code.endDate)}</td>
                        <td className="space-x-2 space-x-reverse p-3">
                           <button disabled={saving} onClick={() => void updateCode(code)} className="text-primary disabled:opacity-50">ذخیره</button>
                           <button disabled={saving || (code._count?.order ?? 0) > 0} onClick={() => void deleteCode(code)} className="text-destructive disabled:opacity-40">حذف</button>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
   )
}
