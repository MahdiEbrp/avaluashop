# PR #39 — Verified-purchase product reviews

## Implemented endpoints
- `GET /api/products/[productId]/reviews` (`src/app/api/products/[productId]/reviews/route.ts`):
  - Public endpoint returning reviews for `productId` with an explicit safe projection (`id`, `rating`, `text`, `createdAt`, `user.name` — never exposing email, phone, OTP, or internal user IDs) plus `summary: { count, averageRating }`.
- `POST /api/products/[productId]/reviews`:
  - Authenticated endpoint (`X-USER-ID`) validating `rating` (integer `1..5`) and `text` (`3..1000` trimmed characters).
  - Enforces **verified purchase**: the caller must own a paid order (`isPaid: true`, status in `Processing`, `Shipped`, or `Delivered`) containing `productId`, or the endpoint returns `403 VERIFIED_PURCHASE_REQUIRED`.
  - Enforces one review per `(productId, userId)` and maps duplicate/unique conflicts (`P2002`) to `409 REVIEW_ALREADY_EXISTS`.
- `DELETE /api/products/[productId]/reviews`:
  - Authenticated endpoint (`X-USER-ID`) deleting only the caller's own review for `productId` (`404 REVIEW_NOT_FOUND` if none exists).

## Deployment
Uses the existing `ProductReview` model and `UniqueProductProductReview` constraint in `prisma/schema.prisma` with no schema changes.
