'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getLocalCart, writeLocalCart } from '@/lib/cart'
import { toLatinDigits } from '@/lib/digits'
import { cn, isVariableValid } from '@/lib/utils'
import { isEmailValid, isIranianPhoneNumberValid } from '@persepolis/regex'
import { Loader, MailIcon, SmartphoneIcon } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import * as React from 'react'

type UserAuthFormProps = React.HTMLAttributes<HTMLDivElement>

const OTP_LENGTH = 6

/* The contact details and the code live in component state, never in the URL.
   A query string ends up in browser history, server logs and Referer headers.
   Only the login method (email or phone) stays in the URL. */
export function UserAuthForm({
   className,
   ...props
}: Readonly<UserAuthFormProps>) {
   const [isLoading, setIsLoading] = React.useState<boolean>(false)
   const [fetchedOTP, setFetchedOTP] = React.useState<boolean>(false)
   const [email, setEmail] = React.useState('')
   const [phone, setPhone] = React.useState('')
   const [otp, setOtp] = React.useState('')

   return (
      <div className={cn('grid gap-6', className)} {...props}>
         {fetchedOTP ? (
            <VerifyComponents
               isLoading={isLoading}
               setIsLoading={setIsLoading}
               email={email}
               phone={phone}
               otp={otp}
               setOtp={setOtp}
            />
         ) : (
            <TryComponents
               isLoading={isLoading}
               setIsLoading={setIsLoading}
               setFetchedOTP={setFetchedOTP}
               email={email}
               setEmail={setEmail}
               phone={phone}
               setPhone={setPhone}
            />
         )}
         {/* Switching method mid-verification would send the code to the
             wrong endpoint with an empty contact, so the switch is only
             offered before a code has been requested. */}
         {!fetchedOTP && (
            <>
               <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                     <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                     <span className="bg-background px-2 text-muted-foreground">
                        Or continue with
                     </span>
                  </div>
               </div>
               <ChangeMethodButton isLoading={isLoading} />
            </>
         )}
      </div>
   )
}

function ChangeMethodButton({ isLoading }) {
   const router = useRouter()
   const pathname = usePathname()
   const searchParams = useSearchParams()
   const method = searchParams.get('method')

   function changeMethod() {
      /* Only the method lives in the URL, so the query is always just this one
         parameter. */
      const query = new URLSearchParams({
         method: method === 'phone' ? 'email' : 'phone',
      }).toString()

      router.replace(`${pathname}?${query}`, {
         scroll: false,
      })
   }

   if (method === 'phone')
      return (
         <Button onClick={changeMethod} disabled={isLoading} type="button">
            {isLoading ? (
               <Loader className="me-2 h-4 animate-spin" />
            ) : (
               <MailIcon className="me-2 h-4" />
            )}
            Email
         </Button>
      )

   return (
      <Button onClick={changeMethod} disabled={isLoading} type="button">
         {isLoading ? (
            <Loader className="me-2 h-4 animate-spin" />
         ) : (
            <SmartphoneIcon className="me-2 h-4" />
         )}
         Phone Number
      </Button>
   )
}

function TryComponents({
   isLoading,
   setIsLoading,
   setFetchedOTP,
   email,
   setEmail,
   phone,
   setPhone,
}) {
   const searchParams = useSearchParams()
   const method = searchParams.get('method')

   async function onSubmitEmail() {
      try {
         setIsLoading(true)

         const response = await fetch('/api/auth/otp/email/try', {
            method: 'POST',
            body: JSON.stringify({ email }),
            cache: 'no-store',
         })

         if (response.ok) {
            setFetchedOTP(true)
         }

         setIsLoading(false)
      } catch (error) {
         console.error({ error })
      }
   }

   async function onSubmitPhone() {
      try {
         setIsLoading(true)

         const response = await fetch('/api/auth/otp/phone/try', {
            method: 'POST',
            body: JSON.stringify({ phone }),
            cache: 'no-store',
         })

         if (response.ok) {
            setFetchedOTP(true)
         }

         setIsLoading(false)
      } catch (error) {
         console.error({ error })
      }
   }

   if (method === 'phone')
      return (
         <>
            <div className="grid gap-1">
               <Label variant="subtle" htmlFor="phone">
                  Phone
               </Label>
               <Input
                  id="phone"
                  dir="ltr"
                  className="text-start"
                  placeholder="+989123456789"
                  type="tel"
                  inputMode="tel"
                  autoCapitalize="none"
                  autoComplete="tel"
                  autoCorrect="off"
                  value={phone}
                  disabled={isLoading}
                  onChange={(event) => {
                     setPhone(toLatinDigits(event.target.value).trim())
                  }}
                  required
               />
               {isVariableValid(phone) && !isIranianPhoneNumberValid(phone) && (
                  <p className="mt-2 text-sm text-destructive">
                     Phone Number is not valid.
                  </p>
               )}
            </div>
            <Button
               onClick={() => {
                  void onSubmitPhone()
               }}
               disabled={isLoading || !isIranianPhoneNumberValid(phone)}
            >
               {isLoading && <Loader className="me-2 h-4 animate-spin" />}
               Login with Phone
            </Button>
         </>
      )

   return (
      <>
         <div className="grid gap-1">
            <Label variant="subtle" htmlFor="email">
               Email
            </Label>
            <Input
               id="email"
               dir="ltr"
               className="text-start"
               placeholder="name@example.com"
               type="email"
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
         <Button
            onClick={() => {
               void onSubmitEmail()
            }}
            disabled={isLoading || !isEmailValid(email)}
         >
            {isLoading && <Loader className="me-2 h-4 animate-spin" />}
            Login with Email
         </Button>
      </>
   )
}

function VerifyComponents({ isLoading, setIsLoading, email, phone, otp, setOtp }) {
   const searchParams = useSearchParams()
   const method = searchParams.get('method')

   async function onVerifyOTP() {
      try {
         setIsLoading(true)

         const response = await fetch(
            method === 'phone'
               ? '/api/auth/otp/phone/verify'
               : '/api/auth/otp/email/verify',
            {
               method: 'POST',
               body: JSON.stringify({
                  email,
                  phone,
                  OTP: otp,
                  /* Hand the guest cart to the server so it survives sign-in,
                     then clear the copy on this device. */
                  cart: getLocalCart(),
               }),
               cache: 'no-store',
            }
         )

         if (response.ok) {
            writeLocalCart({ items: [] })
            globalThis.location.assign(
               new URL('/', globalThis.location.origin).toString()
            )
         }
      } catch (error) {
         console.error({ error })
      } finally {
         setIsLoading(false)
      }
   }

   return (
      <>
         <div className="grid gap-1">
            <Label variant="subtle" htmlFor="otp">
               One-Time Password
            </Label>
            <Input
               id="otp"
               dir="ltr"
               className="text-start"
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
         <Button
            onClick={() => {
               void onVerifyOTP()
            }}
            disabled={isLoading || otp.length !== OTP_LENGTH}
         >
            {isLoading && <Loader className="me-2 h-4 animate-spin" />}
            Submit
         </Button>
      </>
   )
}
