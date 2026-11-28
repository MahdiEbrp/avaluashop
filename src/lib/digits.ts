/* Persian (۰-۹) and Arabic-Indic (٠-٩) digits, as typed on Persian and Arabic
   keyboards, mapped to ASCII so OTP and phone checks see plain digits. */
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

export function toLatinDigits(input: string): string {
   return input.replaceAll(/[۰-۹٠-٩]/g, (digit) => {
      const persian = PERSIAN_DIGITS.indexOf(digit)

      if (persian === -1) return String(ARABIC_INDIC_DIGITS.indexOf(digit))

      return String(persian)
   })
}

/* Request bodies are untyped. Accept strings and numbers, and turn anything
   else into an empty string so later validation rejects it. */
export function digitsOf(value: unknown): string {
   if (typeof value === 'string') return toLatinDigits(value)
   if (typeof value === 'number') return String(value)

   return ''
}
