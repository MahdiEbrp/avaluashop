import prisma from '@/lib/prisma'

import { AddressForm } from './components/address-form'

export const dynamic = 'force-dynamic'

export default async function AddressPage({
   params,
}: Readonly<{
   params: Promise<{ addressId: string }>
}>) {
   const { addressId } = await params

   const address = await prisma.address.findUnique({
      where: {
         id: addressId,
      },
   })

   return (
      <div className="flex-col">
         <div className="flex-1 space-y-4 p-8 pt-6">
            <AddressForm initialData={address} />
         </div>
      </div>
   )
}
