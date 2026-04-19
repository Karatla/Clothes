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
import { PrismaService } from '../prisma/prisma.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureUniqueName(name: string, excludeId?: string) {
    const existing = await this.prisma.category.findFirst({
      where: {
        name,
        ...(excludeId ? { id: { not: excludeId } } : null),
      },
    });

    if (existing) {
      throw new BadRequestException('分类已存在，请勿重复添加');
    }
  }

  @Get()
  list(@Query('active') active?: string) {
    const activeOnly = active === 'true';
    return this.prisma.category.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  @Post()
  async create(@Body() body: { name?: string }) {
    const name = body.name?.trim();
    if (!name) {
      throw new BadRequestException('分类名称不能为空');
    }

    await this.ensureUniqueName(name);

    return this.prisma.category.create({
      data: {
        name,
        isActive: true,
      },
    });
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; isActive?: boolean },
  ) {
    const name = body.name?.trim();
    if (body.name !== undefined && !name) {
      throw new BadRequestException('分类名称不能为空');
    }

    if (name) {
      await this.ensureUniqueName(name, id);
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        name,
        isActive: body.isActive,
      },
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
