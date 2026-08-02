import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { VariantsController } from './variants.controller';
import { BarcodeService } from './barcode.service';

@Module({
  imports: [PrismaModule, SettingsModule],
  controllers: [VariantsController],
  providers: [BarcodeService],
  exports: [BarcodeService],
})
export class VariantsModule {}
