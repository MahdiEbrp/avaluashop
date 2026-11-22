import { Separator } from '@/components/native/separator'
import { Badge } from '@/components/ui/badge'
import type { ProductWithIncludes } from '@/types/prisma'
import { CheckCircle2Icon, ShieldCheckIcon, TruckIcon } from 'lucide-react'

import CartButton from './cart_button'
import WishlistButton from './wishlist_button'

const toman = new Intl.NumberFormat('fa-IR')
const formatPrice = (value: number) => `${toman.format(value)} تومان`

export const DataSection = ({ product }: { product: ProductWithIncludes }) => {
   const hasDiscount = product.discount > 0
   const finalPrice = product.price - (hasDiscount ? product.discount : 0)
   const discountPercent = hasDiscount && product.price > 0
      ? Math.round((product.discount / product.price) * 100)
      : 0

   return (
      <section className="col-span-1 w-full rounded-2xl border border-border/70 bg-card p-5 shadow-sm md:col-span-3 md:p-7" dir="rtl">
         <div className="mb-4 flex flex-wrap items-center gap-2">
            {product.brand?.title ? <Badge variant="secondary">{product.brand.title}</Badge> : null}
            {product.categories.slice(0, 2).map((category) => (
               <Badge key={category.id} variant="outline">{category.title}</Badge>
            ))}
            <Badge variant={product.isAvailable ? 'default' : 'secondary'}>
               {product.isAvailable ? 'موجود در فروشگاه' : 'ناموجود'}
            </Badge>
         </div>
         <h1 className="text-2xl font-bold leading-relaxed md:text-3xl">{product.title}</h1>
         {product.description ? (
            <p className="mt-4 whitespace-pre-line text-sm leading-8 text-muted-foreground">{product.description}</p>
         ) : null}
         <Separator className="my-5" />
         <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
               {hasDiscount ? (
                  <div className="flex items-center gap-2">
                     <span className="text-sm text-muted-foreground line-through">{formatPrice(product.price)}</span>
                     <Badge variant="destructive">{toman.format(discountPercent)}٪ تخفیف</Badge>
                  </div>
               ) : null}
               {product.isAvailable ? (
                  <strong className="block text-2xl font-bold text-primary">{formatPrice(finalPrice)}</strong>
               ) : (
                  <Badge variant="secondary" className="px-3 py-1 text-sm">فعلاً ناموجود</Badge>
               )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
               {product.isAvailable ? <CartButton product={product} /> : null}
               <WishlistButton product={product} />
            </div>
         </div>
         <Separator className="my-5" />
         <div className="grid gap-3 text-xs leading-6 text-muted-foreground sm:grid-cols-2">
            <div className="flex items-center gap-2">
               <ShieldCheckIcon className="h-4 w-4 shrink-0 text-primary" />
               اطلاعات و مبلغ سفارش هنگام ثبت نهایی دوباره بررسی می‌شود.
            </div>
            <div className="flex items-center gap-2">
               <TruckIcon className="h-4 w-4 shrink-0 text-primary" />
               روش‌های ارسال در مرحله ثبت سفارش نمایش داده می‌شوند.
            </div>
            <div className="flex items-center gap-2">
               <CheckCircle2Icon className="h-4 w-4 shrink-0 text-primary" />
               افزودن به علاقه‌مندی‌ها برای حساب‌های واردشده فعال است.
            </div>
         </div>
      </section>
   )
}
