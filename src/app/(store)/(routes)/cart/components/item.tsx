'use client'

import { Spinner } from '@/components/native/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useAuthenticated } from '@/hooks/useAuthentication'
import {
   adjustLocalCartCount,
   findLocalCartIndexById,
   getCountInCart,
   getLocalCart,
} from '@/lib/cart'
import { useCartContext } from '@/state/Cart'
import { MinusIcon, PlusIcon, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

const toman = new Intl.NumberFormat('fa-IR')
const formatPrice = (value: number) => `${toman.format(value)} تومان`

export const Item = ({ cartItem }) => {
   const { authenticated } = useAuthenticated()
   const { cart, dispatchCart } = useCartContext()
   const [fetchingCart, setFetchingCart] = useState(false)
   const [error, setError] = useState('')
   const { product, productId } = cartItem

   async function getProduct() {
      const response = await fetch('/api/product', {
         method: 'POST',
         body: JSON.stringify({ productId }),
         cache: 'no-store',
         headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) throw new Error('دریافت اطلاعات محصول انجام نشد.')
      return await response.json()
   }

   async function updateCart(delta: number) {
      try {
         setFetchingCart(true)
         setError('')
         const count = getCountInCart({ cartItems: cart?.items, productId })
         const nextCount = Math.max(0, count + delta)

         if (authenticated) {
            const response = await fetch('/api/cart', {
               method: 'POST',
               body: JSON.stringify({ productId, count: nextCount }),
               cache: 'no-store',
               headers: { 'Content-Type': 'application/json' },
            })
            if (!response.ok) throw new Error('به‌روزرسانی سبد خرید انجام نشد. دوباره تلاش کنید.')
            dispatchCart(await response.json())
         } else {
            const localCart = getLocalCart()
            if (delta > 0 && count > 0) {
               adjustLocalCartCount(localCart, productId, delta)
            } else if (delta > 0) {
               localCart.items.push({ productId, product: await getProduct(), count: 1 })
            } else if (count > 1) {
               adjustLocalCartCount(localCart, productId, delta)
            } else {
               const index = findLocalCartIndexById(localCart, productId)
               if (index >= 0) localCart.items.splice(index, 1)
            }
            dispatchCart(localCart)
         }
      } catch (error_) {
         setError(error_ instanceof Error ? error_.message : 'خطا در به‌روزرسانی سبد خرید')
      } finally {
         setFetchingCart(false)
      }
   }

   const count = getCountInCart({ cartItems: cart?.items, productId })
   const price = product?.price - (product?.discount || 0)
   const available = Boolean(product?.isAvailable && product?.stock > 0)
   const canIncrease = available && count < product.stock

   return (
      <Card dir="rtl">
         <CardHeader className="p-0 md:hidden">
            <div className="relative h-40 w-full overflow-hidden rounded-t-lg bg-secondary">
               {product?.images?.[0] ? (
                  <Link href={`/products/${String(product.id)}`}>
                     <Image className="object-cover" src={product.images[0]} alt={product?.title || 'تصویر محصول'} fill sizes="100vw" />
                  </Link>
               ) : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">بدون تصویر</div>}
            </div>
         </CardHeader>
         <CardContent className="grid grid-cols-1 gap-4 p-3 sm:grid-cols-6">
            <div className="relative hidden aspect-square w-full overflow-hidden rounded-lg bg-secondary sm:col-span-2 sm:block">
               {product?.images?.[0] ? (
                  <Link href={`/products/${String(product.id)}`}>
                     <Image className="object-cover" src={product.images[0]} alt={product?.title || 'تصویر محصول'} fill sizes="25vw" />
                  </Link>
               ) : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">بدون تصویر</div>}
            </div>
            <div className="space-y-3 text-right sm:col-span-4">
               <Link href={`/products/${String(product?.id)}`}>
                  <h2 className="font-semibold">{product?.title ?? 'محصول حذف‌شده'}</h2>
               </Link>
               {product?.description ? <p className="line-clamp-2 text-xs leading-6 text-muted-foreground">{product.description}</p> : null}
               <div className="flex flex-wrap items-center gap-2">
                  {product?.discount > 0 ? (
                     <>
                        <span className="text-xs text-muted-foreground line-through">{formatPrice(product.price)}</span>
                        <strong>{formatPrice(price)}</strong>
                     </>
                  ) : <strong>{formatPrice(product?.price ?? 0)}</strong>}
                  {!available ? <Badge variant="destructive">ناموجود؛ از خرید قابل ثبت نیست</Badge> : null}
                  {available && !canIncrease ? <Badge variant="secondary">حداکثر موجودی انتخاب شده</Badge> : null}
               </div>
               {fetchingCart ? (
                  <Button disabled><Spinner /></Button>
               ) : (
                  <div className="flex items-center gap-2">
                     <Button variant="outline" size="icon" aria-label="کاهش تعداد" onClick={() => void updateCart(-1)}>
                        {count === 1 ? <X className="h-4" /> : <MinusIcon className="h-4" />}
                     </Button>
                     <span className="min-w-8 text-center text-sm font-semibold" aria-live="polite">{toman.format(count)}</span>
                     <Button variant="outline" size="icon" aria-label="افزایش تعداد" disabled={!canIncrease} onClick={() => void updateCart(1)}>
                        <PlusIcon className="h-4" />
                     </Button>
                  </div>
               )}
               {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
            </div>
         </CardContent>
      </Card>
   )
}
