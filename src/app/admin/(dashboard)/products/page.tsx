import { Button } from '@/components/admin/ui/button'
import { Heading } from '@/components/admin/ui/heading'
import { Separator } from '@/components/admin/ui/separator'
import prisma from '@/lib/prisma'
import { formatter } from '@/lib/utils'
import { Plus } from 'lucide-react'
import Link from 'next/link'

import { ProductColumn, ProductsTable } from './components/table'

export const dynamic = 'force-dynamic'

export default async function ProductsPage() {
   const products = await prisma.product.findMany({
      include: {
         orders: true,
         categories: true,
         brand: true,
      },
      orderBy: {
         createdAt: 'desc',
      },
   })

   const formattedProducts: ProductColumn[] = products.map((product) => ({
      id: product.id,
      title: product.title,
      price: formatter.format(product.price),
      discount: formatter.format(product.discount),
      category: product.categories[0]?.title ?? '—',
      sales: product.orders.length,
      isAvailable: product.isAvailable,
   }))

   return (
      <div className="block space-y-4 my-6">
         <div className="flex items-center justify-between">
            <Heading
               title={`Products (${products.length})`}
               description="Manage products for your store"
            />
            <Link href="/admin/products/new">
               <Button>
                  <Plus className="mr-2 h-4" /> Add New
               </Button>
            </Link>
         </div>
         <Separator />
         <ProductsTable data={formattedProducts} />
      </div>
   )
}
