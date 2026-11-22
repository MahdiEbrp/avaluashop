'use client'

import { AlertModal } from '@/components/admin/modals/alert-modal'
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
import { Heading } from '@/components/admin/ui/heading'
import ImageUpload from '@/components/admin/ui/image-upload'
import { Input } from '@/components/admin/ui/input'
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from '@/components/admin/ui/select'
import { Separator } from '@/components/admin/ui/separator'
import type { Brand, Category } from '@/generated/prisma/client'
import type { ProductWithIncludes } from '@/types/prisma'
import { zodResolver } from '@hookform/resolvers/zod'
import { Trash } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { type Resolver, useForm } from 'react-hook-form'
import { toast } from 'react-hot-toast'
import * as z from 'zod'

const formSchema = z.object({
   title: z.string().min(1),
   images: z.string().array(),
   price: z.coerce.number().min(1),
   discount: z.coerce.number().min(0),
   stock: z.coerce.number().min(0),
   categoryId: z.string().min(1),
   brandId: z.string().min(1),
   isFeatured: z.boolean().default(false).optional(),
   isAvailable: z.boolean().default(false).optional(),
})

type ProductFormValues = z.infer<typeof formSchema>

interface ProductFormProps {
   initialData: ProductWithIncludes | null
   categories: Category[]
   brands: Brand[]
}

export const ProductForm: React.FC<ProductFormProps> = ({
   initialData,
   categories,
   brands,
}) => {
   const params = useParams()
   const router = useRouter()

   const [open, setOpen] = useState(false)
   const [loading, setLoading] = useState(false)

   const title = initialData ? 'Edit product' : 'Create product'
   const description = initialData ? 'Edit a product.' : 'Add a new product'
   const toastMessage = initialData ? 'Product updated.' : 'Product created.'
   const action = initialData ? 'Save changes' : 'Create'

   const defaultValues = initialData
      ? {
           ...initialData,
           categoryId: initialData.categories[0]?.id ?? '',
           brandId: initialData.brandId,
           price: Number.parseFloat(initialData.price.toFixed(2)),
           discount: Number.parseFloat(initialData.discount.toFixed(2)),
        }
      : {
           title: '---',
           description: '---',
           images: [],
           price: 0,
           discount: 0,
           stock: 0,
           categoryId: '',
           brandId: '',
           isFeatured: false,
           isAvailable: false,
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

         const response = await (initialData
            ? fetch(`/api/admin/products/${String(params.productId)}`, {
                 method: 'PATCH',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(data),
                 cache: 'no-store',
              })
            : fetch(`/api/admin/products`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(data),
                 cache: 'no-store',
              }))

         if (!response.ok) throw new Error('Product save failed')

         router.refresh()
         router.push(`/admin/products`)
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

         const response = await fetch(`/api/admin/products/${String(params.productId)}`, {
            method: 'DELETE',
            cache: 'no-store',
         })
         if (!response.ok) throw new Error('Product delete failed')

         router.refresh()
         router.push(`/admin/products`)
         toast.success('Product deleted.')
      } catch {
         toast.error('Something went wrong.')
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
                  name="images"
                  render={({ field }) => (
                     <FormItem>
                        <FormLabel>Images</FormLabel>
                        <FormControl>
                           <ImageUpload
                              value={field.value.map((image) => image)}
                              disabled={loading}
                              onChange={(url) => {
                                 field.onChange([...field.value, url])
                              }}
                              onRemove={(url) => {
                                 field.onChange([
                                    ...field.value.filter(
                                       (current) => current !== url
                                    ),
                                 ])
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
                     name="title"
                     render={({ field }) => (
                        <FormItem>
                           <FormLabel>Name</FormLabel>
                           <FormControl>
                              <Input
                                 disabled={loading}
                                 placeholder="Product title"
                                 {...field}
                              />
                           </FormControl>
                           <FormMessage />
                        </FormItem>
                     )}
                  />
                  <FormField
                     control={form.control}
                     name="price"
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
                     name="stock"
                     render={({ field }) => (
                        <FormItem>
                           <FormLabel>Stock</FormLabel>
                           <FormControl>
                              <Input
                                 type="number"
                                 disabled={loading}
                                 placeholder="10"
                                 {...field}
                              />
                           </FormControl>
                           <FormMessage />
                        </FormItem>
                     )}
                  />
                  <FormField
                     control={form.control}
                     name="categoryId"
                     render={({ field }) => (
                        <FormItem>
                           <FormLabel>Category</FormLabel>
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
                                       placeholder="Select a category"
                                    />
                                 </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                 {categories.map((category) => (
                                    <SelectItem
                                       key={category.id}
                                       value={category.id}
                                    >
                                       {category.title}
                                    </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                           <FormMessage />
                        </FormItem>
                     )}
                  />
                  <FormField
                     control={form.control}
                     name="brandId"
                     render={({ field }) => (
                        <FormItem>
                           <FormLabel>Brand</FormLabel>
                           <Select
                              disabled={loading}
                              onValueChange={field.onChange}
                              value={field.value}
                           >
                              <FormControl>
                                 <SelectTrigger>
                                    <SelectValue placeholder="Select a brand" />
                                 </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                 {brands.map((brand) => (
                                    <SelectItem key={brand.id} value={brand.id}>
                                       {brand.title}
                                    </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                           <FormMessage />
                        </FormItem>
                     )}
                  />
                  <FormField
                     control={form.control}
                     name="isFeatured"
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
                     name="isAvailable"
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
      </>
   )
}
