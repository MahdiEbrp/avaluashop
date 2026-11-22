'use client'

import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import type { TableFeatures } from '@/lib/table-features'
import { type ColumnDef } from '@tanstack/react-table'
import { CheckCircle2Icon, ChevronLeftIcon, XCircleIcon } from 'lucide-react'
import Link from 'next/link'

export interface OrderColumn {
   id: string
   isPaid: boolean
   payable: string
   number: string
   date: string
}

export const columns: ColumnDef<TableFeatures, OrderColumn>[] = [
   {
      accessorKey: 'number',
      header: 'شماره سفارش',
   },
   {
      accessorKey: 'date',
      header: 'تاریخ ثبت',
   },
   {
      accessorKey: 'payable',
      header: 'مبلغ نهایی',
   },
   {
      accessorKey: 'isPaid',
      header: 'پرداخت',
      cell: (props) => props.cell.getValue()
         ? <span className="inline-flex items-center gap-1 text-success"><CheckCircle2Icon className="h-4 w-4" /> تأیید شده</span>
         : <span className="inline-flex items-center gap-1 text-muted-foreground"><XCircleIcon className="h-4 w-4" /> تأیید نشده</span>,
   },
   {
      id: 'actions',
      cell: ({ row }) => (
         <Link href={`/profile/orders/${row.original.id}`}>
            <Button size="sm" variant="outline">
               مشاهده جزئیات
               <ChevronLeftIcon className="ms-1 h-4 w-4" />
            </Button>
         </Link>
      ),
   },
]

interface OrdersTableProps {
   data: OrderColumn[]
}

export const OrdersTable: React.FC<OrdersTableProps> = ({ data }) => {
   return <DataTable searchKey="number" columns={columns} data={data} />
}
