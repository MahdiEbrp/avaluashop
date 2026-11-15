import { unstable_cache } from 'next/cache'

import prisma from '@/lib/prisma'

/**
 * Catalogue reads that almost every storefront page needs and that almost
 * never change: the facet lists (brands, categories) and the product payload
 * behind `/api/products`.
 *
 * Both are cached through `next/cache` for a short window and tagged, so an
 * admin write can invalidate them immediately instead of waiting the window
 * out (`revalidateTag(CATALOG_TAG)` in the admin routes).
 *
 * Only the columns a picker actually renders are selected, which keeps the
 * cache entries small and free of `Date` objects.
 */
export const CATALOG_TAG = 'catalog'

export interface CatalogFacet {
   id: string
   title: string
}

export interface CatalogFacets {
   brands: CatalogFacet[]
   categories: CatalogFacet[]
}

export const getCatalogFacets = unstable_cache(
   async (): Promise<CatalogFacets> => {
      const [brands, categories] = await Promise.all([
         prisma.brand.findMany({
            select: { id: true, title: true },
            orderBy: { title: 'asc' },
         }),
         prisma.category.findMany({
            select: { id: true, title: true },
            orderBy: { title: 'asc' },
         }),
      ])

      return { brands, categories }
   },
   ['catalog-facets'],
   { revalidate: 60, tags: [CATALOG_TAG] }
)

/**
 * The `/api/products` body, serialised once per window.
 *
 * Cached as a string rather than an object so the route can hand it straight to
 * the response without re-serialising it on every request — under the load test
 * this route is the single hottest endpoint.
 */
export const getProductsJson = unstable_cache(
   async (): Promise<string> => {
      const products = await prisma.product.findMany({
         include: { brand: true, categories: true },
         orderBy: { createdAt: 'desc' },
      })

      return JSON.stringify(products)
   },
   ['products-json'],
   { revalidate: 30, tags: [CATALOG_TAG] }
)
