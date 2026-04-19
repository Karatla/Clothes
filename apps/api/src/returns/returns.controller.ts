import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
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

type ReturnSearchType =
  | 'default'
  | 'productCode'
  | 'saleNo'
  | 'returnNo'
  | 'returnId';

@Controller('returns')
export class ReturnsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('minAmount') minAmount?: string,
    @Query('maxAmount') maxAmount?: string,
    @Query('searchType') searchType?: string,
    @Query('keyword') keyword?: string,
  ) {
    const where: Prisma.ReturnWhereInput = {};
    const returnedAt = this.resolveDateRange(start, end);
    if (returnedAt) {
      where.returnedAt = returnedAt;
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
        where.sale = {
          is: {
            saleNo: { contains: trimmedKeyword },
          },
        };
      } else if (normalizedType === 'returnNo') {
        where.returnNo = { contains: trimmedKeyword };
      } else if (normalizedType === 'returnId') {
        where.id = { contains: trimmedKeyword };
      }
    }

    const normalizedMinAmount = this.parseOptionalNumber(minAmount);
    const normalizedMaxAmount = this.parseOptionalNumber(maxAmount);
    if (normalizedMinAmount !== null || normalizedMaxAmount !== null) {
      where.totalAmount = {
        ...(normalizedMinAmount !== null ? { gte: normalizedMinAmount } : null),
        ...(normalizedMaxAmount !== null ? { lte: normalizedMaxAmount } : null),
      };
    }

    return this.prisma.return.findMany({
      where,
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
        include: {
          items: {
            include: {
              variant: { include: { product: true } },
            },
          },
          sale: true,
        },
      });
    });
  }

  private normalizeSearchType(searchType?: string): ReturnSearchType {
    if (searchType === 'productCode') return 'productCode';
    if (searchType === 'saleNo') return 'saleNo';
    if (searchType === 'returnNo') return 'returnNo';
    if (searchType === 'returnId') return 'returnId';
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

    const returnedAt: Prisma.DateTimeFilter = {};
    if (start) {
      returnedAt.gte = new Date(start);
    }
    if (end) {
      const endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
      returnedAt.lte = endDate;
    }
    return returnedAt;
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
