import {
   CarrierAdapterError,
   createShippingCarrierRegistry,
   isShippingCarrierCode,
   shippingCarrierRegistry,
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
      expect(isShippingCarrierCode('')).toBe(false)
      expect(isShippingCarrierCode(null)).toBe(false)
      expect(isShippingCarrierCode(7)).toBe(false)
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

   it('rejects an adapter whose code is not a known carrier', () => {
      /* Rows can arrive from the database with a code the enum no longer
         contains; the registry must not accept them. */
      const rogue = { ...adapter('Post'), code: 'Arrow' } as unknown as ShippingCarrierAdapter

      expect(() => createShippingCarrierRegistry([rogue])).toThrow('UNSUPPORTED_SHIPPING_CARRIER')
   })

   it('fails closed when a provider adapter is not implemented', () => {
      const registry = createShippingCarrierRegistry([])

      expect(() => registry.get('Tipax')).toThrow(CarrierAdapterError)

      try {
         registry.get('Tipax')
      } catch (error) {
         expect(error).toMatchObject({
            code: 'CARRIER_ADAPTER_NOT_CONFIGURED',
            carrier: 'Tipax',
            operation: 'quote',
            retryable: false,
         })
      }
   })

   it('reports the operation that needed the missing adapter', () => {
      const registry = createShippingCarrierRegistry([])

      expect(() => registry.get('Post', 'track')).toThrow(/not configured/)

      try {
         registry.get('Post', 'track')
      } catch (error) {
         expect(error).toMatchObject({ operation: 'track', carrier: 'Post' })
      }
   })

   it('keeps the retryable flag when an adapter error sets it', () => {
      const error = new CarrierAdapterError({
         code: 'CARRIER_TIMEOUT',
         message: 'timeout',
         carrier: 'Chapar',
         operation: 'create-shipment',
         retryable: true,
      })

      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('CarrierAdapterError')
      expect(error.message).toBe('timeout')
      expect(error).toMatchObject({
         code: 'CARRIER_TIMEOUT',
         carrier: 'Chapar',
         operation: 'create-shipment',
         retryable: true,
      })
   })

   it('starts with no provider configured', () => {
      expect(shippingCarrierRegistry.configuredCodes()).toEqual([])
      expect(shippingCarrierRegistry.has('Post')).toBe(false)
   })
})
