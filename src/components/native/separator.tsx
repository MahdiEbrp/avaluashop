import { cn } from '@/lib/utils'

export function Separator({ className }: Readonly<{ className?: string }>) {
   return <hr className={cn('h-px my-4 bg-muted border-0', className)} />
}
