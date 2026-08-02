import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const COUNTER_KEY = 'variant';
/** 从 10000001 开始，8 位数字，扫不出来时也方便人工念/输入 */
const START_SEQ = 10000000;

@Injectable()
export class BarcodeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 取下一个条码。前缀来自系统设置 barcode.prefix，
   * 前缀只影响新生成的条码，已经贴出去的标签不受影响。
   */
  async nextBarcode(tx: Prisma.TransactionClient, prefix = '') {
    const counter = await tx.barcodeCounter.upsert({
      where: { key: COUNTER_KEY },
      update: { seq: { increment: 1 } },
      create: { key: COUNTER_KEY, seq: START_SEQ + 1 },
    });

    return `${prefix}${counter.seq}`;
  }

  /** 给一个还没有条码的规格发号，已有条码则原样返回 */
  async ensureBarcode(
    tx: Prisma.TransactionClient,
    variantId: string,
    prefix = '',
  ) {
    const variant = await tx.variant.findUnique({
      where: { id: variantId },
      select: { barcode: true },
    });

    if (variant?.barcode) {
      return variant.barcode;
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const barcode = await this.nextBarcode(tx, prefix);
      try {
        await tx.variant.update({
          where: { id: variantId },
          data: { barcode },
        });
        return barcode;
      } catch (error) {
        // 条码重复（比如手工填过同样的号）时换下一个
        if ((error as { code?: string })?.code === 'P2002') {
          continue;
        }
        throw error;
      }
    }

    throw new Error('条码生成失败，请重试');
  }
}
