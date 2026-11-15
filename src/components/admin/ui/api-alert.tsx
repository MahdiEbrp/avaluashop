import {
   Alert,
   AlertDescription,
   AlertTitle,
} from '@/components/admin/ui/alert'
import { Badge, BadgeProps } from '@/components/admin/ui/badge'
import { Button } from '@/components/admin/ui/button'
import { Copy, Server } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface ApiAlertProps {
   title: string
   description: string
   variant: 'public' | 'admin'
}

const textMap: Record<ApiAlertProps['variant'], string> = {
   public: 'Public',
   admin: 'Admin',
}

const variantMap: Record<ApiAlertProps['variant'], BadgeProps['variant']> = {
   public: 'secondary',
   admin: 'destructive',
}

function onCopy(description: string) {
   void navigator.clipboard.writeText(description)
   toast.success('API Route copied to clipboard.')
}

export const ApiAlert: React.FC<ApiAlertProps> = ({
   title,
   description,
   variant = 'public',
}) => {
   return (
      <Alert>
         <Server className="h-4" />
         <AlertTitle className="flex items-center gap-x-2">
            {title}
            <Badge variant={variantMap[variant]}>{textMap[variant]}</Badge>
         </AlertTitle>
         <AlertDescription className="mt-4 flex items-center justify-between">
            <code className="relative rounded bg-muted px-1 py-1 font-mono text-sm font-semibold">
               {description}
            </code>
            <Button
               variant="outline"
               size="sm"
               onClick={() => {
                  onCopy(description)
               }}
            >
               <Copy className="h-4" />
            </Button>
         </AlertDescription>
      </Alert>
   )
}
