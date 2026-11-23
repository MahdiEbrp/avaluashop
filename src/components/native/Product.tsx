import { ImageSkeleton } from '@/components/native/icons'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { ProductWithIncludes } from '@/types/prisma'
import Image from 'next/image'
import Link from 'next/link'

const toman = new Intl.NumberFormat('fa-IR')
const formatPrice = (value: number) => `${toman.format(value)} تومان`

export const ProductGrid = ({ products }: { products: ProductWithIncludes[] }) => (
   <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
      {products.map((product) => <Product product={product} key={product.id} />)}
   </div>
)

export const ProductSkeletonGrid = () => (
   <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)}
   </div>
)

export const Product = ({ product }: { product: ProductWithIncludes }) => {
   const hasDiscount = product?.discount > 0
   const price = product?.price - (hasDiscount ? product.discount : 0)
   const percentage = hasDiscount ? Math.round((product.discount / product.price) * 100) : 0

   return (
      <Link className="group block h-full" href={`/products/${product.id}`}>
         <Card variant="product" className="h-full overflow-hidden hover:-translate-y-1">
            <CardHeader className="p-0">
               <div className="relative aspect-4/5 w-full overflow-hidden bg-secondary">
                  <Image
                     className="object-cover transition-transform duration-500 group-hover:scale-105"
                     src={product?.images[0]}
                     alt={product.title}
                     fill
                     sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
                  />
                  {hasDiscount ? <Badge variant="discount" className="absolute right-3 top-3">٪{toman.format(percentage)} تخفیف</Badge> : null}
               </div>
            </CardHeader>
            <CardContent className="grid gap-2 p-3 md:p-4">
               {product?.categories[0]?.title ? <Badge variant="chip">{product.categories[0].title}</Badge> : null}
               <h2 className="line-clamp-2 min-h-10 text-sm font-semibold leading-6 text-card-foreground md:text-base">{product.title}</h2>
               {product?.description ? <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{product.description}</p> : null}
            </CardContent>
            <CardFooter variant="divided" className="flex-wrap justify-between gap-2 px-3 py-3 md:px-4">
               {product?.isAvailable ? (
                  <div className="flex flex-col gap-1">
                     {hasDiscount ? <span className="text-xs text-muted-foreground line-through">{formatPrice(product.price)}</span> : null}
                     <span className="text-sm font-bold text-primary md:text-base">{formatPrice(price)}</span>
                  </div>
               ) : <Badge variant="secondary">ناموجود</Badge>}
               {product?.isAvailable ? <span className="text-xs text-muted-foreground">مشاهده محصول</span> : null}
            </CardFooter>
         </Card>
      </Link>
   )
}

export function ProductSkeleton() {
   return (
      <div className="animate-pulse overflow-hidden rounded-2xl border border-border bg-card">
         <div className="flex aspect-4/5 w-full items-center justify-center bg-muted"><ImageSkeleton /></div>
         <div className="space-y-3 p-4">
            <div className="h-3 w-20 rounded-full bg-muted" />
            <div className="h-3 w-3/4 rounded-full bg-muted" />
            <div className="h-3 w-1/2 rounded-full bg-muted" />
         </div>
      </div>
   )
}
