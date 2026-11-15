import prisma from '@/lib/prisma'

import { BannerForm } from './components/banner-form'

export const dynamic = 'force-dynamic'

const Page = async ({ params }: { params: Promise<{ bannerId: string }> }) => {
   const { bannerId } = await params

   const banner = await prisma.banner.findUnique({
      where: {
         id: bannerId,
      },
   })

   return (
      <div className="flex-col">
         <div className="flex-1 space-y-4 pt-6">
            <BannerForm initialData={banner} />
         </div>
      </div>
   )
}

export default Page
