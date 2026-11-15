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
import ImageUpload from '@/components/admin/ui/image-upload'
import { Input } from '@/components/admin/ui/input'
import { Separator } from '@/components/admin/ui/separator'
import type { Banner } from '@/generated/prisma/client'
import { zodResolver } from '@hookform/resolvers/zod'
import { Trash } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'react-hot-toast'
import * as z from 'zod'

const formSchema = z.object({
   label: z.string().min(1),
   image: z.string().min(1),
})

type BannerFormValues = z.infer<typeof formSchema>

interface BannerFormProps {
   initialData: Banner | null
}

export const BannerForm: React.FC<BannerFormProps> = ({ initialData }) => {
   const params = useParams()
   const router = useRouter()

   const [open, setOpen] = useState(false)
   const [loading, setLoading] = useState(false)

   const title = initialData ? 'Edit banner' : 'Create banner'
   const description = initialData ? 'Edit a banner.' : 'Add a new banner'
   const toastMessage = initialData ? 'Banner updated.' : 'Banner created.'
   const action = initialData ? 'Save changes' : 'Create'

   const form = useForm<BannerFormValues>({
      resolver: zodResolver(formSchema),
      defaultValues: initialData || {
         label: '',
         image: '',
      },
   })

   const onSubmit = async (data: BannerFormValues) => {
      try {
         setLoading(true)
         await (initialData
            ? fetch(`/api/admin/banners/${String(params.bannerId)}`, {
                 method: 'PATCH',
                 headers: { 'content-type': 'application/json' },
                 body: JSON.stringify(data),
                 cache: 'no-store',
              })
            : fetch(`/api/admin/banners`, {
                 method: 'POST',
                 headers: { 'content-type': 'application/json' },
                 body: JSON.stringify(data),
                 cache: 'no-store',
              }))
         router.refresh()
         router.push(`/admin/banners`)
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

         await fetch(`/api/admin/banners/${String(params.bannerId)}`, {
            method: 'DELETE',
            cache: 'no-store',
         })

         router.refresh()
         router.push(`/admin/banners`)
         toast.success('Banner deleted.')
      } catch {
         toast.error(
            'Make sure you removed all categories using this banner first.'
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
               <FormField
                  control={form.control}
                  name="image"
                  render={({ field }) => (
                     <FormItem>
                        <FormLabel>Background image</FormLabel>
                        <FormControl>
                           <ImageUpload
                              value={field.value ? [field.value] : []}
                              disabled={loading}
                              onChange={(url) => {
                                 field.onChange(url)
                              }}
                              onRemove={() => {
                                 field.onChange('')
                              }}
                           />
                        </FormControl>
                        <FormMessage />
                     </FormItem>
                  )}
               />
               <div className="md:grid md:grid-cols-3 gap-8">
                  <FormField
                     control={form.control}
                     name="label"
                     render={({ field }) => (
                        <FormItem>
                           <FormLabel>Label</FormLabel>
                           <FormControl>
                              <Input
                                 disabled={loading}
                                 placeholder="Banner label"
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
