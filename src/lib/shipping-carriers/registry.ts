import { CarrierAdapterError, type ShippingCarrierCode } from './types'
import type { ShippingCarrierAdapter } from './adapter'

const CARRIER_CODES: readonly ShippingCarrierCode[] = ['Post', 'Tipax', 'Chapar']

export function isShippingCarrierCode(value: string): value is ShippingCarrierCode {
   return CARRIER_CODES.some((code) => code === value)
}

export function createShippingCarrierRegistry(
   adapters: readonly ShippingCarrierAdapter[]
) {
   const registry = new Map<ShippingCarrierCode, ShippingCarrierAdapter>()

   for (const adapter of adapters) {
      if (!isShippingCarrierCode(adapter.code)) {
         throw new Error('UNSUPPORTED_SHIPPING_CARRIER')
      }
      if (registry.has(adapter.code)) {
         throw new Error('DUPLICATE_SHIPPING_CARRIER_ADAPTER')
      }
      registry.set(adapter.code, adapter)
   }

   return {
      get(code: ShippingCarrierCode) {
         const adapter = registry.get(code)
         if (!adapter) {
            throw new CarrierAdapterError({
               code: 'CARRIER_ADAPTER_NOT_CONFIGURED',
               message: `Shipping carrier adapter "${code}" is not configured`,
               carrier: code,
               operation: 'quote',
            })
         }
         return adapter
      },
      has(code: ShippingCarrierCode) {
         return registry.has(code)
      },
      configuredCodes() {
         return [...registry.keys()]
      },
   }
}

export const shippingCarrierRegistry = createShippingCarrierRegistry([])
