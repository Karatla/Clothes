import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type ReportRow = {
  productId: string;
  productName: string;
  baseCode: string;
  variantId?: string;
  color?: string;
  size?: string;
  soldQty: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
};

@Controller('reports')
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('sales')
  async sales(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('groupBy') groupBy?: string,
  ) {
    const { startDate, endDate } = this.resolveDateRange(start, end);
    const group = groupBy === 'product' ? 'product' : 'variant';

    const [saleItems, returnItems] = await Promise.all([
      this.prisma.saleItem.findMany({
        where: {
          sale: {
            soldAt: { gte: startDate, lte: endDate },
          },
        },
        include: {
          variant: { include: { product: true } },
        },
      }),
      this.prisma.returnItem.findMany({
        where: {
          return: {
            returnedAt: { gte: startDate, lte: endDate },
          },
        },
        include: {
          variant: { include: { product: true } },
        },
      }),
    ]);

    const rows = new Map<string, ReportRow>();

    const upsertRow = (input: Omit<ReportRow, 'soldQty' | 'revenue' | 'cost' | 'profit' | 'margin'>) => {
      const key = group === 'product'
        ? `product:${input.productId}`
        : `variant:${input.variantId}`;

      if (!rows.has(key)) {
        rows.set(key, {
          ...input,
          soldQty: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
          margin: 0,
        });
      }

      return rows.get(key)!;
    };

    saleItems.forEach((item) => {
      const variant = item.variant;
      const product = variant.product;
      const row = upsertRow({
        productId: product.id,
        productName: product.name,
        baseCode: product.baseCode,
        variantId: variant.id,
        color: variant.color,
        size: variant.size,
      });

      row.soldQty += item.qty;
      row.revenue += item.lineTotal;
      row.cost += item.qty * variant.costPrice;
    });

    returnItems.forEach((item) => {
      const variant = item.variant;
      const product = variant.product;
      const row = upsertRow({
        productId: product.id,
        productName: product.name,
        baseCode: product.baseCode,
        variantId: variant.id,
        color: variant.color,
        size: variant.size,
      });

      row.soldQty -= item.qty;
      row.revenue -= item.lineTotal;
      row.cost -= item.qty * variant.costPrice;
    });

    const data = Array.from(rows.values()).map((row) => {
      const profit = row.revenue - row.cost;
      const margin = row.revenue === 0 ? 0 : profit / row.revenue;
      return { ...row, profit, margin };
    });

    const totals = data.reduce(
      (acc, row) => {
        acc.soldQty += row.soldQty;
        acc.revenue += row.revenue;
        acc.cost += row.cost;
        acc.profit += row.profit;
        return acc;
      },
      { soldQty: 0, revenue: 0, cost: 0, profit: 0 },
    );

    return {
      groupBy: group,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      totals: {
        ...totals,
        margin: totals.revenue === 0 ? 0 : totals.profit / totals.revenue,
      },
      rows: data.sort((a, b) => b.revenue - a.revenue),
    };
  }

  private resolveDateRange(start?: string, end?: string) {
    const now = new Date();
    const startDate = start ? new Date(start) : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = end ? new Date(end) : now;
    return { startDate, endDate };
  }
}
