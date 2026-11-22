# PR #38 — Refund request and auditable processing workflow

## Implemented endpoints
- `POST /api/orders/[orderId]/refund` (`src/app/api/orders/[orderId]/refund/route.ts`):
  - Authenticated customer endpoint (`X-USER-ID`) scoped to orders owned by the caller (`where: { id: orderId, userId }`).
  - Validates `reason` (`5..500` trimmed characters) and optional `amount` (`> 0` and `<= order.payable`, defaulting to `order.payable`).
  - Requires `isPaid: true`, an eligible fulfilment status (`Processing`, `Shipped`, or `Delivered`), and no existing `Refund` record.
  - Atomically transitions `Order.status` to `RefundProcessing` via compare-and-set (`updateMany`) and creates the `Refund` row (`201`). Rejects duplicate or concurrent requests with `409 REFUND_ALREADY_REQUESTED`.
- `PATCH /api/admin/orders/[orderId]/refund` (`src/app/api/admin/orders/[orderId]/refund/route.ts`):
  - Authenticated admin endpoint (`X-USER-ID`) for manual refund completion or denial while live gateway refund APIs are unavailable.
  - Requires `action: 'complete'` (with `manualConfirmation: true` and `note`) or `action: 'deny'` (with `note`).
  - Atomically transitions `Order.status` from `RefundProcessing` to `RefundCompleted` or `Denied` via compare-and-set (`updateMany`) and appends the audit tag (`[COMPLETED]` / `[DENIED]`) and operator note to `Refund.reason`.

## Integration note
No fake Tabapay refund endpoint is called. Completion requires explicit `manualConfirmation: true` from an operator until an official provider refund API contract is integrated. No database schema change is required.
