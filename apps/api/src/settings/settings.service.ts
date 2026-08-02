import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 系统设置采用 key-value 存储，以后新增设置项只要在这里加一条默认值，
 * 不需要再做数据库迁移。
 */
export const SETTING_DEFAULTS: Record<string, string> = {
  // 店铺信息（打印在小票上）
  'shop.name': '我的服装店',
  'shop.phone': '',
  'shop.address': '',
  'shop.footer': '感谢惠顾，凭小票 7 天内可退换',

  // 小票
  'receipt.width': '80', // 58 | 80 | a4
  'receipt.showQr': 'true', // 底部打印订单二维码
  'receipt.showCost': 'false', // 是否打印成本（给客人的小票不要开）
  'receipt.copies': '1',

  // 标签
  'label.size': '40x30', // 40x30 | 50x30 | 60x40 | a4
  'label.showPrice': 'true',
  'label.showShopName': 'false',

  // 条码
  'barcode.prefix': '',
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.setting.findMany();
    const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    return { ...SETTING_DEFAULTS, ...stored };
  }

  async get(key: string): Promise<string> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return row?.value ?? SETTING_DEFAULTS[key] ?? '';
  }

  /** 只保存我们认识的 key，未知 key 直接忽略 */
  async update(values: Record<string, unknown>) {
    const entries = Object.entries(values).filter(([key]) =>
      Object.prototype.hasOwnProperty.call(SETTING_DEFAULTS, key),
    );

    for (const [key, rawValue] of entries) {
      const value =
        typeof rawValue === 'string' ? rawValue : String(rawValue ?? '');
      await this.prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    return this.getAll();
  }

  async reset() {
    await this.prisma.setting.deleteMany();
    return this.getAll();
  }
}
