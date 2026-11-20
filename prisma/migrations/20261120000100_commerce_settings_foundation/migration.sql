-- Commerce settings foundation: shipping methods, carriers, tax rates and provider configuration.
CREATE TYPE "ShippingMethodType" AS ENUM ('FlatRate', 'Free', 'FreeAbove', 'CarrierCalculated');
CREATE TYPE "ShippingCarrierCode" AS ENUM ('Post', 'Tipax', 'Chapar');

ALTER TABLE "PaymentProvider"
  ADD COLUMN "code" TEXT,
  ADD COLUMN "settings" JSONB,
  ADD COLUMN "credentialsEncrypted" TEXT,
  ADD COLUMN "credentialsUpdatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "PaymentProvider_code_key" ON "PaymentProvider"("code");

CREATE TABLE "ShippingCarrier" (
  "id" TEXT NOT NULL,
  "code" "ShippingCarrierCode" NOT NULL,
  "title" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "settings" JSONB,
  "credentialsEncrypted" TEXT,
  "credentialsUpdatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShippingCarrier_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ShippingCarrier_code_key" ON "ShippingCarrier"("code");

CREATE TABLE "ShippingMethod" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" "ShippingMethodType" NOT NULL DEFAULT 'FlatRate',
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "freeAbove" DOUBLE PRECISION,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "allowedCities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "carrierId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShippingMethod_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ShippingMethod_isActive_sortOrder_idx" ON "ShippingMethod"("isActive", "sortOrder");
CREATE INDEX "ShippingMethod_carrierId_idx" ON "ShippingMethod"("carrierId");
ALTER TABLE "ShippingMethod" ADD CONSTRAINT "ShippingMethod_carrierId_fkey"
  FOREIGN KEY ("carrierId") REFERENCES "ShippingCarrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "TaxRate" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "rate" DOUBLE PRECISION NOT NULL,
  "appliesToShipping" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TaxRate_isActive_priority_idx" ON "TaxRate"("isActive", "priority");

ALTER TABLE "Order"
  ADD COLUMN "shippingMethodId" TEXT,
  ADD COLUMN "shippingCarrierId" TEXT,
  ADD COLUMN "shippingMethodName" TEXT,
  ADD COLUMN "shippingCarrierName" TEXT,
  ADD COLUMN "shippingTrackingNumber" TEXT,
  ADD COLUMN "taxRateSnapshot" DOUBLE PRECISION;
CREATE INDEX "Order_shippingMethodId_idx" ON "Order"("shippingMethodId");
CREATE INDEX "Order_shippingCarrierId_idx" ON "Order"("shippingCarrierId");
ALTER TABLE "Order" ADD CONSTRAINT "Order_shippingMethodId_fkey"
  FOREIGN KEY ("shippingMethodId") REFERENCES "ShippingMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_shippingCarrierId_fkey"
  FOREIGN KEY ("shippingCarrierId") REFERENCES "ShippingCarrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
