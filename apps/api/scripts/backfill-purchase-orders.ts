/**
 * Turns historical stock-in movements (StockMovement.type = IN without a
 * purchaseOrderId) into purchase orders, otherwise goods received before this
 * migration cannot be returned to the supplier.
 *
 * Grouping rule: same product + same note + created within the same second
 * counts as one stock-in.
 *
 * Idempotent: only movements with an empty purchaseOrderId are processed, so
 * re-running never creates duplicate orders.
 *
 * Run: npx ts-node -P tsconfig.json scripts/backfill-purchase-orders.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}${month}${day}`;
};

const secondKey = (date: Date) =>
  new Date(Math.floor(date.getTime() / 1000) * 1000).toISOString();

async function main() {
  const movements = await prisma.stockMovement.findMany({
    where: { type: 'IN', purchaseOrderId: null },
    include: { variant: { select: { productId: true } } },
    orderBy: { createdAt: 'asc' },
  });

  if (movements.length === 0) {
    console.log('No stock-in movements need backfilling, skipped.');
    return;
  }

  const groups = new Map<
    string,
    {
      productId: string;
      note: string | null;
      occurredAt: Date;
      movementIds: string[];
      totalQty: number;
      totalCost: number;
    }
  >();

  for (const movement of movements) {
    const productId = movement.variant?.productId;
    if (!productId) {
      console.warn(`Skipped movement ${movement.id}: product not found`);
      continue;
    }

    const key = [
      productId,
      movement.note ?? '',
      secondKey(movement.createdAt),
    ].join('__');

    const group = groups.get(key) ?? {
      productId,
      note: movement.note ?? null,
      occurredAt: movement.createdAt,
      movementIds: [],
      totalQty: 0,
      totalCost: 0,
    };

    group.movementIds.push(movement.id);
    group.totalQty += movement.qty;
    group.totalCost += movement.qty * (movement.unitCost ?? 0);
    groups.set(key, group);
  }

  const sorted = Array.from(groups.values()).sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );

  let created = 0;

  for (const group of sorted) {
    await prisma.$transaction(async (tx) => {
      const key = dateKey(group.occurredAt);
      const counter = await tx.purchaseCounter.upsert({
        where: { date: `PO-${key}` },
        update: { seq: { increment: 1 } },
        create: { date: `PO-${key}`, seq: 1 },
      });
      const orderNo = `PO${key}-${`${counter.seq}`.padStart(4, '0')}`;

      const order = await tx.purchaseOrder.create({
        data: {
          orderNo,
          productId: group.productId,
          note: group.note,
          occurredAt: group.occurredAt,
          totalQty: group.totalQty,
          totalCost: group.totalCost,
        },
      });

      await tx.stockMovement.updateMany({
        where: { id: { in: group.movementIds } },
        data: { purchaseOrderId: order.id },
      });
    });

    created += 1;
  }

  console.log(
    `Backfill done: ${movements.length} stock-in movements -> ${created} historical purchase orders.`,
  );
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
