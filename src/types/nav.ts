import type React from 'react'

export interface NavItem {
   title: string
   href?: string
   disabled?: boolean
   external?: boolean
   icon?: React.ComponentType<{ className?: string }>
   label?: string
}
