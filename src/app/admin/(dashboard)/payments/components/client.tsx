'use client'

import { DataTable } from '@/components/admin/ui/data-table'
import { Heading } from '@/components/admin/ui/heading'
import { Separator } from '@/components/admin/ui/separator'

import { PaymentColumn, columns } from './columns'

interface PaymentClientProps {
   data: PaymentColumn[]
}

export const PaymentClient: React.FC<PaymentClientProps> = ({ data }) => {
   return (
      <div className="block space-y-4 my-6">
         <Heading
            title={`Payments (${data.length})`}
            description="Manage orders for your store"
         />
         <Separator />
         <DataTable searchKey="products" columns={columns} data={data} />
      </div>
   )
}
