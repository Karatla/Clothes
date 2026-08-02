import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PurchaseService, type PurchaseReturnInput } from './purchase.service';

@Controller('purchase')
export class PurchaseController {
  constructor(private readonly purchase: PurchaseService) {}

  @Get('orders')
  async listOrders(
    @Query('productId') productId?: string,
    @Query('keyword') keyword?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    return this.purchase.listOrders({ productId, keyword, start, end });
  }

  @Get('returns')
  async listReturns(
    @Query('purchaseOrderId') purchaseOrderId?: string,
    @Query('productId') productId?: string,
  ) {
    return this.purchase.listReturns({ purchaseOrderId, productId });
  }

  @Post('returns')
  async createReturn(@Body() body: PurchaseReturnInput) {
    return this.purchase.createReturn(body);
  }
}
