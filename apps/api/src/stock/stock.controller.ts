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
import { PurchaseService } from '../purchase/purchase.service';
import { BarcodeService } from '../variants/barcode.service';
import { SettingsService } from '../settings/settings.service';
import { matchesKeyword } from '../common/keyword';

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
  salePrice?: number | null;
};

type BatchInInput = {
  productId?: string;
  note?: string | null;
  occurredAt?: string;
  items?: BatchInItem[];
};

@Controller('stock')
export class StockController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly purchase: PurchaseService,
    private readonly barcode: BarcodeService,
    private readonly settings: SettingsService,
  ) {}

  @Get('summary')
  async getSummary(
    @Query('categoryId') categoryId?: string,
    @Query('keyword') keyword?: string,
    @Query('stockStatus') stockStatus?: string,
  ) {
    const trimmedKeyword = keyword?.trim();
    const hasKeyword = Boolean(trimmedKeyword);
    const where: Prisma.ProductWhereInput = {};
    where.isDeleted = false;
    if (categoryId) {
      where.categoryId = categoryId;
    }
    const [allProducts, movements] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { variants: true, category: true },
        orderBy: [{ name: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.stockMovement.findMany(),
    ]);

    // 关键词同时匹配商品名称 / 款号 / 标签
    const products =
      hasKeyword && trimmedKeyword
        ? allProducts.filter((product) => matchesKeyword(product, trimmedKeyword))
        : allProducts;

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

    const filteredSummary = summary.filter((product) => {
      if (stockStatus === 'sold-out') {
        return product.totalQty <= 0;
      }
      if (stockStatus === 'in-stock') {
        return product.totalQty > 0;
      }
      return true;
    });

    const totals = filteredSummary.reduce(
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

    const categoryTotals = filteredSummary.reduce((acc, product) => {
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
      products: filteredSummary,
      totals,
      categories: Object.values(categoryTotals).sort((a, b) =>
        a.categoryName.localeCompare(b.categoryName, 'zh-CN'),
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
            salePrice: null as number | null,
          };
        }
        acc[key].qty += qty;
        if (typeof item.unitCost === 'number') {
          acc[key].unitCost = item.unitCost;
        }
        if (typeof item.salePrice === 'number' && item.salePrice > 0) {
          acc[key].salePrice = item.salePrice;
        }
        return acc;
      },
      {} as Record<
        string,
        {
          color: string;
          size: string;
          qty: number;
          unitCost: number | null;
          salePrice: number | null;
        }
      >,
    );

    const normalizedItems = Object.values(aggregated);

    if (normalizedItems.length === 0) {
      throw new BadRequestException('请至少填写一个入库数量');
    }

    const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
    if (Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException('入库日期不正确');
    }

    const barcodePrefix = (await this.settings.get('barcode.prefix')).trim();

    return this.prisma.$transaction(async (tx) => {
      const results = [] as Array<{ variantId: string }>;
      const order = await this.createPurchaseOrder(
        tx,
        productId,
        body.note ?? null,
        occurredAt,
      );
      let totalQty = 0;
      let totalCost = 0;

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
              salePrice: item.salePrice ?? 0,
              sku: `${product.baseCode}-${item.color}-${item.size}`,
            },
          });
          // 新规格立刻发条码，这样入库完就能打标签
          await this.barcode.ensureBarcode(tx, variant.id, barcodePrefix);
        } else if (item.salePrice !== null) {
          // 入库时填了售价就同步更新，避免留下售价为 0 的规格
          await tx.variant.update({
            where: { id: variant.id },
            data: { salePrice: item.salePrice },
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
            purchaseOrderId: order.id,
            type: 'IN',
            qty: item.qty,
            unitCost: unitCost,
            note: body.note ?? null,
          },
        });

        totalQty += item.qty;
        totalCost += item.qty * effectiveUnitCost;
        results.push({ variantId: variant.id });
      }

      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { totalQty, totalCost },
      });

      return {
        ok: true,
        count: results.length,
        orderNo: order.orderNo,
        purchaseOrderId: order.id,
      };
    });
  }

  private async createPurchaseOrder(
    tx: Prisma.TransactionClient,
    productId: string,
    note: string | null,
    occurredAt: Date,
  ) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const orderNo = await this.purchase.createOrderNo(tx, occurredAt);

      try {
        return await tx.purchaseOrder.create({
          data: { orderNo, productId, note, occurredAt },
        });
      } catch (error) {
        if ((error as { code?: string })?.code === 'P2002') {
          continue;
        }

        throw error;
      }
    }

    throw new BadRequestException('进货单号生成失败，请重试');
  }
}
