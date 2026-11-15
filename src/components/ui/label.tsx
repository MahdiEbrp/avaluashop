'use client'

import { cn } from '@/lib/utils'
import * as LabelPrimitive from '@radix-ui/react-label'
import { type VariantProps, cva } from 'class-variance-authority'
import * as React from 'react'

const labelVariants = cva(
   'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
   {
      variants: {
         variant: {
            default: '',
            /** Quiet caption-style label. */
            subtle: 'text-sm font-light text-foreground/60',
            /** Validation failure. */
            error: 'text-destructive',
         },
      },
      defaultVariants: {
         variant: 'default',
      },
   }
)

const Label = React.forwardRef<
   React.ComponentRef<typeof LabelPrimitive.Root>,
   React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
      VariantProps<typeof labelVariants>
>(({ className, variant, ...props }, ref) => (
   <LabelPrimitive.Root
      ref={ref}
      className={cn(labelVariants({ variant }), className)}
      {...props}
   />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
