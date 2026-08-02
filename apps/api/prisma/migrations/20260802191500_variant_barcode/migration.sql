-- AlterTable: 新增可空的条码列，已有数据全部为 NULL
ALTER TABLE "Variant" ADD COLUMN "barcode" TEXT;

-- CreateTable: 条码发号器
CREATE TABLE "BarcodeCounter" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "seq" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex: SQLite 的唯一索引允许多个 NULL，所以历史数据不受影响
CREATE UNIQUE INDEX "Variant_barcode_key" ON "Variant"("barcode");
