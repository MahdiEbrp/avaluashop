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
   const { product, productId } = cartItem

   async function getProduct() {
      try {
         const response = await fetch('/api/product', {
            method: 'POST',
            body: JSON.stringify({ productId }),
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
         })
         return await response.json()
      } catch (error) {
         console.error({ error })
      }
   }

   async function updateCart(delta: number) {
      try {
         setFetchingCart(true)
         const count = getCountInCart({ cartItems: cart?.items, productId })
         const nextCount = Math.max(0, count + delta)

         if (authenticated) {
            const response = await fetch('/api/cart', {
               method: 'POST',
               body: JSON.stringify({ productId, count: nextCount }),
               cache: 'no-store',
               headers: { 'Content-Type': 'application/json' },
            })
            dispatchCart(await response.json())
         } else {
            const localCart = getLocalCart()
            if (delta > 0 && count > 0) {
               adjustLocalCartCount(localCart, productId, delta)
            } else if (delta > 0) {
               localCart.items.push({
                  productId,
                  product: await getProduct(),
                  count: 1,
               })
            } else if (count > 1) {
               adjustLocalCartCount(localCart, productId, delta)
            } else {
               const index = findLocalCartIndexById(localCart, productId)
               if (index >= 0) localCart.items.splice(index, 1)
            }
            dispatchCart(localCart)
         }
      } catch (error) {
         console.error({ error })
      } finally {
         setFetchingCart(false)
      }
   }

   const count = getCountInCart({ cartItems: cart?.items, productId })
   const price = product?.price - (product?.discount || 0)

   function renderControls() {
      if (fetchingCart) {
         return (
            <Button disabled>
               <Spinner />
            </Button>
         )
      }
      if (count === 0) {
         return (
            <Button onClick={() => void updateCart(1)}>
               افزودن به سبد خرید
            </Button>
         )
      }
      return (
         <div className="flex items-center gap-2">
            <Button
               variant="outline"
               size="icon"
               aria-label="کاهش تعداد"
               onClick={() => void updateCart(-1)}
            >
               {count === 1 ? (
                  <X className="h-4" />
               ) : (
                  <MinusIcon className="h-4" />
               )}
            </Button>
            <Button disabled variant="ghost" size="icon">
               {count}
            </Button>
            <Button
               variant="outline"
               size="icon"
               aria-label="افزایش تعداد"
               onClick={() => void updateCart(1)}
            >
               <PlusIcon className="h-4" />
            </Button>
         </div>
      )
   }

   return (
      <Card dir="rtl">
         <CardHeader className="p-0 md:hidden">
            <div className="relative h-32 w-full">
               <Link href={`/products/${String(product?.id)}`}>
                  <Image
                     className="rounded-t-lg object-cover"
                     src={product?.images[0]}
                     alt={product?.title || 'تصویر محصول'}
                     fill
                     sizes="50vw"
                  />
               </Link>
            </div>
         </CardHeader>
         <CardContent className="grid grid-cols-6 gap-4 p-3">
            <div className="relative col-span-2 hidden w-full md:inline-flex">
               <Link href={`/products/${String(product?.id)}`}>
                  <Image
                     className="rounded-lg object-cover"
                     src={product?.images[0]}
                     alt={product?.title || 'تصویر محصول'}
                     fill
                  />
               </Link>
            </div>
            <div className="col-span-4 block space-y-3 text-right">
               <Link href={`/products/${String(product?.id)}`}>
                  <h2 className="font-semibold">{product?.title}</h2>
               </Link>
               {product?.description ? (
                  <p className="text-xs leading-6 text-muted-foreground">
                     {product.description}
                  </p>
               ) : null}
               <div className="flex items-center gap-2">
                  {product?.discount > 0 ? (
                     <>
                        <Badge variant="destructive">
                           <span className="line-through">
                              {formatPrice(product?.price)}
                           </span>
                        </Badge>
                        <strong>{formatPrice(price)}</strong>
                     </>
                  ) : (
                     <strong>{formatPrice(product?.price)}</strong>
                  )}
               </div>
               {renderControls()}
            </div>
         </CardContent>
      </Card>
   )
}
