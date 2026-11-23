'use client'

import { AlertModal } from '@/components/admin/modals/alert-modal'
import { Button } from '@/components/admin/ui/button'
import {
   Form,
   FormControl,
   FormField,
   FormItem,
   FormLabel,
   FormMessage,
} from '@/components/admin/ui/form'
import { Heading } from '@/components/admin/ui/heading'
import { Input } from '@/components/admin/ui/input'
import { Separator } from '@/components/admin/ui/separator'
import type { Brand } from '@/generated/prisma/client'
import { zodResolver } from '@hookform/resolvers/zod'
import { Trash } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'react-hot-toast'
import * as z from 'zod'

const formSchema = z.object({
   title: z.string().min(2),
   description: z.string().max(500).nullable().optional(),
   logo: z.union([z.url(), z.literal('')]).nullable().optional(),
})

type BrandFormValues = z.infer<typeof formSchema>

interface BrandFormProps {
   initialData: Brand | null
}

export const BrandForm: React.FC<BrandFormProps> = ({ initialData }) => {
   const params = useParams()
   const router = useRouter()

   const [open, setOpen] = useState(false)
   const [loading, setLoading] = useState(false)

   const title = initialData ? 'Edit Brand' : 'Create Brand'
   const description = initialData ? 'Edit a brand.' : 'Add a new brand'
   const toastMessage = initialData ? 'Brand updated.' : 'Brand created.'
   const action = initialData ? 'Save changes' : 'Create'

   const form = useForm<BrandFormValues>({
      resolver: zodResolver(formSchema),
      defaultValues: initialData || {
         title: '',
         description: '',
         logo: '',
      },
   })

   const onSubmit = async (data: BrandFormValues) => {
      try {
         setLoading(true)
         const response = await (initialData
            ? fetch(`/api/admin/brands/${String(params.brandId)}`, {
                 method: 'PATCH',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(data),
                 cache: 'no-store',
              })
            : fetch(`/api/admin/brands`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(data),
                 cache: 'no-store',
              }))
         if (!response.ok) throw new Error('Brand save failed')
         router.refresh()
         router.push(`/admin/brands`)
         toast.success(toastMessage)
      } catch {
         toast.error('Something went wrong.')
      } finally {
         setLoading(false)
      }
   }

   const onDelete = async () => {
      try {
         setLoading(true)

         const response = await fetch(`/api/admin/brands/${String(params.brandId)}`, {
            method: 'DELETE',
            cache: 'no-store',
         })
         if (!response.ok) throw new Error('Brand delete failed')

         router.refresh()
         router.push(`/admin/brands`)
         toast.success('Brand deleted.')
      } catch {
         toast.error(
            'Make sure you removed all products using this brand first.'
         )
      } finally {
         setLoading(false)
         setOpen(false)
      }
   }

   return (
      <>
         <AlertModal
            isOpen={open}
            onClose={() => {
               setOpen(false)
            }}
            onConfirm={() => {
               void onDelete()
            }}
            loading={loading}
         />
         <div className="flex items-center justify-between">
            <Heading title={title} description={description} />
            {initialData && (
               <Button
                  disabled={loading}
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                     setOpen(true)
                  }}
               >
                  <Trash className="h-4" />
               </Button>
            )}
         </div>
         <Separator />
         <Form {...form}>
            <form
               onSubmit={(event) => {
                  void form.handleSubmit(onSubmit)(event)
               }}
               className="space-y-8 w-full"
            >
               <div className="md:grid md:grid-cols-3 gap-8">
                  <FormField
                     control={form.control}
                     name="title"
                     render={({ field }) => (
                        <FormItem>
                           <FormLabel>Title</FormLabel>
                           <FormControl>
                              <Input
                                 disabled={loading}
                                 placeholder="Brand title"
                                 {...field}
                                 value={field.value ?? ''}
                              />
                           </FormControl>
                           <FormMessage />
                        </FormItem>
                     )}
                  />
                  <FormField
                     control={form.control}
                     name="description"
                     render={({ field }) => (
                        <FormItem>
                           <FormLabel>Description</FormLabel>
                           <FormControl>
                              <Input
                                 disabled={loading}
                                 placeholder="Brand description"
                                 {...field}
                              />
                           </FormControl>
                           <FormMessage />
                        </FormItem>
                     )}
                  />
                  <FormField
                     control={form.control}
                     name="logo"
                     render={({ field }) => (
                        <FormItem>
                           <FormLabel>Logo URL</FormLabel>
                           <FormControl>
                              <Input
                                 disabled={loading}
                                 placeholder="https://example.com/logo.png"
                                 {...field}
                              />
                           </FormControl>
                           <FormMessage />
                        </FormItem>
                     )}
                  />
               </div>
               <Button disabled={loading} className="ml-auto" type="submit">
                  {action}
               </Button>
            </form>
         </Form>
      </>
   )
}
