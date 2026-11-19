import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

import {
   Form,
   FormControl,
   FormDescription,
   FormField,
   FormItem,
   FormLabel,
   FormMessage,
} from '@/components/admin/ui/form'
import {
   Form as StoreForm,
   FormControl as StoreFormControl,
   FormDescription as StoreFormDescription,
   FormField as StoreFormField,
   FormItem as StoreFormItem,
   FormLabel as StoreFormLabel,
   FormMessage as StoreFormMessage,
} from '@/components/ui/form'

const user = () => userEvent.setup({ pointerEventsCheck: 0 })

const schema = z.object({ name: z.string().min(3, 'Name is too short') })

function AdminFormHarness({ withError = false }: { withError?: boolean }) {
   const form = useForm<{ name: string }>({
      resolver: zodResolver(schema),
      defaultValues: { name: withError ? 'ab' : '' },
   })

   return (
      <Form {...form}>
         <form
            onSubmit={(event) => {
               void form.handleSubmit(() => {})(event)
            }}
         >
            <FormField
               control={form.control}
               name="name"
               render={({ field }) => (
                  <FormItem>
                     <FormLabel>Name</FormLabel>
                     <FormControl>
                        <input {...field} aria-label="name" />
                     </FormControl>
                     <FormDescription>Your display name.</FormDescription>
                     <FormMessage />
                  </FormItem>
               )}
            />
            <button type="submit">Save</button>
         </form>
      </Form>
   )
}

function StoreFormHarness() {
   const form = useForm<{ name: string }>({
      resolver: zodResolver(schema),
      defaultValues: { name: 'ab' },
   })

   return (
      <StoreForm {...form}>
         <form
            onSubmit={(event) => {
               void form.handleSubmit(() => {})(event)
            }}
         >
            <StoreFormField
               control={form.control}
               name="name"
               render={({ field }) => (
                  <StoreFormItem>
                     <StoreFormLabel>Name</StoreFormLabel>
                     <StoreFormControl>
                        <input {...field} aria-label="name" />
                     </StoreFormControl>
                     <StoreFormDescription>Your display name.</StoreFormDescription>
                     <StoreFormMessage />
                  </StoreFormItem>
               )}
            />
            <button type="submit">Save</button>
         </form>
      </StoreForm>
   )
}

describe('admin form field states', () => {
   it('renders the description when valid', () => {
      render(<AdminFormHarness />)

      expect(screen.getByText('Your display name.')).toBeInTheDocument()
   })

   it('paints the label destructive and wires aria-describedby on error', async () => {
      render(<AdminFormHarness withError />)

      await user().click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByText('Name is too short')).toBeInTheDocument()
      expect(screen.getByText('Name')).toHaveClass('text-destructive')
      expect(screen.getByLabelText('name')).toHaveAttribute('aria-invalid', 'true')
   })
})

describe('storefront form field states', () => {
   it('shows the validation message after a failed submit', async () => {
      render(<StoreFormHarness />)

      await user().click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByText('Name is too short')).toBeInTheDocument()
   })

   it('renders the field description', () => {
      render(<StoreFormHarness />)

      expect(screen.getByText('Your display name.')).toBeInTheDocument()
   })

   it('hides the message when nothing is wrong', async () => {
      render(<StoreFormHarness />)

      await waitFor(() =>
         expect(screen.queryByText('Name is too short')).not.toBeInTheDocument()
      )
   })
})
