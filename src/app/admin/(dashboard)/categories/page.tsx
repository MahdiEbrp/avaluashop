import { Button } from '@/components/admin/ui/button'
import { Heading } from '@/components/admin/ui/heading'
import { Separator } from '@/components/admin/ui/separator'
import prisma from '@/lib/prisma'
import { Plus } from 'lucide-react'
import Link from 'next/link'

import { CategoriesClient, CategoryColumn } from './components/table'

export const dynamic = 'force-dynamic'

export default async function CategoriesPage() {
   const categories = await prisma.category.findMany({
      select: {
         id: true,
         title: true,
         _count: { select: { products: true } },
      },
      orderBy: { title: 'asc' },
   })

   const formattedCategories: CategoryColumn[] = categories.map((category) => ({
      id: category.id,
      title: category.title,
      products: category._count.products,
   }))

   return (
      <div className="my-6 block space-y-4">
         <div className="flex items-center justify-between">
            <Heading
               title={`Categories (${categories.length})`}
               description="Manage categories for your store"
            />
            <Link href="/admin/categories/new">
               <Button>
                  <Plus className="mr-2 h-4" /> Add New
               </Button>
            </Link>
         </div>
         <Separator />
         <CategoriesClient data={formattedCategories} />
      </div>
   )
}
