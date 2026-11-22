'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Loader } from '@/components/ui/loader'
import { useAuthenticated } from '@/hooks/useAuthentication'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { UserCombobox } from '../components/switcher'
import type { OrderColumn } from './components/table'
import { OrdersTable } from './components/table'

interface OrderListItem {
   id: string
   number: number
   createdAt: string
   payable: number
   isPaid: boolean
}

const money = new Intl.NumberFormat('fa-IR')
const toman = (value: number) => `${money.format(Math.round(value))} تومان`

export default function UserPage() {
   const { authenticated } = useAuthenticated()
   const [orders, setOrders] = useState<OrderColumn[] | null>(null)
   const pathname = usePathname()

   useEffect(() => {
      async function getOrders() {
         try {
            const response = await fetch('/api/orders', {
               method: 'GET',
               cache: 'no-store',
            })
            const result = (await response.json()) as OrderListItem[]
            const formatted: OrderColumn[] = result.map((order) => ({
               id: order.id,
               number: `#${money.format(order.number)}`,
               createdAt: new Intl.DateTimeFormat('fa-IR', {
                  dateStyle: 'medium',
               }).format(new Date(order.createdAt)),
               payable: toman(order.payable),
               isPaid: order.isPaid,
            }))
            setOrders(formatted)
         } catch (error) {
            console.error({ error })
         }
      }

      if (authenticated) void getOrders()
   }, [authenticated])

   function renderOrdersContent() {
      const resolvedOrders = authenticated ? orders : []
      if (resolvedOrders === null) {
         return (
            <Card variant="muted" className="my-4">
               <CardContent className="flex min-h-48 items-center justify-center">
                  <Loader />
               </CardContent>
            </Card>
         )
      }
      if (resolvedOrders.length === 0) {
         return (
            <Card className="my-4">
               <CardContent className="py-10 text-center">
                  <p className="font-semibold">هنوز سفارشی ثبت نکرده‌اید.</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                     پس از ثبت سفارش، وضعیت و جزئیات آن را از این بخش دنبال کنید.
                  </p>
               </CardContent>
            </Card>
         )
      }
      return <OrdersTable data={resolvedOrders} />
   }

   return (
      <div className="pb-8" dir="rtl">
         <div className="mb-4 flex items-center justify-between">
            <UserCombobox initialValue={pathname} />
         </div>
         {renderOrdersContent()}
      </div>
   )
}
