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
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from '@/components/admin/ui/select'
import { Separator } from '@/components/admin/ui/separator'
import type { Banner, Category } from '@/generated/prisma/client'
import { zodResolver } from '@hookform/resolvers/zod'
import { Trash } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'react-hot-toast'
import * as z from 'zod'

const formSchema = z.object({
   title: z.string().min(2),
   description: z.string().min(1),
})

type CategoryFormValues = z.infer<typeof formSchema>

interface CategoryFormProps {
   initialData: Category | null
   banners: Banner[]
}

export const CategoryForm: React.FC<CategoryFormProps> = ({
   initialData,
   banners,
}) => {
   const params = useParams()
   const router = useRouter()

   const [open, setOpen] = useState(false)
   const [loading, setLoading] = useState(false)

   const title = initialData ? 'Edit category' : 'Create category'
   const description = initialData ? 'Edit a category.' : 'Add a new category'
   const toastMessage = initialData ? 'Category updated.' : 'Category created.'
   const action = initialData ? 'Save changes' : 'Create'

   const form = useForm<CategoryFormValues>({
      resolver: zodResolver(formSchema),
      defaultValues: initialData || {
         title: '',
         description: '',
      },
   })

   const onSubmit = async (data: CategoryFormValues) => {
      try {
         setLoading(true)
         await (initialData
            ? fetch(`/api/admin/categories/${String(params.categoryId)}`, {
                 method: 'PATCH',
                 body: JSON.stringify(data),
                 cache: 'no-store',
              })
            : fetch(`/api/admin/categories`, {
                 method: 'POST',
                 body: JSON.stringify(data),
                 cache: 'no-store',
              }))
         router.refresh()
         router.push(`/admin/categories`)
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

         await fetch(`/api/admin/categories/${String(params.categoryId)}`, {
            method: 'DELETE',
            cache: 'no-store',
         })

         router.refresh()
         router.push(`/admin/categories`)
         toast.success('Category deleted.')
      } catch {
         toast.error(
            'Make sure you removed all products using this category first.'
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
                           <FormLabel>Name</FormLabel>
                           <FormControl>
                              <Input
                                 disabled={loading}
                                 placeholder="Category name"
                                 {...field}
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
                           <FormLabel>Banner</FormLabel>
                           <Select
                              disabled={loading}
                              onValueChange={field.onChange}
                              value={field.value}
                              defaultValue={field.value}
                           >
                              <FormControl>
                                 <SelectTrigger>
                                    <SelectValue
                                       defaultValue={field.value}
                                       placeholder="Select a banner"
                                    />
                                 </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                 {banners.map((banner) => (
                                    <SelectItem
                                       key={banner.id}
                                       value={banner.id}
                                    >
                                       {banner.label}
                                    </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
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
