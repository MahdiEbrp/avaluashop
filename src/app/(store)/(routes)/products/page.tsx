import { ProductGrid } from '@/components/native/Product'
import { Heading } from '@/components/native/heading'
import prisma from '@/lib/prisma'

import {
   AvailableToggle,
   CategoriesCombobox,
   SortBy,
} from './components/options'

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

export default async function Products({
   searchParams,
}: Readonly<{
   searchParams: Promise<ProductsSearchParams>
}>) {
   const params = (await searchParams) ?? {}
   const sort = toFilterValue(params.sort)
   const isAvailable = toFilterValue(params.isAvailable)
   const category = toFilterValue(params.category)
   const page = toPage(params.page)

   const orderBy =
      sort === 'most_expensive'
         ? { price: 'desc' as const }
         : sort === 'least_expensive'
           ? { price: 'asc' as const }
           : [{ isFeatured: 'desc' as const }, { createdAt: 'desc' as const }]

   const categories = await prisma.category.findMany({
      where: { title: { in: WOMENS_ACCESSORY_CATEGORIES } },
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
   })

   const products = await prisma.product.findMany({
      where: {
         isAvailable: isAvailable === 'true' ? true : undefined,
         categories: {
            some: {
               title: category
                  ? { equals: category, in: WOMENS_ACCESSORY_CATEGORIES }
                  : { in: WOMENS_ACCESSORY_CATEGORIES },
            },
         },
      },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { brand: true, categories: true },
   })

   return (
      <div dir="rtl">
         <Heading
            title="فروشگاه اکسسوری"
            description="زیورآلات، کیف و جزئیات ظریف برای کامل‌کردن استایل شما."
         />
         <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-3">
            <SortBy initialData={sort} />
            <CategoriesCombobox initialCategory={category} categories={categories} />
            <AvailableToggle initialData={isAvailable} />
         </div>
         {products.length > 0 ? (
            <ProductGrid products={products} />
         ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
               <p className="font-semibold">محصولی در این دسته موجود نیست</p>
               <p className="mt-2 text-sm text-muted-foreground">به‌زودی محصولات تازه و مرتبط اضافه می‌شوند.</p>
            </div>
         )}
      </div>
   )
}
