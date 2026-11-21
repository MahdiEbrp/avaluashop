export type ShippingCarrierCode = 'Post' | 'Tipax' | 'Chapar'

export interface CarrierAddress {
   fullName: string
   phone: string
   province: string
   city: string
   address: string
   postalCode: string
}

export interface CarrierParcel {
   weightGrams: number
   lengthCm?: number
   widthCm?: number
   heightCm?: number
   description?: string
   declaredValue?: number
}

export interface CarrierQuoteRequest {
   origin: CarrierAddress
   destination: CarrierAddress
   parcel: CarrierParcel
   serviceCode?: string
   cashOnDelivery?: number
}

export interface CarrierQuote {
   amount: number
   currency: 'IRT'
   estimatedDeliveryDays?: number
   serviceCode?: string
   serviceName?: string
   raw?: unknown
}

export interface CarrierShipmentRequest extends CarrierQuoteRequest {
   orderId: string
   orderNumber: string
   customerReference?: string
}

export interface CarrierShipment {
   providerShipmentId: string
   trackingNumber: string
   labelUrl?: string
   status?: string
   raw?: unknown
}

export interface CarrierTracking {
   trackingNumber: string
   status: string
   description?: string
   updatedAt?: string
   events?: {
      status: string
      description?: string
      occurredAt?: string
      location?: string
   }[]
   raw?: unknown
}

export type CarrierOperation = 'quote' | 'create-shipment' | 'track'

export class CarrierAdapterError extends Error {
   readonly code: string
   readonly carrier: ShippingCarrierCode
   readonly operation: CarrierOperation
   readonly retryable: boolean

   constructor(input: {
      code: string
      message: string
      carrier: ShippingCarrierCode
      operation: CarrierOperation
      retryable?: boolean
   }) {
      super(input.message)
      this.name = 'CarrierAdapterError'
      this.code = input.code
      this.carrier = input.carrier
      this.operation = input.operation
      this.retryable = input.retryable ?? false
   }
}
