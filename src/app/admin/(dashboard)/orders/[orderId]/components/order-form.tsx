'use client'

import { Button } from '@/components/admin/ui/button'
import {
   Form,
   FormControl,
   FormDescription,
   FormField,
   FormItem,
   FormLabel,
   FormMessage,
} from '@/components/admin/ui/form'
import { Input } from '@/components/admin/ui/input'
import {
   getNextOrderStatuses,
   ORDER_STATUSES,
   ORDER_STATUS_LABELS,
} from '@/lib/order-status'
import type { OrderWithIncludes } from '@/types/prisma'
import { zodResolver } from '@hookform/resolvers/zod'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { type Resolver, useForm } from 'react-hook-form'
import * as z from 'zod'

const formSchema = z.object({
   status: z.enum(ORDER_STATUSES),
   shippingTrackingNumber: z.string().max(100),
})

type OrderFormValues = z.infer<typeof formSchema>

interface OrderFormProps {
   initialData: OrderWithIncludes | null
}

export const OrderForm: React.FC<OrderFormProps> = ({ initialData }) => {
   const params = useParams()
   const router = useRouter()
   const [loading, setLoading] = useState(false)

   const currentStatus = initialData?.status ?? 'PendingPayment'
   const nextStatuses = getNextOrderStatuses(currentStatus)

   const form = useForm<OrderFormValues>({
      resolver: zodResolver(formSchema) as unknown as Resolver<OrderFormValues>,
      defaultValues: {
         status: currentStatus as (typeof ORDER_STATUSES)[number],
         shippingTrackingNumber: initialData?.shippingTrackingNumber ?? '',
      },
   })

   const onSubmit = async (data: OrderFormValues) => {
      try {
         setLoading(true)
         const response = await fetch(
            `/api/admin/orders/${String(params.orderId)}`,
            {
               method: 'PATCH',
               headers: { 'content-type': 'application/json' },
               body: JSON.stringify(data),
               cache: 'no-store',
            }
         )

         if (!response.ok) {
            const problem = await response.json().catch(() => null)
            throw new Error(problem?.message ?? `${response.status}`)
         }

         router.refresh()
         router.push('/admin/orders')
         const { toast } = await import('react-hot-toast')
         toast.success('Order updated.')
      } catch (error) {
         const { toast } = await import('react-hot-toast')
         toast.error(error instanceof Error ? error.message : 'Something went wrong.')
      } finally {
         setLoading(false)
      }
   }

   return (
      <Form {...form}>
         <form
            onSubmit={(event) => {
               void form.handleSubmit(onSubmit)(event)
            }}
            className="block w-full space-y-2"
         >
            <FormField
               control={form.control}
               name="status"
               render={({ field }) => (
                  <FormItem>
                     <FormLabel>وضعیت سفارش</FormLabel>
                     <FormControl>
                        <select
                           className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                           disabled={loading || nextStatuses.length === 0}
                           value={field.value}
                           onChange={field.onChange}
                        >
                           <option value={currentStatus}>
                              {ORDER_STATUS_LABELS[currentStatus as (typeof ORDER_STATUSES)[number]] ?? currentStatus}
                           </option>
                           {nextStatuses.map((status) => (
                              <option key={status} value={status}>
                                 {ORDER_STATUS_LABELS[status]}
                              </option>
                           ))}
                        </select>
                     </FormControl>
                     <FormDescription>
                        وضعیت پرداخت از طریق تأیید درگاه مدیریت می‌شود؛ این بخش فقط مراحل ارسال را تغییر می‌دهد.
                     </FormDescription>
                     <FormMessage />
                  </FormItem>
               )}
            />
            <FormField
               control={form.control}
               name="shippingTrackingNumber"
               render={({ field }) => (
                  <FormItem>
                     <FormLabel>شماره مرسوله / کد رهگیری</FormLabel>
                     <FormControl>
                        <Input
                           disabled={loading}
                           placeholder="کد رهگیری را وارد کنید"
                           value={field.value}
                           onChange={field.onChange}
                        />
                     </FormControl>
                     <FormDescription>
                        برای تغییر وضعیت به «ارسال شده»، ثبت کد رهگیری الزامی است.
                     </FormDescription>
                     <FormMessage />
                  </FormItem>
               )}
            />
            <Button disabled={loading} className="ml-auto" type="submit">
               Save changes
            </Button>
         </form>
      </Form>
   )
}
