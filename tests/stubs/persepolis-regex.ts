/**
 * The published validators, re-implemented with the same semantics so the
 * tests assert the app's routing logic, not the third party's regexes.
 */
export const isEmailValid = (email: string) =>
   /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/.test(email)

export const isPhoneNumberValid = (phone: string) =>
   /^\+(?:[0-9] ?){6,14}[0-9]$/.test(phone)

export const isIranianPhoneNumberValid = (phone: string) =>
   /^0[0-9]{2,}[0-9]{7,}$/.test(phone)
