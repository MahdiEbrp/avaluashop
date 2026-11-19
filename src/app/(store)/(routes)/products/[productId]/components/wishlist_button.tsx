'use client'

import { Spinner } from '@/components/native/icons'
import { Button } from '@/components/ui/button'
import { useAuthenticated } from '@/hooks/useAuthentication'
import { HeartIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function WishlistButton({ product }) {
   const { authenticated } = useAuthenticated()
   const [wishlist, setWishlist] = useState(null)
   const [fetchingWishlist, setFetchingWishlist] = useState(true)

   useEffect(() => {
      async function getWishlist() {
         try {
            const response = await fetch('/api/wishlist', { cache: 'no-store', method: 'GET' })
            setWishlist(await response.json())
            setFetchingWishlist(false)
         } catch (error) {
            console.error({ error })
         }
      }
      if (authenticated) void getWishlist()
   }, [authenticated])

   function isProductInWishlist() {
      for (let i = 0; i < wishlist?.length; i++) {
         if (wishlist[i]?.id === product?.id) return true
      }
      return false
   }

   async function updateWishlist(connect: boolean) {
      try {
         setFetchingWishlist(true)
         const response = await fetch('/api/wishlist', {
            method: connect ? 'POST' : 'DELETE',
            body: JSON.stringify({ productId: product?.id, connect }),
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json-string' },
         })
         setWishlist(await response.json())
      } catch (error) {
         console.error({ error })
      } finally {
         setFetchingWishlist(false)
      }
   }

   if (!authenticated) return null
   if (fetchingWishlist) return <Button disabled><Spinner /></Button>

   return (
      <Button
         variant={isProductInWishlist() ? 'outline' : 'secondary'}
         className="flex gap-2"
         onClick={() => void updateWishlist(!isProductInWishlist())}
      >
         <HeartIcon className="h-4 w-4" />
         {isProductInWishlist() ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
      </Button>
   )
}
