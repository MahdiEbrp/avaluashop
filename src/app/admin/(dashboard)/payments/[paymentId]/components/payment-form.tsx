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
})

type PaymentFormValues = z.infer<typeof formSchema>

interface PaymentFormProps {
   initialData: OrderWithIncludes | null
}

export const PaymentForm: React.FC<PaymentFormProps> = ({ initialData }) => {
   const params = useParams()
   const router = useRouter()

   const [loading, setLoading] = useState(false)

   const toastMessage = 'Order updated.'
   const action = 'Save changes'

   const defaultValues = initialData
      ? {
           ...initialData,
        }
      : {
           status: '---',
           shipping: 0,
           payable: 0,
           discount: 0,
           isPaid: false,
           isCompleted: false,
        }

   const form = useForm<PaymentFormValues>({
      resolver: zodResolver(
         formSchema
      ) as unknown as Resolver<PaymentFormValues>,
      defaultValues,
   })

   const onSubmit = async (data: PaymentFormValues) => {
      try {
         setLoading(true)

         /* These rows already exist — the admin panel edits, it never creates a
            user, an order or a payment out of thin air. */
         const response = await fetch(
            `/api/admin/payments/${String(params.paymentId)}`,
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
         router.push(`/admin/payments`)
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
            className="space-y-8 w-full"
         >
            <div>
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
            </div>
            <Button disabled={loading} className="ml-auto" type="submit">
               {action}
            </Button>
         </form>
      </Form>
   )
}
