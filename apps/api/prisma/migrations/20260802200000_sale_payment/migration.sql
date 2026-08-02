-- AlterTable: 收款方式 / 实收 / 找零，全部可空，历史订单保持 NULL
ALTER TABLE "Sale" ADD COLUMN "paymentMethod" TEXT;
ALTER TABLE "Sale" ADD COLUMN "receivedAmount" REAL;
ALTER TABLE "Sale" ADD COLUMN "changeAmount" REAL;
