import { ProductGrid } from '@/components/native/Product'
import { Heading } from '@/components/native/heading'
import prisma from '@/lib/prisma'
import { ArrowLeftIcon, SparklesIcon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

export const revalidate = 60

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

export default async function Index() {
   const [products, categories, banners] = await Promise.all([
      prisma.product.findMany({
         where: {
            isAvailable: true,
            categories: { some: { title: { in: WOMENS_ACCESSORY_CATEGORIES } } },
         },
         include: { brand: true, categories: true },
         orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
         take: 8,
      }),
      prisma.category.findMany({
         where: {
            title: { in: WOMENS_ACCESSORY_CATEGORIES },
            products: { some: { isAvailable: true } },
         },
         select: {
            id: true,
            title: true,
            _count: { select: { products: true } },
         },
         orderBy: { title: 'asc' },
         take: 8,
      }),
      prisma.banner.findMany({
         where: { categories: { some: { title: { in: WOMENS_ACCESSORY_CATEGORIES } } } },
         select: {
            id: true,
            label: true,
            image: true,
            categories: { select: { title: true } },
         },
         orderBy: { createdAt: 'desc' },
         take: 3,
      }),
   ])

   return (
      <div className="flex flex-col pb-6" dir="rtl">
         <section className="relative isolate mb-10 mt-5 overflow-hidden rounded-4xl border border-primary/10 bg-gradient-to-l from-secondary via-background to-muted px-6 py-12 text-center shadow-sm md:mb-14 md:px-12 md:py-20">
            <div className="absolute -left-16 -top-20 -z-10 h-64 w-64 rounded-full bg-white/50 blur-3xl" />
            <div className="absolute -bottom-24 -right-10 -z-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
            <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/70 px-4 py-2 text-xs font-semibold text-primary md:text-sm">
               <SparklesIcon className="h-4 w-4" aria-hidden="true" />
               انتخابی ظریف برای هر روز
            </span>
            <h1 className="mx-auto mt-5 max-w-3xl text-3xl font-bold leading-relaxed tracking-tight text-foreground md:text-5xl">
               جزئیات کوچک، زیبایی ماندگار
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-muted-foreground md:text-base">
               از زیورآلات و کیف تا اکسسوری مو؛ جزئیاتی دوست‌داشتنی برای کامل‌کردن استایل شما.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
               <Link href="/products" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90">
                  مشاهده فروشگاه
                  <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
               </Link>
               <Link href="/products?sort=featured" className="inline-flex min-h-12 items-center rounded-xl border border-primary/20 bg-white/70 px-6 text-sm font-semibold text-foreground transition hover:bg-white">
                  انتخاب‌های پیشنهادی
               </Link>
            </div>
         </section>

         {banners.length > 0 ? (
            <section aria-label="پیشنهادهای ویژه" className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
               {banners.map((banner) => (
                  <Link
                     href={banner.categories[0]?.title ? `/products?category=${encodeURIComponent(banner.categories[0].title)}` : '/products'}
                     key={banner.id}
                     className="group relative min-h-48 overflow-hidden rounded-2xl bg-secondary"
                  >
                     <Image
                        src={banner.image}
                        alt={banner.label}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                     />
                     <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                     <h2 className="absolute inset-x-4 bottom-4 text-lg font-bold text-white">{banner.label}</h2>
                  </Link>
               ))}
            </section>
         ) : null}

         {categories.length > 0 ? (
            <section className="mb-12">
               <Heading title="دسته‌بندی‌های محبوب" description="سریع‌تر به چیزی که دنبالش هستید برسید." />
               <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {categories.map((category) => (
                     <Link
                        key={category.id}
                        href={`/products?category=${encodeURIComponent(category.title)}`}
                        className="group flex min-h-24 items-center justify-between rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                     >
                        <span>
                           <span className="block font-semibold text-foreground">{category.title}</span>
                           <span className="mt-1 block text-xs text-muted-foreground">{category._count.products.toLocaleString('fa-IR')} کالا</span>
                        </span>
                        <ArrowLeftIcon className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:-translate-x-1" aria-hidden="true" />
                     </Link>
                  ))}
               </div>
            </section>
         ) : null}

         <section className="mb-8">
            <Heading
               title="اکسسوری‌های منتخب"
               description="محصولات مرتبط با استایل زنانه، با دقت برای آوالونا شاپ انتخاب شده‌اند."
            />
            {products.length > 0 ? (
               <ProductGrid products={products} />
            ) : (
               <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
                  <p className="text-lg font-semibold text-foreground">مجموعه آوالونا شاپ در حال تکمیل است</p>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                     به‌زودی اکسسوری‌های منتخب را اینجا می‌بینید. فعلاً محصول نامرتبطی نمایش داده نمی‌شود.
                  </p>
                  <Link href="/products" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
                     رفتن به فروشگاه
                  </Link>
               </div>
            )}
         </section>
      </div>
   )
}
