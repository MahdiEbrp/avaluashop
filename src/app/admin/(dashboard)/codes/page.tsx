import { Heading } from '@/components/admin/ui/heading'
import { Separator } from '@/components/admin/ui/separator'

import { DiscountCodesClient } from './components/codes-client'

export const dynamic = 'force-dynamic'

export default function DiscountCodesPage() {
   return (
      <div className="my-6 block space-y-4">
         <Heading
            title="کدهای تخفیف"
            description="ساخت، ویرایش و مدیریت اعتبار کدهای تخفیف"
         />
         <Separator />
         <DiscountCodesClient />
      </div>
   )
}
