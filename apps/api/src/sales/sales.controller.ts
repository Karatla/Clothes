import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type SaleItemInput = {
  variantId?: string;
  qty?: number;
  unitPrice?: number;
};

type SaleInput = {
  soldAt?: string;
  note?: string | null;
  items?: SaleItemInput[];
};

type SaleSearchType = 'default' | 'productCode' | 'saleNo' | 'saleId';

type SaleRecord = Prisma.SaleGetPayload<{
  include: {
    items: {
      include: {
        variant: { include: { product: true } };
      };
    };
  };
}>;

@Controller('sales')
export class SalesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('minProfit') minProfit?: string,
    @Query('maxProfit') maxProfit?: string,
    @Query('searchType') searchType?: string,
    @Query('keyword') keyword?: string,
  ) {
    const where: Prisma.SaleWhereInput = {};
    const soldAt = this.resolveDateRange(start, end);
    if (soldAt) {
      where.soldAt = soldAt;
    }

    const normalizedType = this.normalizeSearchType(searchType);
    const trimmedKeyword = keyword?.trim();
    if (trimmedKeyword) {
      if (normalizedType === 'productCode') {
        where.items = {
          some: {
            variant: {
              product: {
                baseCode: { contains: trimmedKeyword },
              },
            },
          },
        };
      } else if (normalizedType === 'saleNo') {
        where.saleNo = { contains: trimmedKeyword };
      } else if (normalizedType === 'saleId') {
        where.id = { contains: trimmedKeyword };
      }
    }

    const sales = await this.prisma.sale.findMany({
      where,
      include: {
        items: {
          include: {
            variant: { include: { product: true } },
          },
        },
      },
      orderBy: { soldAt: 'desc' },
    });

    const normalizedMinProfit = this.parseOptionalNumber(minProfit);
    const normalizedMaxProfit = this.parseOptionalNumber(maxProfit);

    return this.decorateSales(sales).filter((sale) => {
      if (
        normalizedMinProfit !== null &&
        sale.totalProfit < normalizedMinProfit
      ) {
        return false;
      }
      if (
        normalizedMaxProfit !== null &&
        sale.totalProfit > normalizedMaxProfit
      ) {
        return false;
      }
      return true;
    });
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            variant: { include: { product: true } },
          },
        },
      },
    });

    if (!sale) {
      return null;
    }

    return this.decorateSales([sale])[0] ?? null;
  }

  @Post()
  async create(@Body() body: SaleInput) {
    const soldAt = body.soldAt ? new Date(body.soldAt) : new Date();
    const items = body.items ?? [];

    if (items.length === 0) {
      throw new BadRequestException('请添加销售明细');
    }

    const normalizedItems = items.map((item) => ({
      variantId: item.variantId ?? '',
      qty: Number(item.qty ?? 0),
      unitPrice: Number(item.unitPrice ?? 0),
    }));

    if (normalizedItems.some((item) => !item.variantId)) {
      throw new BadRequestException('请选择销售商品');
    }

    if (normalizedItems.some((item) => item.qty <= 0)) {
      throw new BadRequestException('销售数量必须大于 0');
    }

    if (normalizedItems.some((item) => item.unitPrice < 0)) {
      throw new BadRequestException('单价不能小于 0');
    }

    const variantIds = normalizedItems.map((item) => item.variantId);
    const [variants, movements] = await Promise.all([
      this.prisma.variant.findMany({
        where: { id: { in: variantIds } },
      }),
      this.prisma.stockMovement.findMany({
        where: { variantId: { in: variantIds } },
      }),
    ]);

    const movementTotals = movements.reduce(
      (acc, movement) => {
        acc[movement.variantId] = (acc[movement.variantId] ?? 0) + movement.qty;
        return acc;
      },
      {} as Record<string, number>,
    );

    const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
    const stockMap = new Map(
      variants.map((variant) => [
        variant.id,
        variant.qty + (movementTotals[variant.id] ?? 0),
      ]),
    );

    for (const item of normalizedItems) {
      const available = Number(stockMap.get(item.variantId) ?? 0);
      if (item.qty > available) {
        throw new BadRequestException('库存不足，无法完成销售');
      }
    }

    const preparedItems = normalizedItems.map((item) => {
      const variant = variantMap.get(item.variantId);
      if (!variant) {
        throw new BadRequestException('找不到销售商品');
      }

      const unitCostSnapshot = variant.costPrice;
      return {
        ...item,
        unitCostSnapshot,
        lineCost: item.qty * unitCostSnapshot,
      };
    });

    const totalAmount = preparedItems.reduce(
      (sum, item) => sum + item.qty * item.unitPrice,
      0,
    );

    return this.prisma.$transaction(async (tx) => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const saleNo = await this.createSaleNo(tx, soldAt);

        try {
          const sale = await tx.sale.create({
            data: {
              saleNo,
              soldAt,
              totalAmount,
              note: body.note ?? null,
              items: {
                create: preparedItems.map((item) => ({
                  variantId: item.variantId,
                  qty: item.qty,
                  unitPrice: item.unitPrice,
                  unitCostSnapshot: item.unitCostSnapshot,
                  lineTotal: item.qty * item.unitPrice,
                  lineCost: item.lineCost,
                })),
              },
            },
          });

          await tx.stockMovement.createMany({
            data: preparedItems.map((item) => ({
              variantId: item.variantId,
              saleId: sale.id,
              type: 'OUT',
              qty: -item.qty,
              unitCost: null,
              note: '销售出库',
            })),
          });

          const savedSale = await tx.sale.findUnique({
            where: { id: sale.id },
            include: {
              items: {
                include: {
                  variant: { include: { product: true } },
                },
              },
            },
          });

          return savedSale ? this.decorateSales([savedSale])[0] : null;
        } catch (error) {
          if ((error as { code?: string })?.code === 'P2002') {
            continue;
          }

          throw error;
        }
      }

      throw new BadRequestException('销售单号生成失败，请重试');
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!sale) {
      throw new BadRequestException('找不到销售记录');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.stockMovement.deleteMany({
        where: { saleId: sale.id },
      });
      await tx.saleItem.deleteMany({
        where: { saleId: sale.id },
      });
      await tx.sale.delete({ where: { id: sale.id } });
      return { ok: true };
    });
  }

  private decorateSales(sales: SaleRecord[]) {
    return sales.map((sale) => {
      let totalCost = 0;
      let profitEstimated = false;

      const items = sale.items.map((item) => {
        const unitCost = item.unitCostSnapshot ?? item.variant.costPrice;
        const lineCost = item.lineCost ?? item.qty * unitCost;
        if (item.unitCostSnapshot === null || item.lineCost === null) {
          profitEstimated = true;
        }
        totalCost += lineCost;

        return {
          ...item,
          unitCost,
          lineCost,
          profit: item.lineTotal - lineCost,
          profitEstimated: item.unitCostSnapshot === null || item.lineCost === null,
        };
      });

      return {
        ...sale,
        items,
        totalCost,
        totalProfit: sale.totalAmount - totalCost,
        profitEstimated,
      };
    });
  }

  private normalizeSearchType(searchType?: string): SaleSearchType {
    if (searchType === 'productCode') return 'productCode';
    if (searchType === 'saleNo') return 'saleNo';
    if (searchType === 'saleId') return 'saleId';
    return 'default';
  }

  private parseOptionalNumber(value?: string) {
    if (!value?.trim()) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private resolveDateRange(start?: string, end?: string) {
    if (!start && !end) {
      return undefined;
    }

    const soldAt: Prisma.DateTimeFilter = {};
    if (start) {
      soldAt.gte = new Date(start);
    }
    if (end) {
      const endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
      soldAt.lte = endDate;
    }
    return soldAt;
  }

  private async createSaleNo(tx: Prisma.TransactionClient, soldAt: Date) {
    const year = soldAt.getFullYear();
    const month = `${soldAt.getMonth() + 1}`.padStart(2, '0');
    const day = `${soldAt.getDate()}`.padStart(2, '0');
    const dateKey = `${year}${month}${day}`;
    const counter = await tx.saleCounter.upsert({
      where: { date: dateKey },
      update: { seq: { increment: 1 } },
      create: { date: dateKey, seq: 1 },
    });

    const seq = `${counter.seq}`.padStart(4, '0');
    return `S${year}${month}${day}-${seq}`;
  }
}
