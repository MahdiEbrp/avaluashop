import { ProductGrid, ProductSkeletonGrid } from '@/components/native/Product'
import { Heading } from '@/components/native/heading'
import { Separator } from '@/components/native/separator'
import { getCatalogFacets } from '@/lib/catalog'
import prisma from '@/lib/prisma'
import { isVariableValid } from '@/lib/utils'

import {
   AvailableToggle,
   BrandCombobox,
   CategoriesCombobox,
   SortBy,
} from './components/options'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 12

/* `?page=abc`, `?page=-3` and `?page=1e9` all arrive as untrusted strings.
   `skip: NaN` used to reach Prisma and answer 500, so the page number is
   clamped to a sane positive integer before it is used. */
function toPage(raw: unknown): number {
   const parsed = typeof raw === 'string' ? Number.parseInt(raw, 10) : 1

   if (!Number.isFinite(parsed) || parsed < 1) return 1

   /* 100 000 pages is far past any real catalogue and keeps the offset honest. */
   return Math.min(parsed, 100_000)
}

/* Every search param reaches the query; only known keys are read, and each is
   narrowed to a string so `contains` can never be handed an array. */
type ProductsSearchParams = Record<string, string | string[] | undefined>

function toFilterValue(raw: unknown): string | undefined {
   return typeof raw === 'string' && raw.length > 0 && raw.length <= 120
      ? raw
      : undefined
}

export default async function Products({
   searchParams,
}: Readonly<{
   searchParams: Promise<ProductsSearchParams>
}>) {
   const params = (await searchParams) ?? {}
   const sort = toFilterValue(params.sort)
   const isAvailable = toFilterValue(params.isAvailable)
   const brand = toFilterValue(params.brand)
   const category = toFilterValue(params.category)
   const page = toPage(params.page)

   const orderBy = getOrderBy(sort)

   /* Facets come from the tagged cache (60s, invalidated on admin writes). */
   const { brands, categories } = await getCatalogFacets()
   const products = await prisma.product.findMany({
      where: {
         isAvailable: isAvailable == 'true' || sort ? true : undefined,
         brand: {
            title: {
               contains: brand,
               mode: 'insensitive',
            },
         },
         categories: {
            some: {
               title: {
                  contains: category,
                  mode: 'insensitive',
               },
            },
         },
      },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
         brand: true,
         categories: true,
      },
   })

   return (
      <>
         <Heading
            title="Products"
            description="Below is a list of products you have in your cart."
         />
         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
            <SortBy initialData={sort} />
            <CategoriesCombobox
               initialCategory={category}
               categories={categories}
            />
            <BrandCombobox initialBrand={brand} brands={brands} />
            <AvailableToggle initialData={isAvailable} />
         </div>
         <Separator />
         {isVariableValid(products) ? (
            <ProductGrid products={products} />
         ) : (
            <ProductSkeletonGrid />
         )}
      </>
   )
}

function getOrderBy(sort: string | undefined) {
   let orderBy

   switch (sort) {
      case 'featured':
      case 'most_expensive': {
         orderBy = {
            price: 'desc',
         }
         break
      }
      case 'least_expensive': {
         orderBy = {
            price: 'asc',
         }
         break
      }
   }

   return orderBy
}
