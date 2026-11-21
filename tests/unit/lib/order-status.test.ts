import {
   canTransitionOrderStatus,
   getNextOrderStatuses,
   ORDER_STATUSES,
   ORDER_STATUS_LABELS,
} from '@/lib/order-status'

describe('order fulfilment status transitions', () => {
   it('includes every persisted OrderStatusEnum value and a customer label', () => {
      expect(ORDER_STATUSES).toContain('PendingPayment')
      expect(ORDER_STATUSES).toContain('Denied')
      expect(Object.keys(ORDER_STATUS_LABELS).sort()).toEqual([...ORDER_STATUSES].sort())
   })

   it('allows a paid order to advance from processing to shipped', () => {
      expect(getNextOrderStatuses('Processing')).toEqual(['Shipped'])
      expect(canTransitionOrderStatus('Processing', 'Shipped')).toBe(true)
   })

   it('allows a shipped order to advance to delivered', () => {
      expect(getNextOrderStatuses('Shipped')).toEqual(['Delivered'])
      expect(canTransitionOrderStatus('Shipped', 'Delivered')).toBe(true)
   })

   it('keeps payment, cancellation and refund states outside the admin fulfilment workflow', () => {
      for (const status of ['PendingPayment', 'Cancelled', 'ReturnProcessing', 'RefundProcessing', 'Denied']) {
         expect(getNextOrderStatuses(status)).toEqual([])
      }
      expect(canTransitionOrderStatus('Processing', 'Delivered')).toBe(false)
      expect(canTransitionOrderStatus('Delivered', 'Shipped')).toBe(false)
   })

   it('returns no options for an unknown status', () => {
      expect(getNextOrderStatuses('Unknown')).toEqual([])
   })
})
