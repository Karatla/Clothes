import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
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

  @Get()
  list() {
    return this.prisma.product.findMany({
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: { variants: true },
    });
  }

  @Post()
  async create(@Body() body: ProductInput) {
    const name = body.name?.trim();
    const baseCode = body.baseCode?.trim();

    if (!name || !baseCode) {
      throw new BadRequestException('商品名称和基础编码不能为空');
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
}
