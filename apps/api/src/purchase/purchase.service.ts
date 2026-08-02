import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type PurchaseReturnItemInput = {
  variantId?: string;
  qty?: number;
};

export type PurchaseReturnInput = {
  purchaseOrderId?: string;
  returnedAt?: string;
  note?: string | null;
  items?: PurchaseReturnItemInput[];
};

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}${month}${day}`;
};

@Injectable()
export class PurchaseService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrderNo(tx: Prisma.TransactionClient, occurredAt: Date) {
    const key = dateKey(occurredAt);
    const counter = await tx.purchaseCounter.upsert({
      where: { date: `PO-${key}` },
      update: { seq: { increment: 1 } },
      create: { date: `PO-${key}`, seq: 1 },
    });

    return `PO${key}-${`${counter.seq}`.padStart(4, '0')}`;
  }

  async createReturnNo(tx: Prisma.TransactionClient, returnedAt: Date) {
    const key = dateKey(returnedAt);
    const counter = await tx.purchaseCounter.upsert({
      where: { date: `PR-${key}` },
      update: { seq: { increment: 1 } },
      create: { date: `PR-${key}`, seq: 1 },
    });

    return `PR${key}-${`${counter.seq}`.padStart(4, '0')}`;
  }

  /**
   * 进货单列表。可按商品、单号关键词、日期范围过滤，
   * 每一单都会带上每个颜色尺码的「已入库 / 已退货 / 可退」数量。
   */
  async listOrders(params: {
    productId?: string;
    keyword?: string;
    start?: string;
    end?: string;
  }) {
    const where: Prisma.PurchaseOrderWhereInput = {};
    if (params.productId) {
      where.productId = params.productId;
    }

    const trimmedKeyword = params.keyword?.trim();
    if (trimmedKeyword) {
      where.OR = [
        { orderNo: { contains: trimmedKeyword } },
        { note: { contains: trimmedKeyword } },
      ];
    }

    const occurredAt = this.resolveDateRange(params.start, params.end);
    if (occurredAt) {
      where.occurredAt = occurredAt;
    }

    const orders = await this.prisma.purchaseOrder.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, baseCode: true } },
        movements: {
          where: { type: 'IN' },
          include: { variant: true },
        },
        returns: { include: { items: true } },
      },
      orderBy: { occurredAt: 'desc' },
    });

    const variantIds = orders.flatMap((order) =>
      order.movements.map((movement) => movement.variantId),
    );
    const stockMap = await this.currentStockMap(variantIds);

    return orders.map((order) => {
      const returnedMap = new Map<string, number>();
      order.returns.forEach((record) => {
        record.items.forEach((item) => {
          returnedMap.set(
            item.variantId,
            (returnedMap.get(item.variantId) ?? 0) + item.qty,
          );
        });
      });

      const grouped = new Map<
        string,
        {
          variantId: string;
          color: string;
          size: string;
          sku: string;
          inQty: number;
          unitCost: number;
        }
      >();

      order.movements.forEach((movement) => {
        const variant = movement.variant;
        const row = grouped.get(movement.variantId) ?? {
          variantId: movement.variantId,
          color: variant?.color ?? '',
          size: variant?.size ?? '',
          sku: variant?.sku ?? '',
          inQty: 0,
          unitCost: movement.unitCost ?? variant?.costPrice ?? 0,
        };
        row.inQty += movement.qty;
        if (typeof movement.unitCost === 'number') {
          row.unitCost = movement.unitCost;
        }
        grouped.set(movement.variantId, row);
      });

      const items = Array.from(grouped.values()).map((row) => {
        const returnedQty = returnedMap.get(row.variantId) ?? 0;
        const currentQty = stockMap.get(row.variantId) ?? 0;
        const returnable = Math.max(
          0,
          Math.min(row.inQty - returnedQty, currentQty),
        );

        return {
          ...row,
          returnedQty,
          currentQty,
          returnableQty: returnable,
        };
      });

      const returnedTotal = items.reduce((sum, item) => sum + item.returnedQty, 0);
      const returnableTotal = items.reduce(
        (sum, item) => sum + item.returnableQty,
        0,
      );

      return {
        id: order.id,
        orderNo: order.orderNo,
        productId: order.productId,
        product: order.product,
        note: order.note,
        occurredAt: order.occurredAt,
        totalQty: order.totalQty,
        totalCost: order.totalCost,
        returnedQty: returnedTotal,
        returnableQty: returnableTotal,
        items,
      };
    });
  }

  async listReturns(params: { purchaseOrderId?: string; productId?: string }) {
    const where: Prisma.PurchaseReturnWhereInput = {};
    if (params.purchaseOrderId) {
      where.purchaseOrderId = params.purchaseOrderId;
    }
    if (params.productId) {
      where.purchaseOrder = { productId: params.productId };
    }

    const records = await this.prisma.purchaseReturn.findMany({
      where,
      include: {
        purchaseOrder: {
          include: {
            product: { select: { id: true, name: true, baseCode: true } },
          },
        },
        items: { include: { variant: true } },
      },
      orderBy: { returnedAt: 'desc' },
    });

    return records.map((record) => ({
      ...record,
      items: record.items.map((item) => ({
        ...item,
        color: item.variant?.color ?? '',
        size: item.variant?.size ?? '',
        sku: item.variant?.sku ?? '',
      })),
    }));
  }

  async createReturn(body: PurchaseReturnInput) {
    const purchaseOrderId = body.purchaseOrderId;
    if (!purchaseOrderId) {
      throw new BadRequestException('请选择进货订单');
    }

    const returnedAt = body.returnedAt ? new Date(body.returnedAt) : new Date();
    if (Number.isNaN(returnedAt.getTime())) {
      throw new BadRequestException('退货日期不正确');
    }

    const aggregated = (body.items ?? []).reduce((acc, item) => {
      const variantId = item.variantId;
      const qty = typeof item.qty === 'number' ? Math.trunc(item.qty) : 0;
      if (!variantId || qty <= 0) {
        return acc;
      }
      acc.set(variantId, (acc.get(variantId) ?? 0) + qty);
      return acc;
    }, new Map<string, number>());

    if (aggregated.size === 0) {
      throw new BadRequestException('请填写退货数量');
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        include: {
          movements: { where: { type: 'IN' } },
          returns: { include: { items: true } },
        },
      });

      if (!order) {
        throw new BadRequestException('找不到对应的进货订单');
      }

      const inQtyMap = new Map<string, number>();
      const unitCostMap = new Map<string, number>();
      order.movements.forEach((movement) => {
        inQtyMap.set(
          movement.variantId,
          (inQtyMap.get(movement.variantId) ?? 0) + movement.qty,
        );
        if (typeof movement.unitCost === 'number') {
          unitCostMap.set(movement.variantId, movement.unitCost);
        }
      });

      const returnedMap = new Map<string, number>();
      order.returns.forEach((record) => {
        record.items.forEach((item) => {
          returnedMap.set(
            item.variantId,
            (returnedMap.get(item.variantId) ?? 0) + item.qty,
          );
        });
      });

      const prepared: Array<{
        variantId: string;
        qty: number;
        unitCost: number;
        lineCost: number;
      }> = [];

      for (const [variantId, qty] of aggregated) {
        const variant = await tx.variant.findUnique({
          where: { id: variantId },
        });
        if (!variant) {
          throw new BadRequestException('找不到对应的尺码库存');
        }

        const inQty = inQtyMap.get(variantId) ?? 0;
        if (inQty <= 0) {
          throw new BadRequestException(
            `${variant.color} / ${variant.size} 不属于该进货订单`,
          );
        }

        const remaining = inQty - (returnedMap.get(variantId) ?? 0);
        if (qty > remaining) {
          throw new BadRequestException(
            `${variant.color} / ${variant.size} 本单最多还能退 ${remaining} 件`,
          );
        }

        const movementSum = await tx.stockMovement.aggregate({
          where: { variantId },
          _sum: { qty: true },
        });
        const currentQty = variant.qty + (movementSum._sum.qty ?? 0);
        if (qty > currentQty) {
          throw new BadRequestException(
            `${variant.color} / ${variant.size} 当前库存只有 ${currentQty} 件，无法退货`,
          );
        }

        const unitCost = unitCostMap.get(variantId) ?? variant.costPrice;
        const nextQty = currentQty - qty;
        const nextCostPrice =
          nextQty > 0
            ? Math.max(
                0,
                (currentQty * variant.costPrice - qty * unitCost) / nextQty,
              )
            : variant.costPrice;

        await tx.variant.update({
          where: { id: variantId },
          data: { costPrice: nextCostPrice },
        });

        prepared.push({
          variantId,
          qty,
          unitCost,
          lineCost: qty * unitCost,
        });
      }

      const totalQty = prepared.reduce((sum, item) => sum + item.qty, 0);
      const totalCost = prepared.reduce((sum, item) => sum + item.lineCost, 0);

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const returnNo = await this.createReturnNo(tx, returnedAt);

        try {
          const created = await tx.purchaseReturn.create({
            data: {
              returnNo,
              purchaseOrderId: order.id,
              returnedAt,
              note: body.note ?? null,
              totalQty,
              totalCost,
              items: {
                create: prepared.map((item) => ({
                  variantId: item.variantId,
                  qty: item.qty,
                  unitCost: item.unitCost,
                  lineCost: item.lineCost,
                })),
              },
            },
          });

          await tx.stockMovement.createMany({
            data: prepared.map((item) => ({
              variantId: item.variantId,
              purchaseOrderId: order.id,
              purchaseReturnId: created.id,
              type: 'PURCHASE_RETURN' as const,
              qty: -item.qty,
              unitCost: item.unitCost,
              note: body.note?.trim()
                ? `进货退货（${order.orderNo}）：${body.note.trim()}`
                : `进货退货（${order.orderNo}）`,
            })),
          });

          return {
            ok: true,
            returnNo: created.returnNo,
            totalQty,
            totalCost,
          };
        } catch (error) {
          if ((error as { code?: string })?.code === 'P2002') {
            continue;
          }

          throw error;
        }
      }

      throw new BadRequestException('退货单号生成失败，请重试');
    });
  }

  private async currentStockMap(variantIds: string[]) {
    const uniqueIds = Array.from(new Set(variantIds));
    if (uniqueIds.length === 0) {
      return new Map<string, number>();
    }

    const [variants, movements] = await Promise.all([
      this.prisma.variant.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true, qty: true },
      }),
      this.prisma.stockMovement.groupBy({
        by: ['variantId'],
        where: { variantId: { in: uniqueIds } },
        _sum: { qty: true },
      }),
    ]);

    const movementMap = new Map(
      movements.map((movement) => [movement.variantId, movement._sum.qty ?? 0]),
    );

    return new Map(
      variants.map((variant) => [
        variant.id,
        variant.qty + (movementMap.get(variant.id) ?? 0),
      ]),
    );
  }

  private resolveDateRange(start?: string, end?: string) {
    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;

    if (startDate && Number.isNaN(startDate.getTime())) {
      throw new BadRequestException('开始日期不正确');
    }
    if (endDate && Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('结束日期不正确');
    }
    if (endDate) {
      endDate.setHours(23, 59, 59, 999);
    }

    if (!startDate && !endDate) {
      return null;
    }

    return {
      ...(startDate ? { gte: startDate } : null),
      ...(endDate ? { lte: endDate } : null),
    };
  }
}
