# PR #37 — Safe pending-order expiry and payment reconciliation

## Implemented modules & endpoints
- `src/lib/payments/reconcile-pending-orders.ts`:
  - `reconcilePendingOrders({ now, expiryMinutes = 30, limit = 50 })` scans expired `PendingPayment` orders in bounded batches (`5..1440` minutes, `1..100` batch size).
  - Automatically releases only reservations proven not to have reached the gateway (no `Payment` row, only `Failed`/`Denied` rows, or a stale local `pending:` initialization marker) via the transactional `releasePendingOrder` helper.
  - Never expires a payment that has a real provider token (`status === 'Processing'` with `!refId.startsWith('pending:')`) merely because it is old; leaves the order reserved and reports its ID in `manualReconciliationOrderIds`.
  - Paid orders (`order.isPaid` or a `Paid` / `isSuccessful` payment) are skipped and reported in `skippedPaidOrderIds`.
- `src/app/api/internal/orders/reconcile-pending/route.ts`:
  - `POST /api/internal/orders/reconcile-pending` protected by `CRON_SECRET` (`Authorization: Bearer <secret>` or `x-cron-secret`, verified with `timingSafeEqual`).
  - Returns `503 CRON_SECRET_NOT_CONFIGURED` if `CRON_SECRET` is unset or shorter than 16 characters, `401 UNAUTHORIZED` on invalid secret, and `200` with `{ cutoffIso, scannedCount, releasedOrderIds, skippedPaidOrderIds, manualReconciliationOrderIds }`.

## Deployment
No database schema change is required. Set `CRON_SECRET` (at least 16 characters) in the server environment before scheduling calls to `POST /api/internal/orders/reconcile-pending`.
