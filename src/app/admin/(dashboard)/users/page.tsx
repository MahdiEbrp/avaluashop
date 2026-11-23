import { Heading } from '@/components/admin/ui/heading'
import { Separator } from '@/components/admin/ui/separator'
import prisma from '@/lib/prisma'
import Link from 'next/link'

import { UserColumn, UsersTable } from './components/table'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

export default async function UsersPage({
   searchParams,
}: {
   searchParams?: Promise<{ page?: string }>
} = {}) {
   const params = (await searchParams) ?? {}
   const requestedPage = Number.parseInt(params.page ?? '1', 10)
   const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1

   const [totalUsers, users] = await Promise.all([
      prisma.user.count(),
      prisma.user.findMany({
         select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            _count: { select: { orders: true } },
         },
         take: PAGE_SIZE,
         skip: (page - 1) * PAGE_SIZE,
         orderBy: { createdAt: 'desc' },
      }),
   ])

   const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE))
   const formattedUsers: UserColumn[] = users.map((user) => ({
      id: user.id,
      name: user.name ?? '—',
      email: user.email ?? '—',
      phone: user.phone ?? '—',
      orders: user._count.orders,
   }))

   return (
      <div className="my-6 block space-y-4">
         <Heading
            title={`مشتریان (${new Intl.NumberFormat('fa-IR').format(totalUsers)})`}
            description="مدیریت اطلاعات و سابقه سفارش مشتریان"
         />
         <Separator />
         <UsersTable data={formattedUsers} />
         <div className="flex items-center justify-between text-sm">
            <span>صفحه {new Intl.NumberFormat('fa-IR').format(page)} از {new Intl.NumberFormat('fa-IR').format(totalPages)}</span>
            <div className="flex gap-2">
               {page > 1 ? (
                  <Link className="rounded-md border px-3 py-2" href={`/admin/users?page=${page - 1}`}>قبلی</Link>
               ) : (
                  <span aria-disabled="true" className="rounded-md border px-3 py-2 text-muted-foreground">قبلی</span>
               )}
               {page < totalPages ? (
                  <Link className="rounded-md border px-3 py-2" href={`/admin/users?page=${page + 1}`}>بعدی</Link>
               ) : (
                  <span aria-disabled="true" className="rounded-md border px-3 py-2 text-muted-foreground">بعدی</span>
               )}
            </div>
         </div>
      </div>
   )
}
