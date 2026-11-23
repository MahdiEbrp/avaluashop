/**
 * The published validators, re-implemented with the same semantics so the
 * tests assert the app's routing logic, not the third party's regexes.
 */
export const isEmailValid = (email: string) =>
   /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/.test(email)

const DIGITS = /^\d+$/

/** "+" then 7 to 15 digits, optionally grouped by single spaces. */
export const isPhoneNumberValid = (phone: string) => {
   if (!phone.startsWith('+')) return false

   const groups = phone.slice(1).split(' ')
   const digits = groups.join('').length

   return groups.every((group) => DIGITS.test(group)) && digits >= 7 && digits <= 15
}

/** A leading 0 followed by at least nine more digits. */
export const isIranianPhoneNumberValid = (phone: string) => /^0\d{9,}$/.test(phone)
