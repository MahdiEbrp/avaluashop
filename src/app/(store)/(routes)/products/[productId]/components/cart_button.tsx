'use client'

import { Spinner } from '@/components/native/icons'
import { Button } from '@/components/ui/button'
import { useAuthenticated } from '@/hooks/useAuthentication'
import {
   adjustLocalCartCount,
   findLocalCartIndexById,
   getCountInCart,
   getLocalCart,
} from '@/lib/cart'
import { CartContextProvider, useCartContext } from '@/state/Cart'
import { MinusIcon, PlusIcon, ShoppingBasketIcon, X } from 'lucide-react'
import { useState } from 'react'

export default function CartButton({ product }) {
   return (
      <CartContextProvider>
         <ButtonComponent product={product} />
      </CartContextProvider>
   )
}

export function ButtonComponent({ product }) {
   const { authenticated } = useAuthenticated()
   const { cart, dispatchCart } = useCartContext()
   const [fetchingCart, setFetchingCart] = useState(false)
   const [error, setError] = useState('')

   async function updateCart(delta: number) {
      try {
         setFetchingCart(true)
         setError('')
         const count = getCountInCart({ cartItems: cart?.items, productId: product?.id })
         const nextCount = Math.max(0, count + delta)

         if (authenticated) {
            const response = await fetch('/api/cart', {
               method: 'POST',
               body: JSON.stringify({ productId: product?.id, count: nextCount }),
               cache: 'no-store',
               headers: { 'Content-Type': 'application/json' },
            })
            if (!response.ok) throw new Error('به‌روزرسانی سبد خرید انجام نشد. دوباره تلاش کنید.')
            dispatchCart(await response.json())
         } else {
            const localCart = getLocalCart()
            const index = findLocalCartIndexById(localCart, product?.id)
            if (delta > 0 && count > 0) {
               adjustLocalCartCount(localCart, product?.id, delta)
            } else if (delta > 0) {
               localCart.items.push({ productId: product?.id, product, count: 1 })
            } else if (count > 1) {
               adjustLocalCartCount(localCart, product?.id, delta)
            } else if (index >= 0) {
               localCart.items.splice(index, 1)
            }
            dispatchCart(localCart)
         }
      } catch (error_) {
         setError(error_ instanceof Error ? error_.message : 'خطا در به‌روزرسانی سبد خرید')
      } finally {
         setFetchingCart(false)
      }
   }

   if (fetchingCart) return <Button disabled><Spinner /></Button>

   const count = getCountInCart({ cartItems: cart?.items, productId: product?.id })
   const canIncrease = Boolean(product?.isAvailable && count < product.stock)

   return (
      <div className="flex flex-wrap items-center gap-2">
         {count === 0 ? (
            <Button className="flex gap-2" disabled={!product?.isAvailable || product.stock < 1} onClick={() => void updateCart(1)}>
               <ShoppingBasketIcon className="h-4 w-4" />
               افزودن به سبد خرید
            </Button>
         ) : (
            <>
               <Button variant="outline" size="icon" aria-label="کاهش تعداد" onClick={() => void updateCart(-1)}>
                  {count === 1 ? <X className="h-4 w-4" /> : <MinusIcon className="h-4 w-4" />}
               </Button>
               <span className="min-w-8 text-center text-sm font-semibold" aria-live="polite">{count}</span>
               <Button variant="outline" size="icon" aria-label="افزایش تعداد" disabled={!canIncrease} onClick={() => void updateCart(1)}>
                  <PlusIcon className="h-4 w-4" />
               </Button>
            </>
         )}
         {error ? <p role="alert" className="w-full text-xs text-destructive">{error}</p> : null}
      </div>
   )
}
