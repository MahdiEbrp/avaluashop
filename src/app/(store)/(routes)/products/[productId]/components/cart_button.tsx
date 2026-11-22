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

   async function onAddToCart() {
      try {
         setFetchingCart(true)
         const count = getCountInCart({
            cartItems: cart?.items,
            productId: product?.id,
         })

         if (authenticated) {
            const response = await fetch('/api/cart', {
               method: 'POST',
               body: JSON.stringify({
                  productId: product?.id,
                  count: count + 1,
               }),
               cache: 'no-store',
               headers: { 'Content-Type': 'application/json' },
            })
            dispatchCart(await response.json())
         }

         const localCart = getLocalCart()
         if (!authenticated && count > 0) {
            adjustLocalCartCount(localCart, product?.id, 1)
            dispatchCart(localCart)
         }
         if (!authenticated && count < 1) {
            localCart.items.push({ productId: product?.id, product, count: 1 })
            dispatchCart(localCart)
         }
      } catch (error) {
         console.error({ error })
      } finally {
         setFetchingCart(false)
      }
   }

   async function onRemoveFromCart() {
      try {
         setFetchingCart(true)
         const count = getCountInCart({
            cartItems: cart?.items,
            productId: product?.id,
         })

         if (authenticated) {
            const response = await fetch('/api/cart', {
               method: 'POST',
               body: JSON.stringify({
                  productId: product?.id,
                  count: count - 1,
               }),
               cache: 'no-store',
               headers: { 'Content-Type': 'application/json' },
            })
            dispatchCart(await response.json())
         }

         const localCart = getLocalCart()
         const index = findLocalCartIndexById(localCart, product?.id)
         if (!authenticated && count > 1) {
            adjustLocalCartCount(localCart, product?.id, -1)
            dispatchCart(localCart)
         }
         if (!authenticated && count === 1) {
            localCart.items.splice(index, 1)
            dispatchCart(localCart)
         }
      } catch (error) {
         console.error({ error })
      } finally {
         setFetchingCart(false)
      }
   }

   if (fetchingCart)
      return (
         <Button disabled>
            <Spinner />
         </Button>
      )

   const count = getCountInCart({
      cartItems: cart?.items,
      productId: product?.id,
   })

   if (count === 0) {
      return (
         <Button className="flex gap-2" onClick={() => void onAddToCart()}>
            <ShoppingBasketIcon className="h-4 w-4" />
            افزودن به سبد خرید
         </Button>
      )
   }

   return (
      <>
         <Button
            variant="outline"
            size="icon"
            aria-label="کاهش تعداد"
            onClick={() => void onRemoveFromCart()}
         >
            {count === 1 ? (
               <X className="h-4 w-4" />
            ) : (
               <MinusIcon className="h-4 w-4" />
            )}
         </Button>
         <Button disabled variant="outline" size="icon">
            {count}
         </Button>
         <Button
            variant="outline"
            size="icon"
            aria-label="افزایش تعداد"
            onClick={() => void onAddToCart()}
         >
            <PlusIcon className="h-4 w-4" />
         </Button>
      </>
   )
}
