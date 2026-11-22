import { CarrierAdapterError, type CarrierOperation, type ShippingCarrierCode } from './types'
import type { ShippingCarrierAdapter } from './adapter'

const CARRIER_CODES: ReadonlySet<ShippingCarrierCode> = new Set(['Post', 'Tipax', 'Chapar'])

/* Rows reach this guard from the database and from request bodies, so the
   value is unknown until it has been checked. */
export function isShippingCarrierCode(value: unknown): value is ShippingCarrierCode {
   return CARRIER_CODES.has(value as ShippingCarrierCode)
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
      get(code: ShippingCarrierCode, operation: CarrierOperation = 'quote') {
         const adapter = registry.get(code)
         if (!adapter) {
            throw new CarrierAdapterError({
               code: 'CARRIER_ADAPTER_NOT_CONFIGURED',
               message: `Shipping carrier adapter "${code}" is not configured`,
               carrier: code,
               operation,
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

export type ShippingCarrierRegistry = ReturnType<typeof createShippingCarrierRegistry>
