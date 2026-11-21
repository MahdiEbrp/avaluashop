# PR #39 — Verified-purchase product reviews and moderation

> Planning-only PR. No runtime code or database changes.

## Current repository facts
- `ProductReview` already relates a user and product.
- A unique constraint permits at most one review per user/product.
- The schema stores text and a 1–5-style integer rating, but an approval/moderation state and review API/UI were not found in the audited route tree.

## Goal
Allow genuine customers to review products while preventing arbitrary, abusive, or unverified reviews from appearing publicly.

## Proposed design
1. Add authenticated create/update/delete endpoints scoped to the signed-in user.
2. Require a paid order containing the reviewed product (verified purchase).
3. Validate rating bounds, text length, content type, and request size.
4. Add moderation state (Pending, Approved, Rejected) with safe defaults; only Approved reviews are public.
5. Add admin moderation endpoints with role/session enforcement and an audit trail.
6. Public product detail returns only approved reviews and aggregate rating/count; do not expose reviewer email, phone, or internal identifiers.
7. Prevent duplicate reviews using the existing unique constraint and handle Prisma unique conflicts as 409.

## Acceptance criteria
- Anonymous users cannot create reviews.
- A user cannot review a product they have not purchased and paid for.
- Reviews from another user's orders cannot be used to authorize a review.
- Public queries expose approved content only and use explicit field selection.
- Rating is an integer in the configured range.
- Moderation actions require verified admin access.
- Tests cover ownership, verified purchase, duplicate review, validation, public privacy, moderation, and DB errors.

## Deployment
If moderation fields are added, update Prisma schema and tests, then use `npm run db:push` only after backup and staging verification. No migration directory should be introduced.
