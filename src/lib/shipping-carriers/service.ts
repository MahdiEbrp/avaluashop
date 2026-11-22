import type { OrderStatus } from '@/lib/order-status'
import {
   shippingCarrierRegistry,
   type ShippingCarrierRegistry,
} from './registry'
import {
   CarrierAdapterError,
   type CarrierAddress,
   type CarrierQuote,
   type CarrierQuoteRequest,
   type CarrierTracking,
   type ShippingCarrierCode,
} from './types'

const POSTAL_CODE_PATTERN = /^\d{10}$/
const IN_TRANSIT_TRACKING_STATUSES = new Set([
   'picked_up',
   'in_transit',
   'out_for_delivery',
])

export type CarrierQuoteOutcome =
   | {
        available: true
        carrier: ShippingCarrierCode
        quote: CarrierQuote
     }
   | {
        available: false
        carrier: ShippingCarrierCode
        reason: string
        retryable: boolean
     }

function isValidCarrierAddress(address: CarrierAddress): boolean {
   return (
      address.city.trim().length > 0 &&
      address.address.trim().length > 0 &&
      POSTAL_CODE_PATTERN.test(address.postalCode.trim())
   )
}

export function validateCarrierQuoteRequest(
   request: CarrierQuoteRequest
): string | null {
   if (
      !isValidCarrierAddress(request.origin) ||
      !isValidCarrierAddress(request.destination)
   ) {
      return 'INVALID_CARRIER_ADDRESS'
   }

   const { weightGrams, declaredValue } = request.parcel
   if (!Number.isFinite(weightGrams) || weightGrams <= 0) {
      return 'INVALID_CARRIER_PARCEL'
   }
   if (
      declaredValue !== undefined &&
      (!Number.isFinite(declaredValue) || declaredValue < 0)
   ) {
      return 'INVALID_CARRIER_PARCEL'
   }

   return null
}

/**
 * Queries a registered carrier adapter without fabricating prices or leaking
 * internal errors. When no adapter is configured or the carrier rejects the
 * request, returns an explicit unavailable outcome.
 */
export async function quoteCarrierRate(
   carrier: ShippingCarrierCode,
   request: CarrierQuoteRequest,
   registry: ShippingCarrierRegistry = shippingCarrierRegistry
): Promise<CarrierQuoteOutcome> {
   const validationError = validateCarrierQuoteRequest(request)
   if (validationError) {
      return {
         available: false,
         carrier,
         reason: validationError,
         retryable: false,
      }
   }

   try {
      const adapter = registry.get(carrier, 'quote')
      const quote = await adapter.quote(request)
      if (
         !Number.isFinite(quote.amount) ||
         quote.amount < 0 ||
         quote.currency !== 'IRT'
      ) {
         return {
            available: false,
            carrier,
            reason: 'MALFORMED_CARRIER_QUOTE',
            retryable: false,
         }
      }

      return {
         available: true,
         carrier,
         quote,
      }
   } catch (error) {
      if (error instanceof CarrierAdapterError) {
         return {
            available: false,
            carrier,
            reason: error.code,
            retryable: error.retryable,
         }
      }
      return {
         available: false,
         carrier,
         reason: 'CARRIER_QUOTE_FAILED',
         retryable: false,
      }
   }
}

/**
 * Maps a carrier tracking status to the next valid order fulfilment status
 * while preventing out-of-order tracking events from regressing an order
 * (for example, `Delivered` can never move back to `Shipped`).
 */
export function resolveNextOrderStatusFromTracking(
   currentOrderStatus: OrderStatus,
   tracking: CarrierTracking
): 'Shipped' | 'Delivered' | null {
   const normalized = tracking.status.trim().toLowerCase()

   if (normalized === 'delivered' && currentOrderStatus === 'Shipped') {
      return 'Delivered'
   }

   if (
      IN_TRANSIT_TRACKING_STATUSES.has(normalized) &&
      currentOrderStatus === 'Processing'
   ) {
      return 'Shipped'
   }

   return null
}
