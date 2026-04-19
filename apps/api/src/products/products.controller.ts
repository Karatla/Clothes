import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type ProductInput = {
  name?: string;
  baseCode?: string;
  categoryId?: string | null;
  tags?: string[];
  imageUrl?: string | null;
  variants?: Array<{
    color?: string;
    size?: string;
    qty?: number;
    costPrice?: number;
    salePrice?: number;
    sku?: string;
  }>;
};

@Controller('products')
export class ProductsController {
  constructor(private readonly prisma: PrismaService) {}

  private async withCurrentQty<T extends { variants: Array<{ id: string; qty: number }> }>(
    products: T[],
  ) {
    const variantIds = products.flatMap((product) =>
      product.variants.map((variant) => variant.id),
    );

    if (variantIds.length === 0) {
      return products.map((product) => ({
        ...product,
        variants: product.variants.map((variant) => ({
          ...variant,
          currentQty: variant.qty,
        })),
      }));
    }

    const movementTotals = await this.prisma.stockMovement.groupBy({
      by: ['variantId'],
      where: { variantId: { in: variantIds } },
      _sum: { qty: true },
    });

    const movementMap = new Map(
      movementTotals.map((movement) => [
        movement.variantId,
        movement._sum.qty ?? 0,
      ]),
    );

    return products.map((product) => ({
      ...product,
      variants: product.variants.map((variant) => ({
        ...variant,
        currentQty: variant.qty + (movementMap.get(variant.id) ?? 0),
      })),
    }));
  }

  @Get()
  async list(
    @Query('deleted') deleted?: string,
    @Query('keyword') keyword?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const includeDeleted = deleted === 'all';
    const deletedOnly = deleted === 'true';
    const trimmedKeyword = keyword?.trim();
    const hasKeyword = Boolean(trimmedKeyword);
    const where: Prisma.ProductWhereInput | undefined = includeDeleted
      ? undefined
      : {
          isDeleted: deletedOnly,
        };

    if (where && hasKeyword && trimmedKeyword) {
      where.OR = [
        { name: { contains: trimmedKeyword } },
        { baseCode: { contains: trimmedKeyword } },
      ];
    }

    if (where && deletedOnly && (start || end)) {
      const startDate = start ? new Date(start) : undefined;
      const endDate = end ? new Date(end) : undefined;
      if (endDate) {
        endDate.setHours(23, 59, 59, 999);
      }
      where.deletedAt = {
        ...(startDate ? { gte: startDate } : null),
        ...(endDate ? { lte: endDate } : null),
      };
    }
    const products = await this.prisma.product.findMany({
      where,
      include: { variants: true },
      orderBy: deletedOnly ? { deletedAt: 'desc' } : { createdAt: 'desc' },
    });

    return this.withCurrentQty(products);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { variants: true },
    });

    if (!product) {
      return null;
    }

    const [result] = await this.withCurrentQty([product]);
    return result;
  }

  @Post()
  async create(@Body() body: ProductInput) {
    const name = body.name?.trim();
    const baseCode = body.baseCode?.trim();

    if (!name || !baseCode) {
      throw new BadRequestException('商品名称和基础编码不能为空');
    }

    const existing = await this.prisma.product.findFirst({
      where: { baseCode },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException('款号已存在，请勿重复录入');
    }

    const variants = (body.variants ?? []).filter(
      (variant) =>
        variant.color &&
        variant.size &&
        typeof variant.qty === 'number' &&
        typeof variant.costPrice === 'number' &&
        typeof variant.salePrice === 'number' &&
        variant.sku,
    );

    if (variants.length === 0) {
      throw new BadRequestException('请至少填写一个尺码库存');
    }

    return this.prisma.product.create({
      data: {
        name,
        baseCode,
        categoryId: body.categoryId ?? null,
        tags: body.tags ?? [],
        imageUrl: body.imageUrl ?? null,
        isDeleted: false,
        deletedAt: null,
        variants: {
          create: variants.map((variant) => ({
            color: variant.color ?? '',
            size: variant.size ?? '',
            qty: variant.qty ?? 0,
            costPrice: variant.costPrice ?? 0,
            salePrice: variant.salePrice ?? 0,
            sku: variant.sku ?? '',
          })),
        },
      },
      include: { variants: true },
    });
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { isDeleted?: boolean },
  ) {
    const shouldDelete = body.isDeleted === true;
    const shouldRestore = body.isDeleted === false;
    return this.prisma.product.update({
      where: { id },
      data: {
        isDeleted: body.isDeleted,
        deletedAt: shouldDelete
          ? new Date()
          : shouldRestore
            ? null
            : undefined,
      },
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.prisma.product.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }
}
