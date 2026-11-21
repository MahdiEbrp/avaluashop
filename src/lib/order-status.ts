export const ORDER_STATUSES = [
   'PendingPayment',
   'Processing',
   'Shipped',
   'Delivered',
   'ReturnProcessing',
   'ReturnCompleted',
   'Cancelled',
   'RefundProcessing',
   'RefundCompleted',
   'Denied',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
   PendingPayment: 'در انتظار پرداخت',
   Processing: 'در حال پردازش',
   Shipped: 'ارسال شده',
   Delivered: 'تحویل شده',
   ReturnProcessing: 'در حال پردازش مرجوعی',
   ReturnCompleted: 'مرجوعی انجام شده',
   Cancelled: 'لغو شده',
   RefundProcessing: 'در حال پردازش بازگشت وجه',
   RefundCompleted: 'بازگشت وجه انجام شده',
   Denied: 'رد شده',
}

/**
 * Payment, cancellation and refund states are controlled by their own
 * verified workflows. This admin workflow only advances physical fulfilment.
 */
export function getNextOrderStatuses(status: string): OrderStatus[] {
   switch (status) {
      case 'Processing':
         return ['Shipped']
      case 'Shipped':
         return ['Delivered']
      default:
         return []
   }
}

export function canTransitionOrderStatus(current: string, next: OrderStatus): boolean {
   return getNextOrderStatuses(current).includes(next)
}
