# PR #40 — Carrier API integration plan

> Planning-only PR. No runtime code or database changes.

## Current repository facts
- Carrier records exist for Post, Tipax, and Chapar.
- A provider-neutral adapter interface and registry exist for quote, shipment creation, and tracking operations.
- Manual tracking number entry exists.
- Carrier-calculated shipping is currently unavailable; no live carrier API integration was found in the audited implementation.

## Goal
Connect carrier APIs without leaking credentials, fabricating quotes, or blocking checkout when a carrier is unavailable.

## Proposed design
1. Implement one adapter per carrier behind the existing interface; do not add provider-specific branching to checkout.
2. Confirm official API documentation, sandbox access, supported services, coverage, and rate limits before implementation.
3. Store credentials encrypted server-side and expose only safe configuration metadata to admin UI.
4. Quote requests must use validated destination and parcel data; return explicit unavailable/error states rather than guessed prices.
5. Persist quote expiry and selected service/price snapshot on the order so checkout totals cannot change after order creation.
6. Shipment creation must be idempotent; persist provider shipment ID and tracking number only after provider confirmation.
7. Tracking sync must be rate-limited, retryable, and safe against out-of-order status updates.
8. Keep manual tracking as a fallback and clearly distinguish manual from provider-synchronized status.

## Acceptance criteria
- No provider credentials are returned by any API.
- No live quote is represented as available without a confirmed carrier response.
- Checkout uses a server-validated, non-expired quote snapshot.
- Duplicate shipment creation is prevented.
- Tracking events cannot regress a delivered order to an earlier state.
- Adapter contract tests and provider sandbox tests cover success, invalid credentials, timeout, malformed response, rate limit, and retry.
- Tests cover all three carriers independently.

## Integration blockers
Do not invent API URLs, request formats, or credentials. Each carrier needs official API documentation and sandbox credentials supplied through the business's secure secret-management process, never through chat or source control.
