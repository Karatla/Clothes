import 'dotenv/config';
import { PrismaClient, StockMovementType } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';

type JsonStore = {
  categories?: Array<{
    id: string;
    name: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  products?: Array<{
    id: string;
    name: string;
    baseCode: string;
    categoryId: string | null;
    tags: string[];
    imageUrl: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  variants?: Array<{
    id: string;
    productId: string;
    color: string;
    size: string;
    qty: number;
    costPrice: number;
    salePrice: number;
    sku: string;
  }>;
  movements?: Array<{
    id: string;
    variantId: string;
    type: 'IN' | 'OUT' | 'RETURN' | 'ADJUST';
    qty: number;
    unitCost: number | null;
    note: string | null;
    createdAt: string;
  }>;
};

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.category.count();
  if (count > 0) {
    console.log('Database already seeded.');
    return;
  }

  const jsonPath = path.join(process.cwd(), 'data', 'db.json');
  const raw = await fs.readFile(jsonPath, 'utf-8');
  const data = JSON.parse(raw) as JsonStore;

  if (data.categories?.length) {
    await prisma.category.createMany({
      data: data.categories.map((category) => ({
        id: category.id,
        name: category.name,
        isActive: category.isActive,
        createdAt: new Date(category.createdAt),
        updatedAt: new Date(category.updatedAt),
      })),
    });
  }

  if (data.products?.length) {
    await prisma.product.createMany({
      data: data.products.map((product) => ({
        id: product.id,
        name: product.name,
        baseCode: product.baseCode,
        categoryId: product.categoryId,
        tags: product.tags,
        imageUrl: product.imageUrl,
        createdAt: new Date(product.createdAt),
        updatedAt: new Date(product.updatedAt),
      })),
    });
  }

  if (data.variants?.length) {
    await prisma.variant.createMany({
      data: data.variants.map((variant) => ({
        id: variant.id,
        productId: variant.productId,
        color: variant.color,
        size: variant.size,
        qty: variant.qty,
        costPrice: variant.costPrice,
        salePrice: variant.salePrice,
        sku: variant.sku,
      })),
    });
  }

  if (data.movements?.length) {
    await prisma.stockMovement.createMany({
      data: data.movements.map((movement) => ({
        id: movement.id,
        variantId: movement.variantId,
        type: movement.type as StockMovementType,
        qty: movement.qty,
        unitCost: movement.unitCost,
        note: movement.note,
        createdAt: new Date(movement.createdAt),
      })),
    });
  }

  console.log('Import complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
