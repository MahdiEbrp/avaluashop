import Carousel from '@/components/native/Carousel'
import prisma from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { ChevronLeftIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { DataSection } from './components/data'

export const dynamic = 'force-dynamic'

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

interface Props {
   params: Promise<{ productId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
   const { productId } = await params
   const product = await prisma.product.findFirst({
      where: {
         id: productId,
         categories: { some: { title: { in: WOMENS_ACCESSORY_CATEGORIES } } },
      },
   })

   if (!product) return { title: 'محصول پیدا نشد' }

   return {
      title: product.title,
      description: product.description,
      keywords: product.keywords,
      openGraph: { images: product.images },
   }
}

export default async function Product({
   params,
}: Readonly<{
   params: Promise<{ productId: string }>
}>) {
   const { productId } = await params
   const product = await prisma.product.findFirst({
      where: {
         id: productId,
         categories: { some: { title: { in: WOMENS_ACCESSORY_CATEGORIES } } },
      },
      include: { brand: true, categories: true },
   })

   if (!product) notFound()

   return (
      <div dir="rtl">
         <Breadcrumbs product={product} />
         <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="relative col-span-1 min-h-[50vh] w-full">
               <Carousel images={product.images} />
            </div>
            <DataSection product={product} />
         </div>
      </div>
   )
}

const Breadcrumbs = ({ product }) => (
   <nav className="flex text-muted-foreground" aria-label="مسیر صفحه">
      <ol className="inline-flex items-center gap-2">
         <li>
            <Link href="/" className="text-sm font-medium">خانه</Link>
         </li>
         <li className="flex items-center gap-2">
            <ChevronLeftIcon className="h-4 w-4" />
            <Link className="text-sm font-medium" href="/products">فروشگاه</Link>
         </li>
         <li aria-current="page" className="flex items-center gap-2">
            <ChevronLeftIcon className="h-4 w-4" />
            <span className="text-sm font-medium">{product.title}</span>
         </li>
      </ol>
   </nav>
)
