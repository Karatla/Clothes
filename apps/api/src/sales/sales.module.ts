import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SalesController } from './sales.controller';

@Module({
  imports: [PrismaModule],
  controllers: [SalesController],
})
export class SalesModule {}
