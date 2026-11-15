import {
   BlogPostGrid,
   BlogPostSkeletonGrid,
} from '@/components/native/BlogCard'
import Carousel from '@/components/native/Carousel'
import { ProductGrid, ProductSkeletonGrid } from '@/components/native/Product'
import { Heading } from '@/components/native/heading'
import { Separator } from '@/components/native/separator'
import prisma from '@/lib/prisma'
import { isVariableValid } from '@/lib/utils'

/* The storefront home page holds no per-visitor data, so it is regenerated in
   the background instead of on every request: the HTML comes from the cache and
   the catalogue is refreshed at most once a minute. */
export const revalidate = 60

/* The home page shows a shelf, not the catalogue: eight buyable products, the
   featured ones first, is enough to fill the grid. Without the bound, a
   10 000-product shop would serialise the whole table into one HTML document. */
const HOME_SHELF = 8

export default async function Index() {
   /* Three independent reads: one round trip each, all three at once. */
   const [products, blogs, banners] = await Promise.all([
      prisma.product.findMany({
         where: { isAvailable: true },
         include: {
            brand: true,
            categories: true,
         },
         orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
         take: HOME_SHELF,
      }),
      prisma.blog.findMany({
         include: { author: true },
         orderBy: { createdAt: 'desc' },
         take: 3,
      }),
      prisma.banner.findMany({ take: 8 }),
   ])

   return (
      <div className="flex flex-col border-border">
         <Carousel images={banners.map((obj) => obj.image)} />
         <Separator className="my-8" />
         <Heading
            title="Products"
            description="Below is a list of products we have available for you."
         />
         {isVariableValid(products) ? (
            <ProductGrid products={products} />
         ) : (
            <ProductSkeletonGrid />
         )}
         <Separator className="my-8" />
         {isVariableValid(blogs) ? (
            <BlogPostGrid blogs={blogs} />
         ) : (
            <BlogPostSkeletonGrid />
         )}
      </div>
   )
}
