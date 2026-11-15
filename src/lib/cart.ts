export interface LocalCartItem {
   productId: string
   product?: unknown
   count: number
}

export interface LocalCart {
   items: LocalCartItem[]
}

export function writeLocalCart(items: LocalCart) {
   globalThis.localStorage.setItem('Cart', JSON.stringify(items))
}

export function getLocalCart(): LocalCart {
   if (globalThis.window !== undefined && globalThis.localStorage) {
      try {
         const stored = globalThis.localStorage.getItem('Cart')
         return stored === null
            ? { items: [] }
            : (JSON.parse(stored) as LocalCart)
      } catch {
         writeLocalCart({ items: [] })
         return { items: [] }
      }
   }

   return { items: [] }
}

export function getCountInCart({
   cartItems,
   productId,
}: {
   cartItems?: { productId: string; count: number }[] | null
   productId?: string
}): number {
   for (const cartItem of cartItems ?? []) {
      if (cartItem?.productId === productId) {
         return cartItem.count
      }
   }

   return 0
}

export function findLocalCartIndexById(
   cart: LocalCart,
   productId?: string
): number {
   return cart.items.findIndex((item) => item.productId === productId)
}

/** Adds `delta` to every line of the guest cart that matches `productId`. */
export function adjustLocalCartCount(
   cart: LocalCart,
   productId: string | undefined,
   delta: number
): LocalCart {
   for (const item of cart.items) {
      if (item.productId === productId) {
         item.count += delta
      }
   }

   return cart
}
