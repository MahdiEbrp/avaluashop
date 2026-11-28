'use client'

import { Button } from '@/components/admin/ui/button'
import { Input } from '@/components/admin/ui/input'
import { Label } from '@/components/admin/ui/label'
import { toLatinDigits } from '@/lib/digits'
import { cn } from '@/lib/utils'
import { isEmailValid } from '@persepolis/regex'
import { Loader } from 'lucide-react'
import * as React from 'react'

type UserAuthFormProps = React.HTMLAttributes<HTMLDivElement>

const OTP_LENGTH = 6

const MESSAGES = {
   tooMany: 'Too many attempts. Try again in a few minutes.',
   requestFailed: 'The code could not be sent. Check the address and try again.',
   invalidCode: 'The code is incorrect or has expired.',
   network: 'The server could not be reached. Check your connection.',
} as const

/* Admin login is email-only. The storefront form is not reused here: it posts
   to the customer endpoints and would create a customer record for an admin. */
export function UserAuthForm({
   className,
   ...props
}: Readonly<UserAuthFormProps>) {
   const [step, setStep] = React.useState<'email' | 'otp'>('email')
   const [email, setEmail] = React.useState('')
   const [otp, setOtp] = React.useState('')
   const [isLoading, setIsLoading] = React.useState(false)
   const [error, setError] = React.useState<string | null>(null)

   async function requestOtp() {
      setError(null)
      setIsLoading(true)

      try {
         const response = await fetch('/api/admin/auth/otp/email/try', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
            cache: 'no-store',
         })

         if (!response.ok) {
            setError(response.status === 429 ? MESSAGES.tooMany : MESSAGES.requestFailed)
            return
         }

         setStep('otp')
      } catch {
         setError(MESSAGES.network)
      } finally {
         setIsLoading(false)
      }
   }

   async function verifyOtp() {
      setError(null)
      setIsLoading(true)

      try {
         const response = await fetch('/api/admin/auth/otp/email/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, OTP: otp }),
            cache: 'no-store',
         })

         if (response.ok) {
            globalThis.location.assign(
               new URL('/admin', globalThis.location.origin).toString()
            )
            return
         }

         setError(response.status === 429 ? MESSAGES.tooMany : MESSAGES.invalidCode)
      } catch {
         setError(MESSAGES.network)
      } finally {
         setIsLoading(false)
      }
   }

   function useAnotherEmail() {
      setStep('email')
      setOtp('')
      setError(null)
   }

   return (
      <div className={cn('grid gap-6', className)} {...props}>
         {step === 'email' ? (
            <form
               className="grid gap-4"
               onSubmit={(event) => {
                  event.preventDefault()
                  void requestOtp()
               }}
            >
               <div className="grid gap-1">
                  <Label className="text-sm font-light text-foreground/60" htmlFor="email">
                     Email
                  </Label>
                  <Input
                     id="email"
                     dir="ltr"
                     className="text-start"
                     placeholder="name@example.com"
                     type="email"
                     inputMode="email"
                     autoCapitalize="none"
                     autoComplete="email"
                     autoCorrect="off"
                     value={email}
                     disabled={isLoading}
                     onChange={(event) => {
                        setEmail(event.target.value.trim())
                     }}
                     required
                  />
               </div>
               <Button type="submit" disabled={isLoading || !isEmailValid(email)}>
                  {isLoading && <Loader className="me-2 h-4 animate-spin" />}
                  Login with Email
               </Button>
            </form>
         ) : (
            <form
               className="grid gap-4"
               onSubmit={(event) => {
                  event.preventDefault()
                  void verifyOtp()
               }}
            >
               <div className="grid gap-1">
                  <Label className="text-sm font-light text-foreground/60" htmlFor="otp">
                     One-Time Password
                  </Label>
                  <Input
                     id="otp"
                     dir="ltr"
                     className="text-start tracking-widest"
                     placeholder="123456"
                     inputMode="numeric"
                     autoComplete="one-time-code"
                     maxLength={OTP_LENGTH}
                     value={otp}
                     disabled={isLoading}
                     onChange={(event) => {
                          setOtp(toLatinDigits(event.target.value).replaceAll(/\D/g, ''))
                     }}
                     required
                  />
               </div>
               <Button type="submit" disabled={isLoading || otp.length !== OTP_LENGTH}>
                  {isLoading && <Loader className="me-2 h-4 animate-spin" />}
                  Submit
               </Button>
               <button
                  type="button"
                  className="text-sm text-muted-foreground underline underline-offset-4"
                  onClick={useAnotherEmail}
               >
                  Use another email
               </button>
            </form>
         )}
         {error && (
            <p role="alert" className="text-sm text-destructive">
               {error}
            </p>
         )}
      </div>
   )
}
