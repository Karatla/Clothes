import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReturnsController } from './returns.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ReturnsController],
})
export class ReturnsModule {}
