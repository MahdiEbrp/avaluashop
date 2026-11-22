# PR #38 — Refund request and auditable processing workflow

> Planning-only PR. No runtime code or database changes.

## Current repository facts
- `Refund` exists with `amount`, `reason`, and a unique relation to `Order`.
- Order statuses include `RefundProcessing` and `RefundCompleted`.
- No provider-side Tabapay refund operation or complete customer/admin refund workflow was found in the audited route tree.
- Payment settlement must not be edited directly by the admin payment endpoint.

## Goal
Add a traceable refund lifecycle without claiming that money was returned before a provider or authorized payment operator confirms it.

## Proposed design
1. Customer submits a refund request only for an order owned by them and eligible under explicit store policy.
2. Validate order state, paid status, item/order eligibility, request reason, and that no refund request already exists.
3. Admin can approve or reject a request with an audit record and actor/timestamp.
4. Approval is not equivalent to money returned. Completion requires verified provider refund evidence or a separately authorized, auditable manual confirmation.
5. Store provider refund reference, amount, currency, state, timestamps, and safe failure reason; never store secrets or card data.
6. Use idempotency keys and conditional state transitions to prevent duplicate refund requests or double completion.
7. Restore stock only under an explicit return/restock policy after goods are received and inspected; never automatically restock merely because a refund was requested.

## Acceptance criteria
- Customers cannot request refunds for another user's order.
- Duplicate requests and concurrent approvals are safely rejected.
- Refund amount cannot exceed the captured amount minus prior successful refunds.
- Order/payment states cannot be marked refunded by arbitrary client input.
- Provider uncertainty leaves the refund pending reconciliation.
- Tests cover authorization, eligibility, duplicate requests, amount bounds, concurrency, rejection, provider failure, and confirmed completion.
- Admin actions are auditable.

## Integration blocker
Do not implement a fake Tabapay refund endpoint. First obtain and verify the provider's official refund API contract and sandbox support. Until then, implement request/approval tracking only, with a clearly labelled manual processing state.
