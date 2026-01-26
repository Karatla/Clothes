import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type MovementInput = {
  variantId?: string;
  type?: 'IN' | 'ADJUST';
  qty?: number;
  unitCost?: number | null;
  note?: string | null;
};

@Controller('stock')
export class StockController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('summary')
  async getSummary() {
    const [products, movements] = await Promise.all([
      this.prisma.product.findMany({
        include: { variants: true },
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

    return { products: summary, updatedAt: new Date().toISOString() };
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

    return this.prisma.stockMovement.create({
      data: {
        variantId,
        type,
        qty,
        unitCost: typeof body.unitCost === 'number' ? body.unitCost : null,
        note: body.note ?? null,
      },
    });
  }
}
