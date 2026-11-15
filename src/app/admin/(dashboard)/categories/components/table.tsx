'use client'

import { Button } from '@/components/admin/ui/button'
import { DataTable } from '@/components/admin/ui/data-table'
import type { TableFeatures } from '@/lib/table-features'
import { type ColumnDef } from '@tanstack/react-table'
import { EditIcon } from 'lucide-react'
import Link from 'next/link'

export interface CategoryColumn {
   id: string
   title: string
   products: number
}

export const columns: ColumnDef<TableFeatures, CategoryColumn>[] = [
   {
      accessorKey: 'title',
      header: 'Title',
   },
   {
      accessorKey: 'products',
      header: 'Products #',
   },
   {
      id: 'actions',
      cell: ({ row }) => (
         <Link href={`/admin/categories/${row.original.id}`}>
            <Button size="icon" variant="outline">
               <EditIcon className="h-4" />
            </Button>
         </Link>
      ),
   },
]

interface CategoriesClientProps {
   data: CategoryColumn[]
}

export const CategoriesClient: React.FC<CategoriesClientProps> = ({ data }) => {
   return <DataTable searchKey="title" columns={columns} data={data} />
}
