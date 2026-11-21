'use client'

import { Button } from '@/components/admin/ui/button'
import { Checkbox } from '@/components/admin/ui/checkbox'
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
import type { OrderWithIncludes } from '@/types/prisma'
import { zodResolver } from '@hookform/resolvers/zod'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { type Resolver, useForm } from 'react-hook-form'
import { toast } from 'react-hot-toast'
import * as z from 'zod'

const formSchema = z.object({
   status: z.string().min(1),
   shipping: z.coerce.number().min(1),
   payable: z.coerce.number().min(1),
   discount: z.coerce.number().min(0),
   isPaid: z.boolean().default(false).optional(),
   isCompleted: z.boolean().default(false).optional(),
   shippingTrackingNumber: z.string().max(100),
})

type ProductFormValues = z.infer<typeof formSchema>

interface ProductFormProps {
   initialData: OrderWithIncludes | null
}

export const OrderForm: React.FC<ProductFormProps> = ({ initialData }) => {
   const params = useParams()
   const router = useRouter()

   const [loading, setLoading] = useState(false)

   const toastMessage = 'Order updated.'
   const action = 'Save changes'

   const defaultValues = initialData
      ? {
           ...initialData,
           shippingTrackingNumber: initialData.shippingTrackingNumber ?? '',
        }
      : {
           status: '---',
           shipping: 0,
           payable: 0,
           discount: 0,
           isPaid: false,
           isCompleted: false,
           shippingTrackingNumber: '',
        }

   const form = useForm<ProductFormValues>({
      resolver: zodResolver(
         formSchema
      ) as unknown as Resolver<ProductFormValues>,
      defaultValues,
   })

   const onSubmit = async (data: ProductFormValues) => {
      try {
         setLoading(true)

         /* These rows already exist — the admin panel edits, it never creates a
            user, an order or a payment out of thin air. */
         const response = await fetch(
            `/api/admin/orders/${String(params.orderId)}`,
            {
               method: 'PATCH',
               headers: { 'content-type': 'application/json' },
               body: JSON.stringify(data),
               cache: 'no-store',
            }
         )

         /* A failed PATCH has to be visible: silently claiming success is how a
            broken control stays broken for months. */
         if (!response.ok) {
            const problem = await response.json().catch(() => null)
            throw new Error(problem?.message ?? `${response.status}`)
         }

         router.refresh()
         router.push(`/admin/orders`)
         toast.success(toastMessage)
      } catch (error) {
         toast.error(
            error instanceof Error ? error.message : 'Something went wrong.'
         )
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
            className="block space-y-2 w-full"
         >
            <FormField
               control={form.control}
               name="shipping"
               render={({ field }) => (
                  <FormItem>
                     <FormLabel>Price</FormLabel>
                     <FormControl>
                        <Input
                           type="number"
                           disabled={loading}
                           placeholder="9.99"
                           {...field}
                        />
                     </FormControl>
                     <FormMessage />
                  </FormItem>
               )}
            />
            <FormField
               control={form.control}
               name="payable"
               render={({ field }) => (
                  <FormItem>
                     <FormLabel>Discount</FormLabel>
                     <FormControl>
                        <Input
                           type="number"
                           disabled={loading}
                           placeholder="9.99"
                           {...field}
                        />
                     </FormControl>
                     <FormMessage />
                  </FormItem>
               )}
            />
            <FormField
               control={form.control}
               name="discount"
               render={({ field }) => (
                  <FormItem>
                     <FormLabel>Discount</FormLabel>
                     <FormControl>
                        <Input
                           type="number"
                           disabled={loading}
                           placeholder="9.99"
                           {...field}
                        />
                     </FormControl>
                     <FormMessage />
                  </FormItem>
               )}
            />
            <FormField
               control={form.control}
               name="isPaid"
               render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                     <FormControl>
                        <Checkbox
                           checked={field.value}
                           onCheckedChange={field.onChange}
                        />
                     </FormControl>
                     <div className="space-y-1 leading-none">
                        <FormLabel>Featured</FormLabel>
                        <FormDescription>
                           This product will appear on the home page
                        </FormDescription>
                     </div>
                  </FormItem>
               )}
            />
            <FormField
               control={form.control}
               name="isCompleted"
               render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                     <FormControl>
                        <Checkbox
                           checked={field.value}
                           onCheckedChange={field.onChange}
                        />
                     </FormControl>
                     <div className="space-y-1 leading-none">
                        <FormLabel>Available</FormLabel>
                        <FormDescription>
                           This product will appear in the store.
                        </FormDescription>
                     </div>
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
                     <FormDescription>در صورت نداشتن کد، این فیلد را خالی بگذارید.</FormDescription>
                     <FormMessage />
                  </FormItem>
               )}
            />
            <Button disabled={loading} className="ml-auto" type="submit">
               {action}
            </Button>
         </form>
      </Form>
   )
}
