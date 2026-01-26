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

@Controller('sizes')
export class SizesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Query('active') active?: string) {
    const activeOnly = active === 'true';
    return this.prisma.size.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { createdAt: 'asc' },
    });
  }

  @Post()
  async create(@Body() body: { name?: string }) {
    const name = body.name?.trim();
    if (!name) {
      throw new BadRequestException('尺码名称不能为空');
    }

    return this.prisma.size.create({
      data: { name, isActive: true },
    });
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; isActive?: boolean },
  ) {
    if (body.name !== undefined && !body.name.trim()) {
      throw new BadRequestException('尺码名称不能为空');
    }

    return this.prisma.size.update({
      where: { id },
      data: {
        name: body.name?.trim(),
        isActive: body.isActive,
      },
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.prisma.size.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
