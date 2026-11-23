'use client'

import { Button } from '@/components/admin/ui/button'
import { DataTable } from '@/components/admin/ui/data-table'
import type { TableFeatures } from '@/lib/table-features'
import { type ColumnDef } from '@tanstack/react-table'
import { CheckIcon, EditIcon, XIcon } from 'lucide-react'
import Link from 'next/link'

interface ProductsTableProps {
   data: ProductColumn[]
}

export const ProductsTable: React.FC<ProductsTableProps> = ({ data }) => {
   return <DataTable searchKey="title" columns={columns} data={data} />
}

export interface ProductColumn {
   id: string
   title: string
   price: string
   discount: string
   category: string
   sales: number
   stock: number
   isAvailable: boolean
}

export const columns: ColumnDef<TableFeatures, ProductColumn>[] = [
   {
      accessorKey: 'title',
      header: 'Title',
   },
   {
      accessorKey: 'price',
      header: 'Price',
   },
   {
      accessorKey: 'discount',
      header: 'Discount',
   },
   {
      accessorKey: 'category',
      header: 'Category',
   },
   {
      accessorKey: 'stock',
      header: 'Stock',
   },
   {
      accessorKey: 'sales',
      header: 'Sales #',
   },
   {
      accessorKey: 'isAvailable',
      header: 'Availability',
      cell: (props) => (props.cell.getValue() ? <CheckIcon /> : <XIcon />),
   },
   {
      id: 'actions',
      cell: ({ row }) => (
         <Link href={`/admin/products/${row.original.id}`}>
            <Button size="icon" variant="outline">
               <EditIcon className="h-4" />
            </Button>
         </Link>
      ),
   },
]
