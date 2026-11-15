import { ImageSkeleton } from '@/components/native/icons'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { ProductWithIncludes } from '@/types/prisma'
import Image from 'next/image'
import Link from 'next/link'

export const ProductGrid = ({
   products,
}: {
   products: ProductWithIncludes[]
}) => {
   return (
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
         {products.map((product) => (
            <Product product={product} key={product.id} />
         ))}
      </div>
   )
}

export const ProductSkeletonGrid = () => {
   return (
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
         {Array.from({ length: 12 }).map((_, i) => (
            <ProductSkeleton key={i} />
         ))}
      </div>
   )
}

export const Product = ({ product }: { product: ProductWithIncludes }) => {
   function Price() {
      if (product?.discount > 0) {
         const price = product?.price - product?.discount
         const percentage = (product?.discount / product?.price) * 100
         return (
            <div className="flex gap-2 items-center">
               <Badge className="flex gap-4" variant="destructive">
                  <div className="line-through">${product?.price}</div>
                  <div>%{percentage.toFixed(2)}</div>
               </Badge>
               <h2 className="">${price.toFixed(2)}</h2>
            </div>
         )
      }

      return <h2>${product?.price}</h2>
   }

   return (
      <Link className="" href={`/products/${product.id}`}>
         <Card className="h-full">
            <CardHeader className="p-0">
               <div className="relative h-60 w-full">
                  <Image
                     className="rounded-t-lg object-cover"
                     src={product?.images[0]}
                     alt="product image"
                     fill
                     sizes="(min-width: 1000px) 30vw, 50vw"
                  />
               </div>
            </CardHeader>
            <CardContent className="grid gap-1 p-4">
               <Badge variant="subtle" className="w-min">
                  {product?.categories[0]?.title}
               </Badge>

               <h2 className="mt-2">{product.title}</h2>
               <p className="text-xs text-muted-foreground text-justify">
                  {product.description}
               </p>
            </CardContent>
            <CardFooter>
               {product?.isAvailable ? (
                  Price()
               ) : (
                  <Badge variant="secondary">Out of stock</Badge>
               )}
            </CardFooter>
         </Card>
      </Link>
   )
}

export function ProductSkeleton() {
   return (
      <Link href="#">
         <div className="animate-pulse rounded-lg border border-border bg-card">
            <div className="relative h-full w-full">
               <div className="flex h-40 w-full items-center justify-center rounded bg-muted ">
                  <ImageSkeleton />
               </div>
            </div>
            <div className="p-5">
               <div className="w-full">
                  <div className="mb-4 h-2.5 w-48 rounded-full bg-muted"></div>
                  <div className="mb-2.5 h-2 max-w-120 rounded-full bg-muted"></div>
                  <div className="mb-2.5 h-2 rounded-full bg-muted"></div>
                  <div className="mb-2.5 h-2 max-w-110 rounded-full bg-muted"></div>
                  <div className="mb-2.5 h-2 max-w-115 rounded-full bg-muted"></div>
                  <div className="h-2 max-w-90 rounded-full bg-muted"></div>
               </div>
            </div>
         </div>
      </Link>
   )
}
