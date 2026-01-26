import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_CATEGORIES = [
  '上衣',
  '裤子',
  '外套',
  '连衣裙',
  '半身裙',
  '运动',
  '内衣',
  '配饰',
];

@Injectable()
export class CategoriesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const count = await this.prisma.category.count();
    if (count > 0) {
      return;
    }

    await this.prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((name) => ({ name, isActive: true })),
    });
  }
}
