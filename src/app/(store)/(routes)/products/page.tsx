import { ProductGrid } from '@/components/native/Product'
import { Heading } from '@/components/native/heading'
import prisma from '@/lib/prisma'
import { AvailableToggle, CategoriesCombobox, SortBy } from './components/options'
import { SearchIcon } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 12
const WOMENS_ACCESSORY_CATEGORIES = [
   'اکسسوری زنانه',
   'اکسسوری دخترانه',
   'زیورآلات',
   'بدلیجات',
   'کیف زنانه',
   'کیف دستی',
   'کیف دوشی',
   'عینک آفتابی زنانه',
   'شال و روسری',
   'اکسسوری مو',
   'ساعت زنانه',
]

type ProductsSearchParams = Record<string, string | string[] | undefined>

function toPage(raw: unknown): number {
   const parsed = typeof raw === 'string' ? Number.parseInt(raw, 10) : 1
   if (!Number.isFinite(parsed) || parsed < 1) return 1
   return Math.min(parsed, 100_000)
}

function toFilterValue(raw: unknown): string | undefined {
   return typeof raw === 'string' && raw.length > 0 && raw.length <= 120
      ? raw
      : undefined
}

function pageHref(page: number, filters: Record<string, string | undefined>) {
   const params = new URLSearchParams()

   for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value)
   }

   params.set('page', String(page))
   return `/products?${params.toString()}`
}

export default async function Products({
   searchParams,
}: Readonly<{
   searchParams: Promise<ProductsSearchParams>
}>) {
   const params = (await searchParams) ?? {}
   const sort = toFilterValue(params.sort)
   const isAvailable = toFilterValue(params.isAvailable)
   const category = toFilterValue(params.category)
   const query = toFilterValue(params.q)?.trim().slice(0, 80)
   const requestedPage = toPage(params.page)

   const orderBy =
      sort === 'most_expensive'
         ? { price: 'desc' as const }
         : sort === 'least_expensive'
           ? { price: 'asc' as const }
           : [{ isFeatured: 'desc' as const }, { createdAt: 'desc' as const }]

   const where = {
      isAvailable: isAvailable === 'true' ? true : undefined,
      categories: {
         some: {
            title: category
               ? { equals: category, in: WOMENS_ACCESSORY_CATEGORIES }
               : { in: WOMENS_ACCESSORY_CATEGORIES },
         },
      },
      ...(query
         ? {
              OR: [
                 { title: { contains: query, mode: 'insensitive' as const } },
                 { description: { contains: query, mode: 'insensitive' as const } },
                 { brand: { is: { title: { contains: query, mode: 'insensitive' as const } } } },
                 { keywords: { has: query } },
              ],
           }
         : {}),
   }

   const [categories, totalProducts] = await Promise.all([
      prisma.category.findMany({
         where: { title: { in: WOMENS_ACCESSORY_CATEGORIES } },
         select: { id: true, title: true },
         orderBy: { title: 'asc' },
      }),
      prisma.product.count({ where }),
   ])

   const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE))
   const page = Math.min(requestedPage, totalPages)
   const products = await prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { brand: true, categories: true },
   })

   const filters = {
      q: query,
      sort,
      category,
      isAvailable,
   }

   return (
      <div dir="rtl">
         <Heading
            title="فروشگاه اکسسوری"
            description="زیورآلات، کیف و جزئیات ظریف برای کامل‌کردن استایل شما."
         />
         <form action="/products" method="get" className="mb-5 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="product-search" className="sr-only">جستجوی محصولات</label>
            <div className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 focus-within:ring-2 focus-within:ring-ring">
               <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
               <input
                  id="product-search"
                  name="q"
                  type="search"
                  maxLength={80}
                  defaultValue={query}
                  placeholder="نام محصول، توضیحات یا برند را جستجو کنید..."
                  className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
               />
            </div>
            {sort ? <input type="hidden" name="sort" value={sort} /> : null}
            {category ? <input type="hidden" name="category" value={category} /> : null}
            {isAvailable ? <input type="hidden" name="isAvailable" value={isAvailable} /> : null}
            <button type="submit" className="min-h-11 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
               جستجو
            </button>
            {query ? (
               <Link href={pageHref(1, { sort, category, isAvailable })} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm text-muted-foreground hover:bg-muted">
                  پاک‌کردن جستجو
               </Link>
            ) : null}
         </form>
         <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-3">
            <SortBy initialData={sort} />
            <CategoriesCombobox initialCategory={category} categories={categories} />
            <AvailableToggle initialData={isAvailable} />
         </div>
         <div className="mb-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <p>{totalProducts.toLocaleString('fa-IR')} محصول پیدا شد</p>
            {query ? <p className="truncate">نتیجه برای «{query}»</p> : null}
         </div>
         {products.length > 0 ? (
            <ProductGrid products={products} />
         ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
               <p className="font-semibold">محصولی پیدا نشد</p>
               <p className="mt-2 text-sm text-muted-foreground">عبارت جستجو یا فیلترها را تغییر دهید و دوباره تلاش کنید.</p>
            </div>
         )}
         {totalPages > 1 ? (
            <nav aria-label="صفحه‌بندی محصولات" className="mb-10 flex items-center justify-center gap-3">
               {page > 1 ? (
                  <Link href={pageHref(page - 1, filters)} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted">
                     قبلی
                  </Link>
               ) : (
                  <span aria-disabled="true" className="rounded-xl border border-border/50 px-4 py-2 text-sm text-muted-foreground/50">
                     قبلی
                  </span>
               )}
               <span className="text-sm text-muted-foreground">
                  صفحه {page.toLocaleString('fa-IR')} از {totalPages.toLocaleString('fa-IR')}
               </span>
               {page < totalPages ? (
                  <Link href={pageHref(page + 1, filters)} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted">
                     بعدی
                  </Link>
               ) : (
                  <span aria-disabled="true" className="rounded-xl border border-border/50 px-4 py-2 text-sm text-muted-foreground/50">
                     بعدی
                  </span>
               )}
            </nav>
         ) : null}
      </div>
   )
}
