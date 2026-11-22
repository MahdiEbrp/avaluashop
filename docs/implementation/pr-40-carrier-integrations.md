# PR #40 — Carrier quote and shipment tracking orchestration

## Implemented modules
- `src/lib/shipping-carriers/service.ts` (exported via `src/lib/shipping-carriers/index.ts`):
  - `validateCarrierQuoteRequest(request)`: validates origin/destination city, address, 10-digit postal code (`/^\d{10}$/`), positive parcel weight (`weightGrams > 0`), and non-negative declared value before invoking any carrier adapter.
  - `quoteCarrierRate(carrier, request, registry)`: queries the configured carrier adapter and returns a structured `CarrierQuoteOutcome` (`{ available: true, carrier, quote }` or `{ available: false, carrier, reason, retryable }`). Never fabricates prices when an adapter is unconfigured, rejects malformed quotes, and surfaces `CarrierAdapterError` codes safely.
  - `resolveNextOrderStatusFromTracking(currentOrderStatus, tracking)`: enforces monotonic order status progression (`Processing → Shipped → Delivered`) from carrier tracking statuses (`picked_up` / `in_transit` / `out_for_delivery` → `Shipped`; `delivered` → `Delivered`) so out-of-order tracking events can never regress a `Delivered` or `Shipped` order.

## Integration note
No guessed Post, Tipax, or Chapar URLs or credentials are stored in source control. Live carrier adapters should be registered in `shippingCarrierRegistry` only after official provider API documentation and sandbox credentials are supplied.
