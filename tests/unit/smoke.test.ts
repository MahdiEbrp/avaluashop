import { cn, formatDate, isVariableValid, validateBoolean } from '@/lib/utils'

describe('utils smoke', () => {
   it('merges classes', () => {
      expect(cn('p-2', 'p-4')).toBe('p-4')
   })

   it('formats dates', () => {
      expect(formatDate('2024-01-15')).toContain('January')
   })

   it('validates variables', () => {
      expect(isVariableValid(0)).toBe(true)
      expect(isVariableValid(null)).toBe(false)
      expect(validateBoolean(true, true)).toBe(true)
   })
})
