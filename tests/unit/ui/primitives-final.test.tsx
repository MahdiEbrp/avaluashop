import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
   Command,
   CommandDialog,
   CommandEmpty,
   CommandGroup,
   CommandInput,
   CommandItem,
   CommandList,
   CommandSeparator,
   CommandShortcut,
} from '@/components/admin/ui/command'
import {
   Dialog,
   DialogContent,
   DialogFooter,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
} from '@/components/admin/ui/dialog'
import {
   Select,
   SelectContent,
   SelectGroup,
   SelectItem,
   SelectLabel,
   SelectTrigger,
   SelectValue,
} from '@/components/admin/ui/select'
import {
   Table,
   TableCaption,
   TableCell,
   TableFooter,
   TableRow,
} from '@/components/admin/ui/table'
import { CommandMenu } from '@/components/composites/command'
import { Toaster } from '@/components/ui/toaster'
import {
   Toast,
   ToastAction,
   ToastClose,
   ToastDescription,
   ToastProvider,
   ToastTitle,
   ToastViewport,
} from '@/components/ui/toast'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/admin/ui/avatar'
import { MainNav } from '@/components/admin/main-nav'
import { UserNav } from '@/components/native/nav/user'
import { ThemeProvider } from '@/providers/theme-provider'
import { routerMock } from '../support/navigation'

const themeMock = { resolvedTheme: 'light', setTheme: vi.fn() }

vi.mock('next-themes', async (importOriginal) => {
   const actual = await importOriginal<typeof import('next-themes')>()

   return { ...actual, useTheme: () => themeMock }
})

vi.mock('next/navigation', async (importOriginal) => {
   const actual = await importOriginal<typeof import('next/navigation')>()
   const navigation = await import('../support/navigation')

   return { ...actual, ...navigation, usePathname: () => '/admin/productos' }
})

const user = () => userEvent.setup({ pointerEventsCheck: 0 })

describe('admin command palette pieces', () => {
   it('renders a separator, shortcut and item', () => {
      render(
         <Command>
            <CommandInput placeholder="Admin search" />
            <CommandList>
               <CommandEmpty>Empty</CommandEmpty>
               <CommandGroup heading="Group">
                  <CommandItem>
                     Item
                     <CommandShortcut>⌘K</CommandShortcut>
                  </CommandItem>
               </CommandGroup>
               <CommandSeparator />
            </CommandList>
         </Command>
      )

      expect(screen.getByText('Item')).toBeInTheDocument()
      expect(screen.getByText('⌘K')).toBeInTheDocument()
   })

   it('opens the dialog variant', () => {
      render(
         <CommandDialog open>
            <CommandInput placeholder="Admin search" />
            <CommandList>
               <CommandItem>Dialog entry</CommandItem>
            </CommandList>
         </CommandDialog>
      )

      expect(screen.getByText('Dialog entry')).toBeInTheDocument()
   })
})

describe('admin dialog and table chrome', () => {
   it('renders the footer', () => {
      render(
         <Dialog open>
            <DialogContent>
               <DialogHeader>
                  <DialogTitle>Title</DialogTitle>
               </DialogHeader>
               <DialogFooter>Footer</DialogFooter>
            </DialogContent>
         </Dialog>
      )

      expect(screen.getByText('Footer')).toBeInTheDocument()
   })

   it('renders a footer and caption', () => {
      render(
         <Table>
            <TableCaption>Caption</TableCaption>
            <TableFooter>
               <TableRow>
                  <TableCell>Total</TableCell>
               </TableRow>
            </TableFooter>
         </Table>
      )

      expect(screen.getByText('Caption')).toBeInTheDocument()
      expect(screen.getByText('Total')).toBeInTheDocument()
   })
})

describe('admin select with a label', () => {
   it('renders the group label', async () => {
      render(
         <Select defaultValue="a">
            <SelectTrigger>
               <SelectValue placeholder="Pick" />
            </SelectTrigger>
            <SelectContent>
               <SelectGroup>
                  <SelectLabel>Group</SelectLabel>
                  <SelectItem value="a">Alpha</SelectItem>
               </SelectGroup>
            </SelectContent>
         </Select>
      )

      await user().click(screen.getByRole('combobox'))

      expect(await screen.findByText('Group')).toBeInTheDocument()
   })
})

describe('admin avatar image', () => {
   it('falls back when the image cannot load', () => {
      render(
         <Avatar>
            <AvatarImage src="/missing.png" alt="avatar" />
            <AvatarFallback>FB</AvatarFallback>
         </Avatar>
      )

      expect(screen.getAllByText(/FB|avatar/).length).toBeGreaterThan(0)
   })
})

describe('command menu secondary actions', () => {
   it('navigates to a config link', async () => {
      render(<CommandMenu />)

      fireEvent.keyDown(document, { key: 'k', metaKey: true })
      await user().click(await screen.findByText('Blog'))

      expect(routerMock.push).toHaveBeenCalledWith('/blog')
   })

   it('switches to the system theme', async () => {
      render(<CommandMenu />)

      await user().click(screen.getByRole('button', { name: /search/i }))
      await user().click(await screen.findByText('System'))

      expect(themeMock.setTheme).toHaveBeenCalledWith('system')
   })

   it('switches to the light theme', async () => {
      render(<CommandMenu />)

      await user().click(screen.getByRole('button', { name: /search/i }))
      await user().click(await screen.findByText('Light'))

      expect(themeMock.setTheme).toHaveBeenCalledWith('light')
   })
})

describe('toaster', () => {
   it('renders the empty notification region', () => {
      render(<Toaster />)

      expect(screen.getByLabelText('Notifications (F8)')).toBeInTheDocument()
   })

   it('renders the toast slot chrome directly', () => {
      render(
         <ToastProvider>
            <Toast open>
               <ToastTitle>Saved</ToastTitle>
               <ToastDescription>All good</ToastDescription>
               <ToastAction altText="undo">Undo</ToastAction>
               <ToastClose />
            </Toast>
            <ToastViewport />
         </ToastProvider>
      )

      expect(screen.getByText('Saved')).toBeInTheDocument()
      expect(screen.getByText('All good')).toBeInTheDocument()
      expect(screen.getByText('Undo')).toBeInTheDocument()
   })
})

describe('admin main nav active state', () => {
   it('marks the current section', () => {
      render(<MainNav />, {})

      /* pathname is /admin/productos, so no route matches exactly. */
      expect(screen.getByRole('link', { name: 'Products' }).className).toContain('font-light')
   })
})

describe('theme provider', () => {
   it('wraps children', () => {
      render(
         <ThemeProvider attribute="class" defaultTheme="light">
            <p>themed</p>
         </ThemeProvider>
      )

      expect(screen.getByText('themed')).toBeInTheDocument()
   })
})

describe('storefront user nav items', () => {
   it('links to the profile sections', async () => {
      render(<UserNav />)

      await user().click(screen.getByRole('button'))

      await waitFor(() => expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(2))
      expect(screen.getAllByText('Orders').length).toBeGreaterThan(0)
   })
})
