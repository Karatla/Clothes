/**
 * Gives every existing variant a barcode, so labels can be printed for goods
 * that were entered before this feature existed.
 *
 * Idempotent: variants that already have a barcode are skipped, so re-running
 * never changes a label that has already been printed and stuck on a garment.
 *
 * Run: npx ts-node -P tsconfig.json scripts/backfill-barcodes.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const COUNTER_KEY = 'variant';
const START_SEQ = 10000000;

async function main() {
  const prefixRow = await prisma.setting.findUnique({
    where: { key: 'barcode.prefix' },
  });
  const prefix = (prefixRow?.value ?? '').trim();

  const variants = await prisma.variant.findMany({
    where: { barcode: null },
    select: { id: true, sku: true },
    orderBy: { sku: 'asc' },
  });

  if (variants.length === 0) {
    console.log('Every variant already has a barcode, skipped.');
    return;
  }

  let created = 0;

  for (const variant of variants) {
    await prisma.$transaction(async (tx) => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const counter = await tx.barcodeCounter.upsert({
          where: { key: COUNTER_KEY },
          update: { seq: { increment: 1 } },
          create: { key: COUNTER_KEY, seq: START_SEQ + 1 },
        });
        const barcode = `${prefix}${counter.seq}`;

        try {
          await tx.variant.update({
            where: { id: variant.id },
            data: { barcode },
          });
          created += 1;
          return;
        } catch (error) {
          if ((error as { code?: string })?.code === 'P2002') {
            continue;
          }
          throw error;
        }
      }
      throw new Error(`Could not generate a barcode for ${variant.sku}`);
    });
  }

  console.log(`Barcode backfill done: ${created} variants got a barcode.`);
}

main()
  .catch((error) => {
    console.error('Barcode backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
