import {
   CarrierAdapterError,
   createShippingCarrierRegistry,
   isShippingCarrierCode,
   type ShippingCarrierAdapter,
} from '@/lib/shipping-carriers'

const adapter = (code: 'Post' | 'Tipax' | 'Chapar') =>
   ({
      code,
      quote: vi.fn(),
      createShipment: vi.fn(),
      track: vi.fn(),
   }) satisfies ShippingCarrierAdapter

describe('shipping carrier adapter registry', () => {
   it('recognizes only supported carrier codes', () => {
      expect(isShippingCarrierCode('Post')).toBe(true)
      expect(isShippingCarrierCode('Tipax')).toBe(true)
      expect(isShippingCarrierCode('Chapar')).toBe(true)
      expect(isShippingCarrierCode('Unknown')).toBe(false)
   })

   it('registers and returns configured adapters', () => {
      const post = adapter('Post')
      const registry = createShippingCarrierRegistry([post])

      expect(registry.has('Post')).toBe(true)
      expect(registry.has('Tipax')).toBe(false)
      expect(registry.get('Post')).toBe(post)
      expect(registry.configuredCodes()).toEqual(['Post'])
   })

   it('rejects duplicate adapters', () => {
      expect(() => createShippingCarrierRegistry([adapter('Post'), adapter('Post')])).toThrow(
         'DUPLICATE_SHIPPING_CARRIER_ADAPTER'
      )
   })

   it('fails closed when a provider adapter is not implemented', () => {
      const registry = createShippingCarrierRegistry([])

      try {
         registry.get('Tipax')
         throw new Error('Expected registry lookup to fail')
      } catch (error) {
         expect(error).toBeInstanceOf(CarrierAdapterError)
         expect(error).toMatchObject({
            code: 'CARRIER_ADAPTER_NOT_CONFIGURED',
            carrier: 'Tipax',
            operation: 'quote',
            retryable: false,
         })
      }
   })
})
