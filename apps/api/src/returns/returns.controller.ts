import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type ReturnItemInput = {
  variantId?: string;
  qty?: number;
  unitPrice?: number;
};

type ReturnInput = {
  saleId?: string;
  returnedAt?: string;
  note?: string | null;
  items?: ReturnItemInput[];
};

@Controller('returns')
export class ReturnsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.return.findMany({
      include: {
        sale: true,
        items: {
          include: {
            variant: { include: { product: true } },
          },
        },
      },
      orderBy: { returnedAt: 'desc' },
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.prisma.return.findUnique({
      where: { id },
      include: {
        sale: true,
        items: {
          include: {
            variant: { include: { product: true } },
          },
        },
      },
    });
  }

  @Post()
  async create(@Body() body: ReturnInput) {
    const saleId = body.saleId;
    if (!saleId) {
      throw new BadRequestException('请选择销售记录');
    }

    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true },
    });

    if (!sale) {
      throw new BadRequestException('找不到销售记录');
    }

    const items = body.items ?? [];
    if (items.length === 0) {
      throw new BadRequestException('请添加退货明细');
    }

    const normalizedItems = items.map((item) => ({
      variantId: item.variantId ?? '',
      qty: Number(item.qty ?? 0),
      unitPrice: Number(item.unitPrice ?? 0),
    }));

    if (normalizedItems.some((item) => !item.variantId)) {
      throw new BadRequestException('请选择退货商品');
    }

    if (normalizedItems.some((item) => item.qty <= 0)) {
      throw new BadRequestException('退货数量必须大于 0');
    }

    if (normalizedItems.some((item) => item.unitPrice <= 0)) {
      throw new BadRequestException('退款单价必须大于 0');
    }

    const existingReturns = await this.prisma.returnItem.findMany({
      where: { return: { saleId } },
    });

    const returnedTotals = existingReturns.reduce(
      (acc, item) => {
        acc[item.variantId] = (acc[item.variantId] ?? 0) + item.qty;
        return acc;
      },
      {} as Record<string, number>,
    );

    const soldTotals = sale.items.reduce(
      (acc, item) => {
        acc[item.variantId] = (acc[item.variantId] ?? 0) + item.qty;
        return acc;
      },
      {} as Record<string, number>,
    );

    for (const item of normalizedItems) {
      const sold = soldTotals[item.variantId] ?? 0;
      const returned = returnedTotals[item.variantId] ?? 0;
      const remaining = sold - returned;
      if (item.qty > remaining) {
        throw new BadRequestException('退货数量超过可退数量');
      }
    }

    const returnedAt = body.returnedAt ? new Date(body.returnedAt) : new Date();
    const returnNo = await this.createReturnNo(returnedAt);
    const totalAmount = normalizedItems.reduce(
      (sum, item) => sum + item.qty * item.unitPrice,
      0,
    );

    return this.prisma.$transaction(async (tx) => {
      const ret = await tx.return.create({
        data: {
          saleId: sale.id,
          returnNo,
          returnedAt,
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
          returnId: ret.id,
          type: 'RETURN',
          qty: item.qty,
          unitCost: null,
          note: '退货入库',
        })),
      });

      return tx.return.findUnique({
        where: { id: ret.id },
        include: { items: true, sale: true },
      });
    });
  }

  private async createReturnNo(returnedAt: Date) {
    const year = returnedAt.getFullYear();
    const month = `${returnedAt.getMonth() + 1}`.padStart(2, '0');
    const day = `${returnedAt.getDate()}`.padStart(2, '0');
    const start = new Date(year, returnedAt.getMonth(), returnedAt.getDate());
    const end = new Date(year, returnedAt.getMonth(), returnedAt.getDate() + 1);

    const count = await this.prisma.return.count({
      where: {
        returnedAt: {
          gte: start,
          lt: end,
        },
      },
    });

    const seq = `${count + 1}`.padStart(4, '0');
    return `R${year}${month}${day}-${seq}`;
  }
}
