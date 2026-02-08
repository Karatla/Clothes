import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type MovementInput = {
  variantId?: string;
  type?: 'IN' | 'ADJUST';
  qty?: number;
  unitCost?: number | null;
  note?: string | null;
};

type BatchInItem = {
  color?: string;
  size?: string;
  qty?: number;
  unitCost?: number | null;
};

type BatchInInput = {
  productId?: string;
  note?: string | null;
  items?: BatchInItem[];
};

@Controller('stock')
export class StockController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('summary')
  async getSummary(
    @Query('categoryId') categoryId?: string,
    @Query('keyword') keyword?: string,
  ) {
    const trimmedKeyword = keyword?.trim();
    const hasKeyword = Boolean(trimmedKeyword);
    const where: Prisma.ProductWhereInput = {};
    where.isDeleted = false;
    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (hasKeyword && trimmedKeyword) {
      where.OR = [
        { name: { contains: trimmedKeyword } },
        { baseCode: { contains: trimmedKeyword } },
      ];
    }
    const [products, movements] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { variants: true, category: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockMovement.findMany(),
    ]);

    const movementTotals = movements.reduce(
      (acc, movement) => {
        acc[movement.variantId] = (acc[movement.variantId] ?? 0) + movement.qty;
        return acc;
      },
      {} as Record<string, number>,
    );

    const summary = products.map((product) => {
      const variants = product.variants.map((variant) => {
        const delta = movementTotals[variant.id] ?? 0;
        const currentQty = variant.qty + delta;
        const totalCost = currentQty * variant.costPrice;

        return { ...variant, currentQty, totalCost };
      });

      const totalQty = variants.reduce(
        (sum, variant) => sum + variant.currentQty,
        0,
      );
      const totalCost = variants.reduce(
        (sum, variant) => sum + variant.totalCost,
        0,
      );

      return {
        ...product,
        totalQty,
        totalCost,
        variants,
      };
    });

    const totals = summary.reduce(
      (acc, product) => {
        acc.totalQty += product.totalQty;
        acc.totalCost += product.totalCost;
        if (product.totalQty > 0) {
          acc.productCount += 1;
        }
        product.variants.forEach((variant) => {
          if (variant.currentQty > 0) {
            acc.variantCount += 1;
          }
        });
        return acc;
      },
      { totalQty: 0, totalCost: 0, productCount: 0, variantCount: 0 },
    );

    const categoryTotals = summary.reduce((acc, product) => {
      const categoryId = product.categoryId ?? 'uncategorized';
      const categoryName = product.category?.name ?? '未分类';
      if (!acc[categoryId]) {
        acc[categoryId] = {
          categoryId,
          categoryName,
          totalQty: 0,
          totalCost: 0,
          productCount: 0,
          variantCount: 0,
        };
      }
      const row = acc[categoryId];
      row.totalQty += product.totalQty;
      row.totalCost += product.totalCost;
      if (product.totalQty > 0) {
        row.productCount += 1;
      }
      product.variants.forEach((variant) => {
        if (variant.currentQty > 0) {
          row.variantCount += 1;
        }
      });
      return acc;
    }, {} as Record<string, {
      categoryId: string;
      categoryName: string;
      totalQty: number;
      totalCost: number;
      productCount: number;
      variantCount: number;
    }>);

    return {
      products: summary,
      totals,
      categories: Object.values(categoryTotals).sort(
        (a, b) => b.totalQty - a.totalQty,
      ),
      updatedAt: new Date().toISOString(),
    };
  }

  @Get('movements')
  async listMovements() {
    const movements = await this.prisma.stockMovement.findMany({
      include: { variant: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return movements.map((movement) => ({
      ...movement,
      product: movement.variant?.product ?? null,
      variant: movement.variant
        ? {
            color: movement.variant.color,
            size: movement.variant.size,
            sku: movement.variant.sku,
          }
        : null,
    }));
  }

  @Post('movements')
  async createMovement(@Body() body: MovementInput) {
    const variantId = body.variantId;
    const type = body.type;
    const qty = typeof body.qty === 'number' ? body.qty : null;

    if (!variantId || !type || qty === null) {
      throw new BadRequestException('请填写完整的入库信息');
    }

    if (!['IN', 'ADJUST'].includes(type)) {
      throw new BadRequestException('入库类型不正确');
    }

    if (type === 'IN' && qty <= 0) {
      throw new BadRequestException('入库数量必须大于 0');
    }

    if (type === 'ADJUST' && qty === 0) {
      throw new BadRequestException('调整数量不能为 0');
    }

    const variant = await this.prisma.variant.findUnique({
      where: { id: variantId },
    });
    if (!variant) {
      throw new BadRequestException('找不到对应的尺码库存');
    }

    return this.prisma.$transaction(async (tx) => {
      if (type === 'IN') {
        const movementSum = await tx.stockMovement.aggregate({
          where: { variantId },
          _sum: { qty: true },
        });
        const currentQty = variant.qty + (movementSum._sum.qty ?? 0);
        const unitCost =
          typeof body.unitCost === 'number' ? body.unitCost : variant.costPrice;
        const nextQty = currentQty + qty;
        const nextCostPrice =
          nextQty > 0
            ? (currentQty * variant.costPrice + qty * unitCost) / nextQty
            : variant.costPrice;

        await tx.variant.update({
          where: { id: variantId },
          data: { costPrice: nextCostPrice },
        });
      }

      return tx.stockMovement.create({
        data: {
          variantId,
          type,
          qty,
          unitCost: typeof body.unitCost === 'number' ? body.unitCost : null,
          note: body.note ?? null,
        },
      });
    });
  }

  @Post('batch-in')
  async batchIn(@Body() body: BatchInInput) {
    const productId = body.productId;
    const items = body.items ?? [];

    if (!productId || items.length === 0) {
      throw new BadRequestException('请填写完整的入库信息');
    }

    const product = await this.prisma.product.findFirst({
      where: { id: productId, isDeleted: false },
    });

    if (!product) {
      throw new BadRequestException('找不到对应的商品');
    }

    const aggregated = items.reduce(
      (acc, item) => {
        const color = item.color?.trim();
        const size = item.size?.trim();
        const qty = typeof item.qty === 'number' ? item.qty : 0;
        if (!color || !size || qty <= 0) {
          return acc;
        }
        const key = `${color}__${size}`;
        if (!acc[key]) {
          acc[key] = {
            color,
            size,
            qty: 0,
            unitCost: null as number | null,
          };
        }
        acc[key].qty += qty;
        if (typeof item.unitCost === 'number') {
          acc[key].unitCost = item.unitCost;
        }
        return acc;
      },
      {} as Record<string, { color: string; size: string; qty: number; unitCost: number | null }>,
    );

    const normalizedItems = Object.values(aggregated);

    if (normalizedItems.length === 0) {
      throw new BadRequestException('请至少填写一个入库数量');
    }

    return this.prisma.$transaction(async (tx) => {
      const results = [] as Array<{ variantId: string }>;

      for (const item of normalizedItems) {
        const unitCost =
          typeof item.unitCost === 'number' ? item.unitCost : null;

        let variant = await tx.variant.findFirst({
          where: {
            productId,
            color: item.color,
            size: item.size,
          },
        });

        if (!variant) {
          variant = await tx.variant.create({
            data: {
              productId,
              color: item.color,
              size: item.size,
              qty: 0,
              costPrice: unitCost ?? 0,
              salePrice: 0,
              sku: `${product.baseCode}-${item.color}-${item.size}`,
            },
          });
        }

        const movementSum = await tx.stockMovement.aggregate({
          where: { variantId: variant.id },
          _sum: { qty: true },
        });
        const currentQty = variant.qty + (movementSum._sum.qty ?? 0);
        const effectiveUnitCost =
          unitCost !== null ? unitCost : variant.costPrice;
        const nextQty = currentQty + item.qty;
        const nextCostPrice =
          nextQty > 0
            ? (currentQty * variant.costPrice + item.qty * effectiveUnitCost) / nextQty
            : variant.costPrice;

        await tx.variant.update({
          where: { id: variant.id },
          data: { costPrice: nextCostPrice },
        });

        await tx.stockMovement.create({
          data: {
            variantId: variant.id,
            type: 'IN',
            qty: item.qty,
            unitCost: unitCost,
            note: body.note ?? null,
          },
        });

        results.push({ variantId: variant.id });
      }

      return { ok: true, count: results.length };
    });
  }
}
