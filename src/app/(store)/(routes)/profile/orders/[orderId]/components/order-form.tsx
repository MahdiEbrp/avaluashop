'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
   Form,
   FormControl,
   FormDescription,
   FormField,
   FormItem,
   FormLabel,
   FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
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

type ProductFormValues = z.output<typeof formSchema>

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
        }
      : {
           status: '---',
           shipping: 0,
           payable: 0,
           discount: 0,
           isPaid: false,
           isCompleted: false,
        }

   const form = useForm<ProductFormValues>({
      // zod 4 types `z.coerce.number()` as `unknown` on input, which makes the
      // resolver's generic incompatible with the form's output type. The cast is
      // safe: zod still coerces the submitted strings to numbers at runtime.
      resolver: zodResolver(
         formSchema
      ) as unknown as Resolver<ProductFormValues>,
      defaultValues,
   })

   const onSubmit = async (data: ProductFormValues) => {
      try {
         setLoading(true)

         await (initialData
            ? fetch(`/api/products/${String(params.productId)}`, {
                 method: 'PATCH',
                 body: JSON.stringify({ data }),
                 cache: 'no-store',
              })
            : fetch(`/api/products`, {
                 method: 'POST',
                 body: JSON.stringify({ data }),
                 cache: 'no-store',
              }))

         router.refresh()
         router.push(`/products`)
         toast.success(toastMessage)
      } catch {
         toast.error('Something went wrong.')
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
                  <div className="rounded-md border p-4">
                     <FormItem className="flex flex-row items-start space-x-3 space-y-0">
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
                  </div>
               )}
            />
            <FormField
               control={form.control}
               name="isCompleted"
               render={({ field }) => (
                  <div className="rounded-md border p-4">
                     <FormItem className="flex flex-row items-start space-x-3 space-y-0">
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
                  </div>
               )}
            />
            <Button disabled={loading} className="ml-auto" type="submit">
               {action}
            </Button>
         </form>
      </Form>
   )
}
