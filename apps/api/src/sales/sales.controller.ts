import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
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

@Controller('sales')
export class SalesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.sale.findMany({
      include: {
        items: {
          include: {
            variant: { include: { product: true } },
          },
        },
      },
      orderBy: { soldAt: 'desc' },
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.prisma.sale.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            variant: { include: { product: true } },
          },
        },
      },
    });
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

    const totalAmount = normalizedItems.reduce(
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
                create: normalizedItems.map((item) => ({
                  variantId: item.variantId,
                  qty: item.qty,
                  unitPrice: item.unitPrice,
                  lineTotal: item.qty * item.unitPrice,
                })),
              },
            },
          });

          await tx.stockMovement.createMany({
            data: normalizedItems.map((item) => ({
              variantId: item.variantId,
              saleId: sale.id,
              type: 'OUT',
              qty: -item.qty,
              unitCost: null,
              note: '销售出库',
            })),
          });

          return tx.sale.findUnique({
            where: { id: sale.id },
            include: { items: true },
          });
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
