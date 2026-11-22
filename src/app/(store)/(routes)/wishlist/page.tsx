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
   const [error, setError] = useState('')

   useEffect(() => {
      if (!authenticated) {
         setLoading(false)
         return
      }

      const controller = new AbortController()

      async function getWishlist() {
         try {
            setLoading(true)
            setError('')
            const response = await fetch('/api/wishlist', {
               cache: 'no-store',
               signal: controller.signal,
            })
            if (!response.ok) throw new Error('دریافت علاقه‌مندی‌ها انجام نشد. دوباره تلاش کنید.')
            const result: unknown = await response.json()
            if (!Array.isArray(result)) throw new Error('پاسخ علاقه‌مندی‌ها معتبر نیست.')
            setProducts(result as ProductWithIncludes[])
         } catch (error_) {
            if (!controller.signal.aborted) {
               setError(error_ instanceof Error ? error_.message : 'خطا در دریافت علاقه‌مندی‌ها')
            }
         } finally {
            if (!controller.signal.aborted) setLoading(false)
         }
      }

      void getWishlist()
      return () => controller.abort()
   }, [authenticated])

   return (
      <div dir="rtl" className="pb-8">
         <Heading
            title="علاقه‌مندی‌های من"
            description="محصولاتی که برای بررسی یا خرید بعدی ذخیره کرده‌اید."
         />

         {!authenticated ? (
            <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
               <HeartIcon className="mx-auto h-8 w-8 text-primary" />
               <p className="mt-3 font-semibold">برای دیدن علاقه‌مندی‌ها وارد حساب خود شوید.</p>
               <Button asChild className="mt-5">
                  <Link href="/login">ورود به حساب</Link>
               </Button>
            </div>
         ) : loading ? (
            <div role="status" className="rounded-2xl border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
               در حال دریافت علاقه‌مندی‌ها...
            </div>
         ) : error ? (
            <div className="rounded-2xl border border-destructive/30 bg-card px-6 py-10 text-center">
               <p role="alert" className="text-sm text-destructive">{error}</p>
               <Button variant="outline" className="mt-4" onClick={() => globalThis.location.reload()}>
                  تلاش دوباره
               </Button>
            </div>
         ) : products.length > 0 ? (
            <ProductGrid products={products} />
         ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
               <HeartIcon className="mx-auto h-8 w-8 text-primary" />
               <p className="mt-3 font-semibold">هنوز محصولی ذخیره نکرده‌اید.</p>
               <p className="mt-2 text-sm text-muted-foreground">در صفحه هر محصول می‌توانید آن را به علاقه‌مندی‌ها اضافه کنید.</p>
               <Button asChild className="mt-5">
                  <Link href="/products">گشت‌وگذار در فروشگاه</Link>
               </Button>
            </div>
         )}
      </div>
   )
}
