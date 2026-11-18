import { type RenderOptions, render } from '@testing-library/react'
import { type ReactElement, type ReactNode } from 'react'

import { ThemeProvider } from '@/providers/theme-provider'

/** Renders with the same providers the root layout installs. */
export function renderWithProviders(
   ui: ReactElement,
   options: Omit<RenderOptions, 'wrapper'> = {}
) {
   function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
      return (
         <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
            {children}
         </ThemeProvider>
      )
   }

   return render(ui, { wrapper: Wrapper, ...options })
}

/** A `useIsClient`-style hook stub for components that gate on hydration. */
export const asMounted = () => true
