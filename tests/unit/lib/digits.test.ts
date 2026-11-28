import { digitsOf, toLatinDigits } from '@/lib/digits'

describe('toLatinDigits', () => {
   it('maps Persian digits to ASCII', () => {
      expect(toLatinDigits('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789')
   })

   it('maps Arabic-Indic digits to ASCII', () => {
      expect(toLatinDigits('٠٩١٢٣٤٥٦٧٨٩')).toBe('09123456789')
   })

   it('leaves ASCII digits and other characters alone', () => {
      expect(toLatinDigits('12a-۳')).toBe('12a-3')
   })
})

describe('digitsOf', () => {
   it('normalises a string', () => {
      expect(digitsOf('۱۲۳۴۵۶')).toBe('123456')
   })

   it('stringifies a number without normalising it', () => {
      expect(digitsOf(123_456)).toBe('123456')
   })

   it('returns an empty string for anything else', () => {
      let missing: unknown
      expect(digitsOf(missing)).toBe('')
      expect(digitsOf(null)).toBe('')
      expect(digitsOf({ otp: '123456' })).toBe('')
   })
})
