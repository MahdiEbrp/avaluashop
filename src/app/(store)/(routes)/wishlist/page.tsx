'use client'

import { ProductGrid } from '@/components/native/Product'
import { Heading } from '@/components/native/heading'
import { Button } from '@/components/ui/button'
import { useAuthenticated } from '@/hooks/useAuthentication'
import type { ProductWithIncludes } from '@/types/prisma'
import { HeartIcon } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function WishlistPage() {
   const { authenticated } = useAuthenticated()
   const [products, setProducts] = useState<ProductWithIncludes[]>([])
   const [loading, setLoading] = useState(true)

   useEffect(() => {
      async function getWishlist() {
         try {
            setLoading(true)
            const response = await fetch('/api/wishlist', {
               cache: 'no-store',
            })
            const result: unknown = await response.json()
            setProducts(
               Array.isArray(result) ? (result as ProductWithIncludes[]) : []
            )
         } catch (error) {
            console.error({ error })
         } finally {
            setLoading(false)
         }
      }

      if (authenticated) void getWishlist()
   }, [authenticated])

   function renderWishlistBody() {
      if (!authenticated) {
         return (
            <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
               <HeartIcon className="mx-auto h-8 w-8 text-primary" />
               <p className="mt-3 font-semibold">
                  برای دیدن علاقه‌مندی‌ها وارد حساب خود شوید.
               </p>
               <Button asChild className="mt-5">
                  <Link href="/login">ورود به حساب</Link>
               </Button>
            </div>
         )
      }
      if (loading) {
         return (
            <div
               role="status"
               className="rounded-2xl border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground"
            >
               در حال دریافت علاقه‌مندی‌ها...
            </div>
         )
      }
      if (products.length > 0) {
         return <ProductGrid products={products} />
      }
      return (
         <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <HeartIcon className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3 font-semibold">هنوز محصولی ذخیره نکرده‌اید.</p>
            <p className="mt-2 text-sm text-muted-foreground">
               در صفحه هر محصول می‌توانید آن را به علاقه‌مندی‌ها اضافه کنید.
            </p>
            <Button asChild className="mt-5">
               <Link href="/products">گشت‌وگذار در فروشگاه</Link>
            </Button>
         </div>
      )
   }

   return (
      <div dir="rtl" className="pb-8">
         <Heading
            title="علاقه‌مندی‌های من"
            description="محصولاتی که برای بررسی یا خرید بعدی ذخیره کرده‌اید."
         />
         {renderWishlistBody()}
      </div>
   )
}
