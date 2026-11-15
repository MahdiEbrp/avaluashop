import prisma from '@/lib/prisma'

import { CategoryForm } from './components/category-form'

export const dynamic = 'force-dynamic'

const CategoryPage = async ({
   params,
}: {
   params: Promise<{ categoryId: string; id: string }>
}) => {
   const { categoryId, id } = await params

   const category = await prisma.category.findUnique({
      where: {
         id: categoryId,
      },
   })

   const banners = await prisma.banner.findMany({
      where: {
         id: id,
      },
   })

   return (
      <div className="flex-col">
         <div className="flex-1 space-y-4 p-8 pt-6">
            <CategoryForm banners={banners} initialData={category} />
         </div>
      </div>
   )
}

export default CategoryPage
