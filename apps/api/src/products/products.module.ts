import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { VariantsModule } from '../variants/variants.module';
import { ProductsController } from './products.controller';

@Module({
  imports: [PrismaModule, SettingsModule, VariantsModule],
  controllers: [ProductsController],
})
export class ProductsModule {}
