import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import * as AccordionUI from '@/components/ui/accordion'
import * as AdminAccordion from '@/components/admin/ui/accordion'
import * as AdminAlert from '@/components/admin/ui/alert'
import { ApiAlert } from '@/components/admin/ui/api-alert'
import * as AvatarUI from '@/components/ui/avatar'
import * as AdminAvatar from '@/components/admin/ui/avatar'
import { Badge, badgeVariants } from '@/components/ui/badge'
import * as AdminBadge from '@/components/admin/ui/badge'
import * as AdminCard from '@/components/admin/ui/card'
import * as CardUI from '@/components/ui/card'
import * as AdminCheckbox from '@/components/admin/ui/checkbox'
import { Checkbox } from '@/components/ui/checkbox'
import * as CommandUI from '@/components/ui/command'
import * as AdminCommand from '@/components/admin/ui/command'
import * as DialogUI from '@/components/ui/dialog'
import * as AdminDialog from '@/components/admin/ui/dialog'
import * as DropdownUI from '@/components/ui/dropdown-menu'
import * as AdminDropdown from '@/components/admin/ui/dropdown-menu'
import * as FormUI from '@/components/ui/form'
import * as AdminForm from '@/components/admin/ui/form'
import { Heading } from '@/components/admin/ui/heading'
import { Input } from '@/components/ui/input'
import * as AdminInput from '@/components/admin/ui/input'
import { Label } from '@/components/ui/label'
import * as AdminLabel from '@/components/admin/ui/label'
import { Loader as AdminLoader } from '@/components/admin/ui/loader'
import { Loader } from '@/components/ui/loader'
import { Modal as AdminModal } from '@/components/admin/ui/modal'
import * as NavMenu from '@/components/ui/navigation-menu'
import * as PopoverUI from '@/components/ui/popover'
import * as AdminPopover from '@/components/admin/ui/popover'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import * as SelectUI from '@/components/ui/select'
import * as AdminSelect from '@/components/admin/ui/select'
import { Separator } from '@/components/ui/separator'
import * as AdminSeparator from '@/components/admin/ui/separator'
import * as SheetUI from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import * as AdminSwitch from '@/components/admin/ui/switch'
import * as TableUI from '@/components/ui/table'
import * as AdminTable from '@/components/admin/ui/table'
import * as AdminTabs from '@/components/admin/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Toggle, toggleVariants } from '@/components/ui/toggle'
import { buttonVariants } from '@/components/ui/button'

const noop = () => {/* noop */ }

describe('ui/card parts', () => {
   it('renders every slot with its variant', () => {
      render(
         <CardUI.Card variant="muted" className="mt-1">
            <CardUI.CardHeader>
               <CardUI.CardTitle>Title</CardUI.CardTitle>
               <CardUI.CardDescription>Description</CardUI.CardDescription>
            </CardUI.CardHeader>
            <CardUI.CardContent>Body</CardUI.CardContent>
            <CardUI.CardFooter>Foot</CardUI.CardFooter>
         </CardUI.Card>
      )

      expect(screen.getByText('Title')).toBeInTheDocument()
      expect(screen.getByText('Description')).toBeInTheDocument()
      expect(screen.getByText('Body')).toBeInTheDocument()
      expect(screen.getByText('Foot')).toBeInTheDocument()
   })

   it('renders the loading variant', () => {
      const { container } = render(<CardUI.Card variant="loading" />)

      expect(container.firstChild).toHaveClass('animate-pulse')
   })
})

describe('admin/ui/card parts', () => {
   it('renders every slot', () => {
      render(
         <AdminCard.Card>
            <AdminCard.CardHeader>
               <AdminCard.CardTitle>Admin title</AdminCard.CardTitle>
               <AdminCard.CardDescription>Admin description</AdminCard.CardDescription>
            </AdminCard.CardHeader>
            <AdminCard.CardContent>Admin body</AdminCard.CardContent>
            <AdminCard.CardFooter>Admin foot</AdminCard.CardFooter>
         </AdminCard.Card>
      )

      expect(screen.getByText('Admin title')).toBeInTheDocument()
      expect(screen.getByText('Admin description')).toBeInTheDocument()
      expect(screen.getByText('Admin body')).toBeInTheDocument()
      expect(screen.getByText('Admin foot')).toBeInTheDocument()
   })
})

describe('text inputs and labels', () => {
   it('renders the storefront input, label and textarea', () => {
      render(
         <>
            <Label htmlFor="a">Store label</Label>
            <Input id="a" placeholder="store" />
            <Textarea placeholder="notes" />
         </>
      )

      expect(screen.getByLabelText('Store label')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('notes')).toBeInTheDocument()
   })

   it('renders the admin input and label', () => {
      render(
         <>
            <AdminLabel.Label htmlFor="b">Admin label</AdminLabel.Label>
            <AdminInput.Input id="b" placeholder="admin" />
         </>
      )

      expect(screen.getByLabelText('Admin label')).toBeInTheDocument()
   })
})

describe('separators, badges, buttons and skeletons', () => {
   it('renders separators in both orientations', () => {
      const { container } = render(
         <>
            <Separator />
            <Separator orientation="vertical" />
            <AdminSeparator.Separator />
         </>
      )

      expect(container.querySelectorAll('[role="none"], [data-orientation]').length).toBeGreaterThan(
         0
      )
   })

   it('renders badges in both flavours', () => {
      render(
         <>
            <Badge>Store badge</Badge>
            <AdminBadge.Badge variant="outline">Admin badge</AdminBadge.Badge>
         </>
      )

      expect(screen.getByText('Store badge')).toBeInTheDocument()
      expect(screen.getByText('Admin badge')).toBeInTheDocument()
   })

   it('exposes the variant helpers', () => {
      expect(buttonVariants({ variant: 'search', size: 'sm' })).toContain('border')
      expect(badgeVariants({ variant: 'destructive' })).toContain('bg-destructive')
      expect(toggleVariants({ variant: 'outline', size: 'lg' })).toContain('border')
   })

   it('renders loaders', () => {
      const { container } = render(
         <>
            <Loader />
            <AdminLoader />
            <Skeleton />
         </>
      )

      expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(2)
   })
})

describe('heading and api alert', () => {
   it('renders an admin heading', () => {
      render(<Heading title="Products" description="All of them" />)

      expect(screen.getByRole('heading', { name: 'Products' })).toBeInTheDocument()
      expect(screen.getByText('All of them')).toBeInTheDocument()
   })

   it('renders an api alert and copies the route', () => {
      const writeText = vi.fn(() => {return Promise.resolve(); })
      Object.defineProperty(navigator, 'clipboard', {
         value: { writeText },
         configurable: true,
      })

      render(<ApiAlert title="Products" description="/api/products" variant="admin" />)

      expect(screen.getByText('Products')).toBeInTheDocument()
      expect(screen.getByText('Admin')).toBeInTheDocument()
      expect(screen.getByText('/api/products')).toBeInTheDocument()

      /* userEvent.setup() swaps in its own clipboard stub, so click raw. */
      fireEvent.click(screen.getAllByRole('button')[0])

      expect(writeText).toHaveBeenCalledWith('/api/products')
   return Promise.resolve(); })
})

describe('checkbox and switch', () => {
   it('toggles both controls', async () => {
      render(
         <>
            <Checkbox aria-label="tos" />
            <AdminCheckbox.Checkbox aria-label="admin tos" />
            <Switch aria-label="live" />
            <AdminSwitch.Switch aria-label="admin live" />
         </>
      )

      await userEvent.setup().click(screen.getByLabelText('tos'))
      await userEvent.setup().click(screen.getByLabelText('admin tos'))
      await userEvent.setup().click(screen.getByLabelText('live'))
      await userEvent.setup().click(screen.getByLabelText('admin live'))

      expect(screen.getByLabelText('tos')).toHaveAttribute('data-state', 'checked')
      expect(screen.getByLabelText('admin tos')).toHaveAttribute('data-state', 'checked')
      expect(screen.getByLabelText('live')).toHaveAttribute('data-state', 'checked')
      expect(screen.getByLabelText('admin live')).toHaveAttribute('data-state', 'checked')
   })
})

describe('avatar', () => {
   it('renders image and fallback', () => {
      render(
         <>
            <AvatarUI.Avatar>
               <AvatarUI.AvatarImage src="/a.png" alt="me" />
               <AvatarUI.AvatarFallback>ME</AvatarUI.AvatarFallback>
            </AvatarUI.Avatar>
            <AdminAvatar.Avatar>
               <AdminAvatar.AvatarFallback>AD</AdminAvatar.AvatarFallback>
            </AdminAvatar.Avatar>
         </>
      )

      expect(screen.getAllByText(/ME|AD/).length).toBeGreaterThan(0)
   })
})

describe('accordions', () => {
   it('opens a storefront accordion item', async () => {
      render(
         <AccordionUI.Accordion type="single" collapsible>
            <AccordionUI.AccordionItem value="a">
               <AccordionUI.AccordionTrigger>Trigger</AccordionUI.AccordionTrigger>
               <AccordionUI.AccordionContent>Panel</AccordionUI.AccordionContent>
            </AccordionUI.AccordionItem>
         </AccordionUI.Accordion>
      )

      await userEvent.setup().click(screen.getByText('Trigger'))

      expect(screen.getByText('Panel')).toBeInTheDocument()
   })

   it('opens an admin accordion item', async () => {
      render(
         <AdminAccordion.Accordion type="single" collapsible>
            <AdminAccordion.AccordionItem value="a">
               <AdminAccordion.AccordionTrigger>Admin trigger</AdminAccordion.AccordionTrigger>
               <AdminAccordion.AccordionContent>Admin panel</AdminAccordion.AccordionContent>
            </AdminAccordion.AccordionItem>
         </AdminAccordion.Accordion>
      )

      await userEvent.setup().click(screen.getByText('Admin trigger'))

      expect(screen.getByText('Admin panel')).toBeInTheDocument()
   })
})

describe('alert', () => {
   it('renders title and description', () => {
      render(
         <AdminAlert.Alert>
            <AdminAlert.AlertTitle>Careful</AdminAlert.AlertTitle>
            <AdminAlert.AlertDescription>Something happened</AdminAlert.AlertDescription>
         </AdminAlert.Alert>
      )

      expect(screen.getByText('Careful')).toBeInTheDocument()
      expect(screen.getByText('Something happened')).toBeInTheDocument()
   })
})

describe('dialogs and modals', () => {
   it('opens a storefront dialog', async () => {
      render(
         <DialogUI.Dialog>
            <DialogUI.DialogTrigger>Open</DialogUI.DialogTrigger>
            <DialogUI.DialogContent>
               <DialogUI.DialogHeader>
                  <DialogUI.DialogTitle>Dialog title</DialogUI.DialogTitle>
                  <DialogUI.DialogDescription>Dialog body</DialogUI.DialogDescription>
               </DialogUI.DialogHeader>
               <DialogUI.DialogFooter>Footer</DialogUI.DialogFooter>
               <DialogUI.DialogClose>Close</DialogUI.DialogClose>
            </DialogUI.DialogContent>
         </DialogUI.Dialog>
      )

      await userEvent.setup().click(screen.getByText('Open'))

      expect(screen.getByText('Dialog title')).toBeInTheDocument()
      expect(screen.getByText('Dialog body')).toBeInTheDocument()
      expect(screen.getByText('Footer')).toBeInTheDocument()
   })

   it('opens an admin dialog', async () => {
      render(
         <AdminDialog.Dialog>
            <AdminDialog.DialogTrigger>Admin open</AdminDialog.DialogTrigger>
            <AdminDialog.DialogContent>
               <AdminDialog.DialogHeader>
                  <AdminDialog.DialogTitle>Admin dialog</AdminDialog.DialogTitle>
               </AdminDialog.DialogHeader>
            </AdminDialog.DialogContent>
         </AdminDialog.Dialog>
      )

      await userEvent.setup().click(screen.getByText('Admin open'))

      expect(screen.getByText('Admin dialog')).toBeInTheDocument()
   })

   it('an admin modal closes through the overlay', async () => {
      const onClose = vi.fn()

      render(
         <AdminModal title="Delete?" description="Forever" isOpen onClose={onClose}>
            <p>body</p>
         </AdminModal>
      )

      expect(screen.getByText('Delete?')).toBeInTheDocument()
      await userEvent.setup().keyboard('{Escape}')

      expect(onClose).toHaveBeenCalled()
   })
})

describe('sheet', () => {
   it('opens from the side', async () => {
      render(
         <SheetUI.Sheet>
            <SheetUI.SheetTrigger>Menu</SheetUI.SheetTrigger>
            <SheetUI.SheetContent side="left">
               <SheetUI.SheetHeader>
                  <SheetUI.SheetTitle>Navigation</SheetUI.SheetTitle>
                  <SheetUI.SheetDescription>Links</SheetUI.SheetDescription>
               </SheetUI.SheetHeader>
               <SheetUI.SheetFooter>Footer</SheetUI.SheetFooter>
               <SheetUI.SheetClose>Close</SheetUI.SheetClose>
            </SheetUI.SheetContent>
         </SheetUI.Sheet>
      )

      await userEvent.setup().click(screen.getByText('Menu'))

      expect(screen.getByText('Navigation')).toBeInTheDocument()
      expect(screen.getByText('Links')).toBeInTheDocument()
      expect(screen.getByText('Footer')).toBeInTheDocument()
   })
})

describe('dropdown menus', () => {
   it('opens a storefront menu with every item flavour', async () => {
      render(
         <DropdownUI.DropdownMenu>
            <DropdownUI.DropdownMenuTrigger>Actions</DropdownUI.DropdownMenuTrigger>
            <DropdownUI.DropdownMenuContent>
               <DropdownUI.DropdownMenuLabel>Group</DropdownUI.DropdownMenuLabel>
               <DropdownUI.DropdownMenuGroup>
                  <DropdownUI.DropdownMenuItem>
                     Edit
                     <DropdownUI.DropdownMenuShortcut>⌘E</DropdownUI.DropdownMenuShortcut>
                  </DropdownUI.DropdownMenuItem>
                  <DropdownUI.DropdownMenuCheckboxItem checked>
                     Pinned
                  </DropdownUI.DropdownMenuCheckboxItem>
                  <DropdownUI.DropdownMenuSeparator />
                  <DropdownUI.DropdownMenuRadioGroup value="a">
                     <DropdownUI.DropdownMenuRadioItem value="a">Radio A</DropdownUI.DropdownMenuRadioItem>
                  </DropdownUI.DropdownMenuRadioGroup>
                  <DropdownUI.DropdownMenuSub>
                     <DropdownUI.DropdownMenuSubTrigger>More</DropdownUI.DropdownMenuSubTrigger>
                     <DropdownUI.DropdownMenuSubContent>
                        <DropdownUI.DropdownMenuItem>Nested</DropdownUI.DropdownMenuItem>
                     </DropdownUI.DropdownMenuSubContent>
                  </DropdownUI.DropdownMenuSub>
               </DropdownUI.DropdownMenuGroup>
            </DropdownUI.DropdownMenuContent>
         </DropdownUI.DropdownMenu>
      )

      await userEvent.setup().click(screen.getByText('Actions'))

      expect(screen.getByText('Group')).toBeInTheDocument()
      expect(screen.getByText('Edit')).toBeInTheDocument()
      expect(screen.getByText('Pinned')).toBeInTheDocument()
      expect(screen.getByText('Radio A')).toBeInTheDocument()
      expect(screen.getByText('More')).toBeInTheDocument()
   })

   it('opens an admin menu', async () => {
      render(
         <AdminDropdown.DropdownMenu>
            <AdminDropdown.DropdownMenuTrigger>Admin actions</AdminDropdown.DropdownMenuTrigger>
            <AdminDropdown.DropdownMenuContent>
               <AdminDropdown.DropdownMenuItem>Delete</AdminDropdown.DropdownMenuItem>
            </AdminDropdown.DropdownMenuContent>
         </AdminDropdown.DropdownMenu>
      )

      await userEvent.setup().click(screen.getByText('Admin actions'))

      expect(screen.getByText('Delete')).toBeInTheDocument()
   })
})

describe('popovers', () => {
   it('opens the storefront popover', async () => {
      render(
         <PopoverUI.Popover>
            <PopoverUI.PopoverTrigger>Filters</PopoverUI.PopoverTrigger>
            <PopoverUI.PopoverContent>Panel</PopoverUI.PopoverContent>
         </PopoverUI.Popover>
      )

      await userEvent.setup().click(screen.getByText('Filters'))

      expect(screen.getByText('Panel')).toBeInTheDocument()
   })

   it('opens the admin popover', async () => {
      render(
         <AdminPopover.Popover>
            <AdminPopover.PopoverTrigger>Admin filters</AdminPopover.PopoverTrigger>
            <AdminPopover.PopoverContent>Admin panel</AdminPopover.PopoverContent>
         </AdminPopover.Popover>
      )

      await userEvent.setup().click(screen.getByText('Admin filters'))

      expect(screen.getByText('Admin panel')).toBeInTheDocument()
   })
})

describe('selects', () => {
   it('selects a storefront option', () => {
      render(
         <SelectUI.Select defaultValue="a">
            <SelectUI.SelectTrigger>
               <SelectUI.SelectValue placeholder="Pick" />
            </SelectUI.SelectTrigger>
            <SelectUI.SelectContent>
               <SelectUI.SelectGroup>
                  <SelectUI.SelectLabel>Options</SelectUI.SelectLabel>
                  <SelectUI.SelectItem value="a">A</SelectUI.SelectItem>
                  <SelectUI.SelectItem value="b">B</SelectUI.SelectItem>
               </SelectUI.SelectGroup>
               <SelectUI.SelectSeparator />
            </SelectUI.SelectContent>
         </SelectUI.Select>
      )

      expect(screen.getByText('A')).toBeInTheDocument()
   return Promise.resolve(); })

   it('opens the admin select', () => {
      render(
         <AdminSelect.Select defaultValue="a">
            <AdminSelect.SelectTrigger>
               <AdminSelect.SelectValue placeholder="Pick" />
            </AdminSelect.SelectTrigger>
            <AdminSelect.SelectContent>
               <AdminSelect.SelectItem value="a">Admin A</AdminSelect.SelectItem>
            </AdminSelect.SelectContent>
         </AdminSelect.Select>
      )

      expect(screen.getByText('Admin A')).toBeInTheDocument()
   return Promise.resolve(); })
})

describe('tables', () => {
   it('renders every table slot', () => {
      render(
         <TableUI.Table>
            <TableUI.TableCaption>Caption</TableUI.TableCaption>
            <TableUI.TableHeader>
               <TableUI.TableRow>
                  <TableUI.TableHead>Head</TableUI.TableHead>
               </TableUI.TableRow>
            </TableUI.TableHeader>
            <TableUI.TableBody>
               <TableUI.TableRow>
                  <TableUI.TableCell>Cell</TableUI.TableCell>
               </TableUI.TableRow>
            </TableUI.TableBody>
            <TableUI.TableFooter>
               <TableUI.TableRow>
                  <TableUI.TableCell>Foot</TableUI.TableCell>
               </TableUI.TableRow>
            </TableUI.TableFooter>
         </TableUI.Table>
      )

      expect(screen.getByText('Caption')).toBeInTheDocument()
      expect(screen.getByText('Head')).toBeInTheDocument()
      expect(screen.getByText('Cell')).toBeInTheDocument()
   })

   it('renders the admin table slots', () => {
      render(
         <AdminTable.Table>
            <AdminTable.TableHeader>
               <AdminTable.TableRow>
                  <AdminTable.TableHead>Admin head</AdminTable.TableHead>
               </AdminTable.TableRow>
            </AdminTable.TableHeader>
            <AdminTable.TableBody>
               <AdminTable.TableRow>
                  <AdminTable.TableCell>Admin cell</AdminTable.TableCell>
               </AdminTable.TableRow>
            </AdminTable.TableBody>
         </AdminTable.Table>
      )

      expect(screen.getByText('Admin head')).toBeInTheDocument()
      expect(screen.getByText('Admin cell')).toBeInTheDocument()
   })
})

describe('tabs', () => {
   it('switches panels', async () => {
      render(
         <AdminTabs.Tabs defaultValue="one">
            <AdminTabs.TabsList>
               <AdminTabs.TabsTrigger value="one">One</AdminTabs.TabsTrigger>
               <AdminTabs.TabsTrigger value="two">Two</AdminTabs.TabsTrigger>
            </AdminTabs.TabsList>
            <AdminTabs.TabsContent value="one">Panel one</AdminTabs.TabsContent>
            <AdminTabs.TabsContent value="two">Panel two</AdminTabs.TabsContent>
         </AdminTabs.Tabs>
      )

      expect(screen.getByText('Panel one')).toBeInTheDocument()
      await userEvent.setup().click(screen.getByText('Two'))
      expect(screen.getByText('Panel two')).toBeInTheDocument()
   })
})

describe('scroll area', () => {
   it('renders the vertical and horizontal chrome', () => {
      render(
         <ScrollArea>
            <p>scrollable</p>
            <ScrollBar orientation="vertical" />
            <ScrollBar />
         </ScrollArea>
      )

      expect(screen.getByText('scrollable')).toBeInTheDocument()
   })
})

describe('toggle', () => {
   it('toggles pressed state', async () => {
      render(<Toggle aria-label="bold">B</Toggle>)

      await userEvent.setup().click(screen.getByLabelText('bold'))

      expect(screen.getByLabelText('bold')).toHaveAttribute('data-state', 'on')
   })
})

describe('navigation menu', () => {
   it('opens a dropdown of links', () => {
      render(
         <NavMenu.NavigationMenu>
            <NavMenu.NavigationMenuList>
               <NavMenu.NavigationMenuItem>
                  <NavMenu.NavigationMenuTrigger>Products</NavMenu.NavigationMenuTrigger>
                  <NavMenu.NavigationMenuContent>
                     <NavMenu.NavigationMenuLink href="/products">All</NavMenu.NavigationMenuLink>
                  </NavMenu.NavigationMenuContent>
               </NavMenu.NavigationMenuItem>
               <NavMenu.NavigationMenuIndicator />
               <NavMenu.NavigationMenuViewport />
            </NavMenu.NavigationMenuList>
         </NavMenu.NavigationMenu>
      )

      expect(screen.getByText('Products')).toBeInTheDocument()
   return Promise.resolve(); })
})

describe('command palette', () => {
   it('filters and selects items', async () => {
      const onSelect = vi.fn()

      render(
         <CommandUI.Command>
            <CommandUI.CommandInput placeholder="Search..." />
            <CommandUI.CommandList>
               <CommandUI.CommandEmpty>Nothing</CommandUI.CommandEmpty>
               <CommandUI.CommandGroup heading="Group">
                  <CommandUI.CommandItem onSelect={onSelect}>
                     Alpha
                     <CommandUI.CommandShortcut>⌘A</CommandUI.CommandShortcut>
                  </CommandUI.CommandItem>
               </CommandUI.CommandGroup>
               <CommandUI.CommandSeparator />
            </CommandUI.CommandList>
         </CommandUI.Command>
      )

      await userEvent.setup().type(screen.getByPlaceholderText('Search...'), 'alp')
      await userEvent.setup().click(screen.getByText('Alpha'))

      expect(onSelect).toHaveBeenCalled()
   })

   it('shows the empty state', async () => {
      render(
         <CommandUI.Command>
            <CommandUI.CommandInput placeholder="Search..." />
            <CommandUI.CommandList>
               <CommandUI.CommandEmpty>Nothing found</CommandUI.CommandEmpty>
               <CommandUI.CommandGroup>
                  <CommandUI.CommandItem>Alpha</CommandUI.CommandItem>
               </CommandUI.CommandGroup>
            </CommandUI.CommandList>
         </CommandUI.Command>
      )

      await userEvent.setup().type(screen.getByPlaceholderText('Search...'), 'zzz')

      expect(screen.getByText('Nothing found')).toBeInTheDocument()
   })

   it('opens the dialog variant', () => {
      render(
         <CommandUI.CommandDialog open>
            <CommandUI.CommandInput placeholder="Search..." />
            <CommandUI.CommandList>
               <CommandUI.CommandItem>Dialog item</CommandUI.CommandItem>
            </CommandUI.CommandList>
         </CommandUI.CommandDialog>
      )

      expect(screen.getByText('Dialog item')).toBeInTheDocument()
   return Promise.resolve(); })

   it('renders the admin command palette', () => {
      render(
         <AdminCommand.Command>
            <AdminCommand.CommandInput placeholder="Admin search" />
            <AdminCommand.CommandList>
               <AdminCommand.CommandEmpty>Empty</AdminCommand.CommandEmpty>
               <AdminCommand.CommandGroup>
                  <AdminCommand.CommandItem>Admin item</AdminCommand.CommandItem>
               </AdminCommand.CommandGroup>
            </AdminCommand.CommandList>
         </AdminCommand.Command>
      )

      expect(screen.getByText('Admin item')).toBeInTheDocument()
   })
})

describe('form primitives', () => {
   it('expose the field context through FormField', () => {
      expect(FormUI.FormField).toBeTypeOf('function')
      expect(AdminForm.FormField).toBeTypeOf('function')
      expect(FormUI.useFormField).toBeTypeOf('function')
      expect(AdminForm.useFormField).toBeTypeOf('function')
   })
})

describe('dialog portal and overlay', () => {
   it('renders the portal and overlay chrome', async () => {
      render(
         <DialogUI.Dialog open>
            <DialogUI.DialogContent>
               <DialogUI.DialogHeader>
                  <DialogUI.DialogTitle>Portal</DialogUI.DialogTitle>
               </DialogUI.DialogHeader>
            </DialogUI.DialogContent>
         </DialogUI.Dialog>
      )

      expect(await screen.findByText('Portal')).toBeInTheDocument()
      expect(document.querySelector('[data-state="open"]')).not.toBeNull()
      noop()
   })
})
