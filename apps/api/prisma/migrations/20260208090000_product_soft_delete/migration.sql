-- Add isDeleted flag to products
ALTER TABLE "Product" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "deletedAt" DATETIME;
