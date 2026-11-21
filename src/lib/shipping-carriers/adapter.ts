import type {
   CarrierQuote,
   CarrierQuoteRequest,
   CarrierShipment,
   CarrierShipmentRequest,
   CarrierTracking,
   ShippingCarrierCode,
} from './types'

export interface ShippingCarrierAdapter {
   readonly code: ShippingCarrierCode
   quote(request: CarrierQuoteRequest): Promise<CarrierQuote>
   createShipment(request: CarrierShipmentRequest): Promise<CarrierShipment>
   track(trackingNumber: string): Promise<CarrierTracking>
}
