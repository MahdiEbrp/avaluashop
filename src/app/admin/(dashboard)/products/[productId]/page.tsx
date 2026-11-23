import prisma from '@/lib/prisma'

import { ProductForm } from './components/product-form'

export const dynamic = 'force-dynamic'

export default async function ProductPage({
   params,
}: Readonly<{
   params: Promise<{ productId: string }>
}>) {
   const { productId } = await params

   const product = await prisma.product.findUnique({
      where: {
         id: productId,
      },
      include: {
         categories: true,
         brand: true,
      },
   })

   const [categories, brands] = await Promise.all([
      prisma.category.findMany({ orderBy: { title: 'asc' } }),
      prisma.brand.findMany({ orderBy: { title: 'asc' } }),
   ])

   return (
      <div className="flex-col">
         <div className="flex-1 space-y-4 pt-6 pb-12">
            <ProductForm categories={categories} brands={brands} initialData={product} />
         </div>
      </div>
   )
}
