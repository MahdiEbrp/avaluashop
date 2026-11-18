import { prismaMock } from '../support/db'
import { resetCacheMock } from '../support/cache'

vi.mock('@/lib/prisma', () => import('../support/db').then((m) => m.prismaModule()))
/* `unstable_cache` needs the Next server's incremental cache, which only
   exists inside a request. The double runs the callback and memoises it. */
vi.mock('next/cache', () => import('../support/cache'))

/* Imported after the mocks so the module picks up both doubles. */
import { CATALOG_TAG, getCatalogFacets, getProductsJson } from '@/lib/catalog'

describe('lib/catalog', () => {
   beforeEach(() => {
      resetCacheMock()
      prismaMock.brand.findMany.mockReset()
      prismaMock.category.findMany.mockReset()
      prismaMock.product.findMany.mockReset()
   })

   it('exposes one cache tag for admin writes to invalidate', () => {
      expect(CATALOG_TAG).toBe('catalog')
   })

   it('reads both facet lists in parallel, alphabetically, id and title only', async () => {
      prismaMock.brand.findMany.mockResolvedValue([{ id: 'b1', title: 'Acme' }])
      prismaMock.category.findMany.mockResolvedValue([{ id: 'c1', title: 'Shoes' }])

      await expect(getCatalogFacets()).resolves.toEqual({
         brands: [{ id: 'b1', title: 'Acme' }],
         categories: [{ id: 'c1', title: 'Shoes' }],
      })

      expect(prismaMock.brand.findMany).toHaveBeenCalledWith({
         select: { id: true, title: true },
         orderBy: { title: 'asc' },
      })
      expect(prismaMock.category.findMany).toHaveBeenCalledWith({
         select: { id: true, title: true },
         orderBy: { title: 'asc' },
      })
   })

   it('serves the facets from cache on the second read', async () => {
      prismaMock.brand.findMany.mockResolvedValue([])
      prismaMock.category.findMany.mockResolvedValue([])

      await getCatalogFacets()
      await getCatalogFacets()

      expect(prismaMock.brand.findMany).toHaveBeenCalledTimes(1)
   })

   it('serialises the product payload once and returns the same string', async () => {
      prismaMock.product.findMany.mockResolvedValue([
         { id: 'p1', title: 'One', brand: null, categories: [] },
      ])

      const first = await getProductsJson()
      const second = await getProductsJson()

      expect(first).toBe(JSON.stringify([{ id: 'p1', title: 'One', brand: null, categories: [] }]))
      expect(second).toBe(first)
      expect(prismaMock.product.findMany).toHaveBeenCalledWith({
         include: { brand: true, categories: true },
         orderBy: { createdAt: 'desc' },
      })
      expect(prismaMock.product.findMany).toHaveBeenCalledTimes(1)
   })
})
