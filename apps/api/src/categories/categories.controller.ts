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

  @Get()
  list(@Query('active') active?: string) {
    const activeOnly = active === 'true';
    return this.prisma.category.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { createdAt: 'asc' },
    });
  }

  @Post()
  async create(@Body() body: { name?: string }) {
    const name = body.name?.trim();
    if (!name) {
      throw new BadRequestException('分类名称不能为空');
    }

    return this.prisma.category.create({
      data: {
        name,
        isActive: true,
      },
    });
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; isActive?: boolean },
  ) {
    if (body.name !== undefined && !body.name.trim()) {
      throw new BadRequestException('分类名称不能为空');
    }
    return this.prisma.category.update({
      where: { id },
      data: {
        name: body.name?.trim(),
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
