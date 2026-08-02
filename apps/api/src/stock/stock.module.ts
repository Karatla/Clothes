import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PurchaseModule } from '../purchase/purchase.module';
import { VariantsModule } from '../variants/variants.module';
import { SettingsModule } from '../settings/settings.module';
import { StockController } from './stock.controller';

@Module({
  imports: [PrismaModule, PurchaseModule, VariantsModule, SettingsModule],
  controllers: [StockController],
})
export class StockModule {}
