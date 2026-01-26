import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_SIZES = ['S', 'M', 'L', 'XL', '2XL'];

@Injectable()
export class SizesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const count = await this.prisma.size.count();
    if (count > 0) {
      return;
    }

    await this.prisma.size.createMany({
      data: DEFAULT_SIZES.map((name) => ({ name, isActive: true })),
    });
  }
}
