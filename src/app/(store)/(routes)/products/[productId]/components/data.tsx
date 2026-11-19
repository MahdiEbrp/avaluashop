import { Separator } from '@/components/native/separator'
import { Badge } from '@/components/ui/badge'
import type { ProductWithIncludes } from '@/types/prisma'

import CartButton from './cart_button'
import WishlistButton from './wishlist_button'

const toman = new Intl.NumberFormat('fa-IR')
const formatPrice = (value: number) => `${toman.format(value)} تومان`

export const DataSection = ({ product }: { product: ProductWithIncludes }) => {
   const hasDiscount = product.discount > 0
   const finalPrice = product.price - (hasDiscount ? product.discount : 0)

   return (
      <section className="col-span-2 w-full rounded-2xl border border-border/70 bg-card p-5 md:p-6" dir="rtl">
         <h1 className="mb-4 text-xl font-bold">{product.title}</h1>
         <Separator />
         {product.description ? (
            <p className="py-4 text-sm leading-8 text-muted-foreground">{product.description}</p>
         ) : null}
         <Separator />
         <div className="flex flex-wrap items-center gap-3 py-4">
            {product.isAvailable ? (
               <div className="flex flex-col gap-1">
                  {hasDiscount ? (
                     <span className="text-sm text-muted-foreground line-through">{formatPrice(product.price)}</span>
                  ) : null}
                  <strong className="text-xl text-primary">{formatPrice(finalPrice)}</strong>
               </div>
            ) : (
               <Badge variant="secondary">ناموجود</Badge>
            )}
         </div>
         <div className="flex flex-wrap items-center gap-2">
            {product.isAvailable ? <CartButton product={product} /> : null}
            <WishlistButton product={product} />
         </div>
      </section>
   )
}
