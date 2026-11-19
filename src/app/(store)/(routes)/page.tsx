import { ProductGrid } from '@/components/native/Product'
import { Heading } from '@/components/native/heading'
import prisma from '@/lib/prisma'

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
   'Women's Accessories',
   "Women's Jewelry",
   'Jewelry',
   'Handbags',
   'Hair Accessories',
   'Scarves',
   'Sunglasses',
   "Women's Watches",
]

export default async function Index() {
   const products = await prisma.product.findMany({
      where: {
         isAvailable: true,
         categories: {
            some: {
               title: { in: WOMENS_ACCESSORY_CATEGORIES },
            },
         },
      },
      include: { brand: true, categories: true },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      take: 8,
   })

   return (
      <div className="flex flex-col" dir="rtl">
         <section className="mb-10 mt-6 rounded-3xl bg-gradient-to-l from-accent via-background to-secondary px-5 py-10 text-center md:py-16">
            <p className="mb-3 text-sm font-semibold text-primary">انتخاب‌هایی ظریف برای استایل تو</p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl">
               جزئیات کوچک، زیبایی ماندگار
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-8 text-muted-foreground md:text-base">
               مجموعه‌ای منتخب از اکسسوری‌های زنانه؛ از زیورآلات و کیف تا اکسسوری مو و جزئیات دوست‌داشتنی استایل.
            </p>
         </section>

         <section className="mb-12">
            <Heading
               title="اکسسوری‌های منتخب"
               description="محصولات مرتبط با استایل زنانه، با دقت برای آوالوا انتخاب شده‌اند."
            />
            {products.length > 0 ? (
               <ProductGrid products={products} />
            ) : (
               <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
                  <p className="text-lg font-semibold text-foreground">مجموعه آوالوا در حال تکمیل است</p>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                     به‌زودی اکسسوری‌های منتخب را اینجا می‌بینید. فعلاً محصول نامرتبطی نمایش داده نمی‌شود.
                  </p>
               </div>
            )}
         </section>
      </div>
   )
}
