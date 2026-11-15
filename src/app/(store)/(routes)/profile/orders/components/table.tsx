'use client'

import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import type { TableFeatures } from '@/lib/table-features'
import { type ColumnDef } from '@tanstack/react-table'
import { CheckIcon, EditIcon as Icon, XIcon } from 'lucide-react'
import Link from 'next/link'

export interface OrderColumn {
   id: string
   isPaid: boolean
   payable: string
   number: string
   createdAt: string
}

export const columns: ColumnDef<TableFeatures, OrderColumn>[] = [
   {
      accessorKey: 'number',
      header: 'Order Number',
   },
   {
      accessorKey: 'date',
      header: 'Date',
   },
   {
      accessorKey: 'payable',
      header: 'Payable',
   },
   {
      accessorKey: 'isPaid',
      header: 'Paid',
      cell: (props) => {
         return props.cell.getValue() ? <CheckIcon /> : <XIcon />
      },
   },
   {
      id: 'actions',
      cell: ({ row }) => (
         <Link href={`/profile/orders/${row.original.id}`}>
            <Button size="icon" variant="outline">
               <Icon className="h-4" />
            </Button>
         </Link>
      ),
   },
]

interface OrdersTableProps {
   data: OrderColumn[]
}

export const OrdersTable: React.FC<OrdersTableProps> = ({ data }) => {
   return <DataTable searchKey="products" columns={columns} data={data} />
}
