-- Complete the commerce settings foundation without redefining ShippingMethod.
-- Existing rows receive stable, unique legacy codes before the column becomes required.
ALTER TABLE "ShippingMethod" ADD COLUMN "code" TEXT;
UPDATE "ShippingMethod" SET "code" = 'legacy-' || "id" WHERE "code" IS NULL;
ALTER TABLE "ShippingMethod" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "ShippingMethod_code_key" ON "ShippingMethod"("code");

CREATE TABLE "StoreSetting" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "taxEnabled" BOOLEAN NOT NULL DEFAULT true,
  "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0.09,
  "taxLabel" TEXT NOT NULL DEFAULT 'مالیات بر ارزش افزوده',
  "currency" TEXT NOT NULL DEFAULT 'IRT',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreSetting_pkey" PRIMARY KEY ("id")
);

-- Ensure a default row exists for database-backed checkout settings.
INSERT INTO "StoreSetting" ("id", "taxEnabled", "taxRate", "taxLabel", "currency", "updatedAt")
VALUES ('default', true, 0.09, 'مالیات بر ارزش افزوده', 'IRT', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
