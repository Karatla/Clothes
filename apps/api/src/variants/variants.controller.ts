import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BarcodeService } from './barcode.service';
import { SettingsService } from '../settings/settings.service';

type PriceInput = {
  salePrice?: number;
  costPrice?: number;
};

type BulkPriceInput = {
  /** 按商品批量改价 */
  productId?: string;
  /** 或者直接指定规格 */
  variantIds?: string[];
  /** 只改这些颜色（留空表示全部颜色） */
  colors?: string[];
  mode?: 'fixed' | 'costMarkup' | 'percent';
  /** fixed: 目标价；costMarkup: 加价百分比；percent: 在现价上涨跌百分比 */
  value?: number;
  /** 只改售价为 0 的规格 */
  onlyMissing?: boolean;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

@Controller('variants')
export class VariantsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly barcode: BarcodeService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * 扫码查询。扫码枪和摄像头扫出来的都是这里的条码，
   * 返回开单需要的全部信息：商品、颜色尺码、售价、当前库存。
   */
  @Get('by-barcode/:code')
  async findByBarcode(@Param('code') code: string) {
    const barcode = code?.trim();
    if (!barcode) {
      throw new BadRequestException('条码不能为空');
    }

    const variant = await this.prisma.variant.findUnique({
      where: { barcode },
      include: {
        product: {
          select: { id: true, name: true, baseCode: true, isDeleted: true },
        },
      },
    });

    if (!variant) {
      throw new NotFoundException(`没有找到条码 ${barcode} 对应的商品`);
    }

    if (variant.product?.isDeleted) {
      throw new BadRequestException(
        `${variant.product.name} 已被删除，无法销售`,
      );
    }

    const movements = await this.prisma.stockMovement.aggregate({
      where: { variantId: variant.id },
      _sum: { qty: true },
    });

    return {
      variantId: variant.id,
      productId: variant.productId,
      product: variant.product,
      color: variant.color,
      size: variant.size,
      sku: variant.sku,
      barcode: variant.barcode,
      salePrice: variant.salePrice,
      costPrice: variant.costPrice,
      currentQty: variant.qty + (movements._sum.qty ?? 0),
    };
  }

  /** 给还没有条码的规格补发条码，可按商品筛选。可重复调用 */
  @Post('ensure-barcodes')
  async ensureBarcodes(@Body() body: { productId?: string }) {
    const prefix = (await this.settings.get('barcode.prefix')).trim();
    const where: Prisma.VariantWhereInput = { barcode: null };
    if (body?.productId) {
      where.productId = body.productId;
    }

    const variants = await this.prisma.variant.findMany({
      where,
      select: { id: true },
    });

    let created = 0;
    for (const variant of variants) {
      await this.prisma.$transaction(async (tx) => {
        await this.barcode.ensureBarcode(tx, variant.id, prefix);
      });
      created += 1;
    }

    return { ok: true, count: created };
  }

  /** 售价缺失（为 0）的规格，用于首页提醒和扫码前检查 */
  @Get('missing-price')
  async listMissingPrice(@Query('productId') productId?: string) {
    const where: Prisma.VariantWhereInput = {
      salePrice: { lte: 0 },
      product: { isDeleted: false },
    };
    if (productId) {
      where.productId = productId;
    }

    const variants = await this.prisma.variant.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, baseCode: true } },
      },
      orderBy: [{ productId: 'asc' }, { color: 'asc' }],
    });

    return variants.map((variant) => ({
      id: variant.id,
      productId: variant.productId,
      product: variant.product,
      color: variant.color,
      size: variant.size,
      sku: variant.sku,
      costPrice: variant.costPrice,
      salePrice: variant.salePrice,
    }));
  }

  @Patch(':id')
  async updatePrice(@Param('id') id: string, @Body() body: PriceInput) {
    const data: Prisma.VariantUpdateInput = {};

    if (body.salePrice !== undefined) {
      if (typeof body.salePrice !== 'number' || !Number.isFinite(body.salePrice)) {
        throw new BadRequestException('售价必须是数字');
      }
      if (body.salePrice < 0) {
        throw new BadRequestException('售价不能小于 0');
      }
      data.salePrice = round2(body.salePrice);
    }

    if (body.costPrice !== undefined) {
      if (typeof body.costPrice !== 'number' || !Number.isFinite(body.costPrice)) {
        throw new BadRequestException('成本必须是数字');
      }
      if (body.costPrice < 0) {
        throw new BadRequestException('成本不能小于 0');
      }
      data.costPrice = round2(body.costPrice);
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('没有需要修改的内容');
    }

    const variant = await this.prisma.variant.findUnique({ where: { id } });
    if (!variant) {
      throw new BadRequestException('找不到对应的规格');
    }

    return this.prisma.variant.update({ where: { id }, data });
  }

  @Post('bulk-price')
  async bulkPrice(@Body() body: BulkPriceInput) {
    const mode = body.mode ?? 'fixed';
    const value = body.value;

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new BadRequestException('请输入有效的数值');
    }

    if (!['fixed', 'costMarkup', 'percent'].includes(mode)) {
      throw new BadRequestException('改价方式不正确');
    }

    if (mode === 'fixed' && value < 0) {
      throw new BadRequestException('售价不能小于 0');
    }

    const where: Prisma.VariantWhereInput = {};
    if (body.variantIds?.length) {
      where.id = { in: body.variantIds };
    } else if (body.productId) {
      where.productId = body.productId;
    } else {
      throw new BadRequestException('请选择要改价的商品或规格');
    }

    if (body.colors?.length) {
      where.color = { in: body.colors };
    }
    if (body.onlyMissing) {
      where.salePrice = { lte: 0 };
    }

    const variants = await this.prisma.variant.findMany({ where });
    if (variants.length === 0) {
      throw new BadRequestException('没有匹配的规格');
    }

    const updates = variants.map((variant) => {
      let nextPrice: number;
      if (mode === 'fixed') {
        nextPrice = value;
      } else if (mode === 'costMarkup') {
        nextPrice = variant.costPrice * (1 + value / 100);
      } else {
        nextPrice = variant.salePrice * (1 + value / 100);
      }
      return { id: variant.id, salePrice: Math.max(0, round2(nextPrice)) };
    });

    await this.prisma.$transaction(
      updates.map((item) =>
        this.prisma.variant.update({
          where: { id: item.id },
          data: { salePrice: item.salePrice },
        }),
      ),
    );

    return { ok: true, count: updates.length, updates };
  }
}
