import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SizesController } from './sizes.controller';
import { SizesService } from './sizes.service';

@Module({
  imports: [PrismaModule],
  controllers: [SizesController],
  providers: [SizesService],
})
export class SizesModule {}
