import { adminId } from '@/lib/require-admin'

const req = (headers: Record<string, string>) => new Request('http://localhost/api/admin', { headers })

describe('adminId', () => {
   it('returns the owner id for an admin role stamped by the proxy', () => {
      expect(adminId(req({ 'X-USER-ID': 'owner-1', 'X-USER-ROLE': 'admin' }))).toBe('owner-1')
   })

   it('refuses a storefront role even with a valid id', () => {
      expect(adminId(req({ 'X-USER-ID': 'user-1', 'X-USER-ROLE': 'user' }))).toBeNull()
   })

   it('refuses when the role header is missing', () => {
      expect(adminId(req({ 'X-USER-ID': 'owner-1' }))).toBeNull()
   })

   it('refuses an admin role with no id', () => {
      expect(adminId(req({ 'X-USER-ROLE': 'admin' }))).toBeNull()
   })
})
