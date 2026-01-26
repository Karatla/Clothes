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

  @Get('daily')
  async daily(@Query('start') start?: string, @Query('end') end?: string) {
    const { startDate, endDate } = this.resolveDateRange(start, end, true);

    const [sales, returns] = await Promise.all([
      this.prisma.sale.findMany({
        where: { soldAt: { gte: startDate, lte: endDate } },
        include: { items: true },
      }),
      this.prisma.return.findMany({
        where: { returnedAt: { gte: startDate, lte: endDate } },
        include: { items: true },
      }),
    ]);

    const buckets = new Map<string, { date: string; revenue: number; refunds: number }>();
    const ensureBucket = (date: string) => {
      if (!buckets.has(date)) {
        buckets.set(date, { date, revenue: 0, refunds: 0 });
      }
      return buckets.get(date)!;
    };

    sales.forEach((sale) => {
      const date = sale.soldAt.toISOString().slice(0, 10);
      const bucket = ensureBucket(date);
      bucket.revenue += sale.items.reduce((sum, item) => sum + item.lineTotal, 0);
    });

    returns.forEach((ret) => {
      const date = ret.returnedAt.toISOString().slice(0, 10);
      const bucket = ensureBucket(date);
      bucket.refunds += ret.items.reduce((sum, item) => sum + item.lineTotal, 0);
    });

    return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  @Get('top-products')
  async topProducts(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('limit') limit?: string,
  ) {
    const { startDate, endDate } = this.resolveDateRange(start, end, true);
    const max = Number(limit ?? 10);

    const [saleItems, returnItems] = await Promise.all([
      this.prisma.saleItem.findMany({
        where: {
          sale: {
            soldAt: { gte: startDate, lte: endDate },
          },
        },
        include: { variant: { include: { product: true } } },
      }),
      this.prisma.returnItem.findMany({
        where: {
          return: {
            returnedAt: { gte: startDate, lte: endDate },
          },
        },
        include: { variant: { include: { product: true } } },
      }),
    ]);

    const totals = new Map<string, { name: string; baseCode: string; revenue: number; soldQty: number }>();
    const ensureProduct = (productId: string, name: string, baseCode: string) => {
      if (!totals.has(productId)) {
        totals.set(productId, { name, baseCode, revenue: 0, soldQty: 0 });
      }
      return totals.get(productId)!;
    };

    saleItems.forEach((item) => {
      const product = item.variant.product;
      const row = ensureProduct(product.id, product.name, product.baseCode);
      row.revenue += item.lineTotal;
      row.soldQty += item.qty;
    });

    returnItems.forEach((item) => {
      const product = item.variant.product;
      const row = ensureProduct(product.id, product.name, product.baseCode);
      row.revenue -= item.lineTotal;
      row.soldQty -= item.qty;
    });

    return Array.from(totals.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, Number.isFinite(max) ? max : 10);
  }

  private resolveDateRange(start?: string, end?: string, clampEnd?: boolean) {
    const now = new Date();
    const startDate = start ? new Date(start) : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = end ? new Date(end) : now;
    if (clampEnd) {
      endDate.setHours(23, 59, 59, 999);
    }
    return { startDate, endDate };
  }
}
