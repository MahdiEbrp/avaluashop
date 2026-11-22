import {
   CarrierAdapterError,
   createShippingCarrierRegistry,
   isShippingCarrierCode,
   quoteCarrierRate,
   resolveNextOrderStatusFromTracking,
   shippingCarrierRegistry,
   validateCarrierQuoteRequest,
   type CarrierQuoteRequest,
   type ShippingCarrierAdapter,
} from '@/lib/shipping-carriers'

const adapter = (code: 'Post' | 'Tipax' | 'Chapar') =>
   ({
      code,
      quote: vi.fn(),
      createShipment: vi.fn(),
      track: vi.fn(),
   }) satisfies ShippingCarrierAdapter

const validRequest: CarrierQuoteRequest = {
   origin: {
      fullName: 'انبار مرکزی',
      phone: '02188888888',
      province: 'تهران',
      city: 'تهران',
      address: 'خیابان ولیعصر',
      postalCode: '1234567890',
   },
   destination: {
      fullName: 'مشتری',
      phone: '09120000000',
      province: 'اصفهان',
      city: 'اصفهان',
      address: 'چهارباغ عباسی',
      postalCode: '9876543210',
   },
   parcel: {
      weightGrams: 750,
      declaredValue: 500_000,
   },
}

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
      expect(() =>
         createShippingCarrierRegistry([adapter('Post'), adapter('Post')])
      ).toThrow('DUPLICATE_SHIPPING_CARRIER_ADAPTER')
   })

   it('rejects an adapter whose code is not a known carrier', () => {
      /* Rows can arrive from the database with a code the enum no longer
         contains; the registry must not accept them. */
      const rogue = {
         ...adapter('Post'),
         code: 'Arrow',
      } as unknown as ShippingCarrierAdapter

      expect(() => createShippingCarrierRegistry([rogue])).toThrow(
         'UNSUPPORTED_SHIPPING_CARRIER'
      )
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

describe('carrier quote and tracking orchestration service', () => {
   it('validates addresses and parcel weight/value before calling any adapter', async () => {
      expect(
         validateCarrierQuoteRequest({
            ...validRequest,
            destination: { ...validRequest.destination, postalCode: '123' },
         })
      ).toBe('INVALID_CARRIER_ADDRESS')

      expect(
         validateCarrierQuoteRequest({
            ...validRequest,
            parcel: { weightGrams: 0 },
         })
      ).toBe('INVALID_CARRIER_PARCEL')

      expect(
         validateCarrierQuoteRequest({
            ...validRequest,
            parcel: { weightGrams: 500, declaredValue: -1 },
         })
      ).toBe('INVALID_CARRIER_PARCEL')

      await expect(
         quoteCarrierRate('Post', {
            ...validRequest,
            origin: { ...validRequest.origin, city: ' '.repeat(3) },
         })
      ).resolves.toEqual({
         available: false,
         carrier: 'Post',
         reason: 'INVALID_CARRIER_ADDRESS',
         retryable: false,
      })
   })

   it('returns unavailable when no adapter is registered or when the adapter fails or returns a malformed quote', async () => {
      await expect(quoteCarrierRate('Post', validRequest)).resolves.toEqual({
         available: false,
         carrier: 'Post',
         reason: 'CARRIER_ADAPTER_NOT_CONFIGURED',
         retryable: false,
      })

      const post = adapter('Post')
      const registry = createShippingCarrierRegistry([post])

      post.quote.mockResolvedValueOnce({
         amount: 85_000,
         currency: 'IRT',
         estimatedDeliveryDays: 2,
      })
      await expect(
         quoteCarrierRate('Post', validRequest, registry)
      ).resolves.toEqual({
         available: true,
         carrier: 'Post',
         quote: {
            amount: 85_000,
            currency: 'IRT',
            estimatedDeliveryDays: 2,
         },
      })

      post.quote.mockResolvedValueOnce({
         amount: -5,
         currency: 'IRT',
      })
      await expect(
         quoteCarrierRate('Post', validRequest, registry)
      ).resolves.toEqual({
         available: false,
         carrier: 'Post',
         reason: 'MALFORMED_CARRIER_QUOTE',
         retryable: false,
      })

      post.quote.mockRejectedValueOnce(
         new CarrierAdapterError({
            code: 'CARRIER_TIMEOUT',
            message: 'timeout',
            carrier: 'Post',
            operation: 'quote',
            retryable: true,
         })
      )
      await expect(
         quoteCarrierRate('Post', validRequest, registry)
      ).resolves.toEqual({
         available: false,
         carrier: 'Post',
         reason: 'CARRIER_TIMEOUT',
         retryable: true,
      })

      post.quote.mockRejectedValueOnce(new Error('network boom'))
      await expect(
         quoteCarrierRate('Post', validRequest, registry)
      ).resolves.toEqual({
         available: false,
         carrier: 'Post',
         reason: 'CARRIER_QUOTE_FAILED',
         retryable: false,
      })
   })

   it('advances order status monotonically from carrier tracking without regressing delivered orders', () => {
      expect(
         resolveNextOrderStatusFromTracking('Processing', {
            trackingNumber: 'TRK-1',
            status: 'in_transit',
         })
      ).toBe('Shipped')
      expect(
         resolveNextOrderStatusFromTracking('Shipped', {
            trackingNumber: 'TRK-1',
            status: 'Delivered',
         })
      ).toBe('Delivered')
      expect(
         resolveNextOrderStatusFromTracking('Delivered', {
            trackingNumber: 'TRK-1',
            status: 'in_transit',
         })
      ).toBeNull()
      expect(
         resolveNextOrderStatusFromTracking('Processing', {
            trackingNumber: 'TRK-1',
            status: 'delivered',
         })
      ).toBeNull()
   })
})
