import { getGraphRevenue } from '@/actions/get-graph-revenue'
import { getSalesCount } from '@/actions/get-sales-count'
import { getStockCount } from '@/actions/get-stock-count'
import { getTotalRevenue } from '@/actions/get-total-revenue'
import { Overview } from '@/components/admin/overview'
import {
   Card,
   CardContent,
   CardHeader,
   CardTitle,
} from '@/components/admin/ui/card'
import { Heading } from '@/components/admin/ui/heading'
import { Separator } from '@/components/admin/ui/separator'
import { CreditCard, DollarSign, Package } from 'lucide-react'

const formatToman = (value: number) =>
   `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(Math.round(value))} تومان`

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
   const totalRevenue = await getTotalRevenue()
   const graphRevenue = await getGraphRevenue()
   const salesCount = await getSalesCount()
   const stockCount = await getStockCount()

   return (
      <div className="flex-col">
         <div className="flex-1 space-y-4 pt-4">
            <Heading title="داشبورد فروشگاه" description="خلاصه عملکرد فروشگاه آوالونا" />
            <Separator />
            <div className="grid gap-4 grid-cols-3">
               <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                     <CardTitle className="text-sm font-medium">
                        درآمد کل سفارش‌های پرداخت‌شده
                     </CardTitle>
                     <DollarSign className="h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                     <div className="text-2xl font-bold">
                        {formatToman(totalRevenue)}
                     </div>
                  </CardContent>
               </Card>
               <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                     <CardTitle className="text-sm font-medium">
                        تعداد سفارش‌های پرداخت‌شده
                     </CardTitle>
                     <CreditCard className="h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                     <div className="text-2xl font-bold">{new Intl.NumberFormat('fa-IR').format(salesCount)}</div>
                  </CardContent>
               </Card>
               <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                     <CardTitle className="text-sm font-medium">
                        محصولات دارای موجودی
                     </CardTitle>
                     <Package className="h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                     <div className="text-2xl font-bold">{new Intl.NumberFormat('fa-IR').format(stockCount)}</div>
                  </CardContent>
               </Card>
            </div>
            <Card className="col-span-4">
               <CardHeader>
                  <CardTitle>فروش ماهانه در سال جاری</CardTitle>
               </CardHeader>
               <CardContent className="pl-2">
                  <Overview data={graphRevenue} />
               </CardContent>
            </Card>
         </div>
      </div>
   )
}
