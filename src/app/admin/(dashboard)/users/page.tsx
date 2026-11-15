import { Heading } from '@/components/admin/ui/heading'
import { Separator } from '@/components/admin/ui/separator'
import prisma from '@/lib/prisma'

import { UserColumn, UsersTable } from './components/table'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
   const users = await prisma.user.findMany({
      include: {
         orders: true,
      },
      take: 10,
      orderBy: {
         updatedAt: 'desc',
      },
   })

   const formattedUsers: UserColumn[] = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      orders: user.orders.length,
   }))

   return (
      <div className="block space-y-4 my-6">
         <Heading title="Users" description="Manage products for your store" />
         <Separator />
         <UsersTable data={formattedUsers} />
      </div>
   )
}
