import { Heading } from '@/components/admin/ui/heading'
import { Separator } from '@/components/admin/ui/separator'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function PaymentPage({
   params,
}: Readonly<{
   params: Promise<{ paymentId: string }>
}>) {
   const { paymentId } = await params

   const payment = await prisma.payment.findUnique({
      where: {
         id: paymentId,
      },
      include: {
         provider: true,
         user: true,
      },
   })

   if (!payment) {
      return (
         <div className="block space-y-4 my-6">
            <Heading
               title="Payment Data"
               description="This payment could not be found."
            />
            <Separator />
         </div>
      )
   }

   return (
      <div className="block space-y-4 my-6">
         <Heading
            title="Payment Data"
            description="Items in this order and data about the user."
         />
         <Separator />
      </div>
   )
}
