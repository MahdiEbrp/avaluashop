# PR #37 — Safe pending-order expiry and payment reconciliation

> Planning-only PR. No runtime code or database changes.

## Current repository facts
- Checkout reserves product stock and discount-code capacity before payment.
- Tabapay creates a local Processing payment before calling the gateway.
- A payment with a `pending:` reference indicates initialization has not yet returned a provider token.
- Callback verification treats ambiguous provider responses as pending; it must not release stock.
- `releasePendingOrder` is transactional and restores stock/coupon capacity once the order is conditionally cancelled.

## Goal
Prevent abandoned checkouts from holding stock indefinitely without cancelling a payment that may have been accepted by the provider.

## Proposed design
1. Introduce an explicit order/payment reservation expiry policy (initial proposal: 30 minutes, configurable).
2. Add a scheduled reconciliation job protected by a dedicated server-only cron secret.
3. Automatically release only reservations proven not to have reached the gateway (no Payment row, or a stale local `pending:` initialization marker).
4. Never expire a payment that has a real provider token merely because it is old. Query/verify provider state first; if the provider outcome is unavailable or ambiguous, leave the order reserved and report it for manual reconciliation.
5. Reuse the existing transactional `releasePendingOrder` helper; never decrement/increment stock outside its transaction.
6. Make the job idempotent and bounded (batch size, pagination, concurrency-safe conditional updates).

## Acceptance criteria
- Concurrent cron invocations cannot restore inventory or coupon stock twice.
- Paid orders are never cancelled.
- A provider token with an ambiguous verification result is never treated as failed.
- Job output contains counts/IDs only; no tokens, merchant credentials, or customer PII.
- Tests cover stale uninitialized reservations, stale local initialization, real provider token, already-paid order, race with callback, and DB/provider errors.
- Add operational documentation for schedule frequency, secret setup, and manual reconciliation.

## Deployment
No schema change should be introduced until the implementation proves it needs one. If a schema field is added, deployment must follow the repository's `npm run db:push` policy after backup and staging verification.
