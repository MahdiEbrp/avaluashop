import { BlogPostGrid, BlogPostSkeletonGrid } from '@/components/native/BlogCard'
import Carousel from '@/components/native/Carousel'
import { ProductGrid, ProductSkeletonGrid } from '@/components/native/Product'
import { Heading } from '@/components/native/heading'
import { Separator } from '@/components/native/separator'
import prisma from '@/lib/prisma'
import { isVariableValid } from '@/lib/utils'

export const revalidate = 60
const HOME_SHELF = 8

export default async function Index() {
   const [products, blogs, banners] = await Promise.all([
      prisma.product.findMany({
         where: { isAvailable: true },
         include: { brand: true, categories: true },
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
      <div className="flex flex-col">
         <section className="mb-8 mt-5">
            <div className="mb-5 flex flex-col gap-2 text-center">
               <p className="text-sm font-semibold tracking-wide text-primary">زیبایی در انتخاب‌های کوچک است</p>
               <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">دنیای خاص آوالوا</h1>
               <p className="mx-auto max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
                  انتخاب‌هایی دلنشین برای سبک زندگی امروز؛ با خریدی آسان، مطمئن و لذت‌بخش.
               </p>
            </div>
            {banners.length > 0 ? (
               <Carousel images={banners.map((obj) => obj.image)} />
            ) : (
               <div className="flex min-h-52 items-center justify-center rounded-2xl bg-secondary px-6 text-center">
                  <div>
                     <p className="text-xl font-bold text-secondary-foreground">به آوالوا خوش آمدید</p>
                     <p className="mt-2 text-sm text-muted-foreground">محصولات محبوبتان را با خیال راحت پیدا کنید.</p>
                  </div>
               </div>
            )}
         </section>
         <section className="mb-10">
            <Heading title="منتخب‌های آوالوا" description="محصولات محبوب و تازه‌رسیده، با دقت برای شما انتخاب شده‌اند." />
            {isVariableValid(products) ? <ProductGrid products={products} /> : <ProductSkeletonGrid />}
         </section>
         {isVariableValid(blogs) && blogs.length > 0 ? (
            <section className="mb-10">
               <Separator className="my-8" />
               <Heading title="مجله آوالوا" description="ایده‌ها، پیشنهادها و مطالب خواندنی برای انتخاب بهتر." />
               <BlogPostGrid blogs={blogs} />
            </section>
         ) : null}
      </div>
   )
}
