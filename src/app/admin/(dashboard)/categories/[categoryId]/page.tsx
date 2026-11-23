import prisma from '@/lib/prisma'

import { CategoryForm } from './components/category-form'

export const dynamic = 'force-dynamic'

const CategoryPage = async ({
   params,
}: {
   params: Promise<{ categoryId: string }>
}) => {
   const { categoryId } = await params

   const category = await prisma.category.findUnique({
      where: {
         id: categoryId,
      },
   })

   return (
      <div className="flex-col">
         <div className="flex-1 space-y-4 p-8 pt-6">
            <CategoryForm initialData={category} />
         </div>
      </div>
   )
}

export default CategoryPage
