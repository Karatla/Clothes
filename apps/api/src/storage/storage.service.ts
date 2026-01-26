import { Injectable, OnModuleInit } from '@nestjs/common';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  Category,
  Product,
  StockMovement,
  StoreData,
  Variant,
} from './storage.types';

const DEFAULT_CATEGORIES = [
  '上衣',
  '裤子',
  '外套',
  '连衣裙',
  '半身裙',
  '运动',
  '内衣',
  '配饰',
];

@Injectable()
export class StorageService implements OnModuleInit {
  private data: StoreData = {
    categories: [],
    products: [],
    variants: [],
    movements: [],
  };

  private readonly storePath = path.join(
    process.cwd(),
    'data',
    'db.json',
  );

  async onModuleInit() {
    await this.ensureStore();
    await this.seedCategories();
  }

  private async ensureStore() {
    await fs.mkdir(path.dirname(this.storePath), { recursive: true });

    try {
      const raw = await fs.readFile(this.storePath, 'utf-8');
      this.data = JSON.parse(raw) as StoreData;
      this.data.movements ??= [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }

      await this.persist();
    }
  }

  private async persist() {
    await fs.writeFile(this.storePath, JSON.stringify(this.data, null, 2));
  }

  private async seedCategories() {
    if (this.data.categories.length > 0) {
      return;
    }

    const now = new Date().toISOString();
    this.data.categories = DEFAULT_CATEGORIES.map((name) => ({
      id: randomUUID(),
      name,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }));

    await this.persist();
  }

  async listCategories({ activeOnly }: { activeOnly: boolean }) {
    return this.data.categories.filter((category) =>
      activeOnly ? category.isActive : true,
    );
  }

  async addCategory(name: string) {
    const now = new Date().toISOString();
    const category: Category = {
      id: randomUUID(),
      name,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    this.data.categories.push(category);
    await this.persist();
    return category;
  }

  async updateCategory(id: string, updates: Partial<Pick<Category, 'name' | 'isActive'>>) {
    const category = this.data.categories.find((item) => item.id === id);
    if (!category) {
      return null;
    }

    if (typeof updates.name === 'string') {
      category.name = updates.name.trim();
    }
    if (typeof updates.isActive === 'boolean') {
      category.isActive = updates.isActive;
    }

    category.updatedAt = new Date().toISOString();
    await this.persist();
    return category;
  }

  async deleteCategory(id: string) {
    const category = this.data.categories.find((item) => item.id === id);
    if (!category) {
      return null;
    }

    category.isActive = false;
    category.updatedAt = new Date().toISOString();
    await this.persist();
    return category;
  }

  async createProduct(input: {
    name: string;
    baseCode: string;
    categoryId: string | null;
    tags: string[];
    imageUrl: string | null;
    variants: Array<{
      color: string;
      size: string;
      qty: number;
      costPrice: number;
      salePrice: number;
      sku: string;
    }>;
  }) {
    const now = new Date().toISOString();
    const product: Product = {
      id: randomUUID(),
      name: input.name.trim(),
      baseCode: input.baseCode.trim(),
      categoryId: input.categoryId,
      tags: input.tags,
      imageUrl: input.imageUrl,
      createdAt: now,
      updatedAt: now,
    };

    const variants: Variant[] = input.variants.map((variant) => ({
      id: randomUUID(),
      productId: product.id,
      color: variant.color.trim(),
      size: variant.size,
      qty: variant.qty,
      costPrice: variant.costPrice,
      salePrice: variant.salePrice,
      sku: variant.sku,
    }));

    this.data.products.unshift(product);
    this.data.variants.unshift(...variants);
    await this.persist();

    return { product, variants };
  }

  async listProducts() {
    return this.data.products.map((product) => ({
      ...product,
      variants: this.data.variants.filter(
        (variant) => variant.productId === product.id,
      ),
    }));
  }

  async getProduct(id: string) {
    const product = this.data.products.find((item) => item.id === id);
    if (!product) {
      return null;
    }

    return {
      ...product,
      variants: this.data.variants.filter(
        (variant) => variant.productId === product.id,
      ),
    };
  }

  async createMovement(input: {
    variantId: string;
    type: StockMovement['type'];
    qty: number;
    unitCost: number | null;
    note: string | null;
  }) {
    const variant = this.data.variants.find(
      (item) => item.id === input.variantId,
    );
    if (!variant) {
      return null;
    }

    const movement: StockMovement = {
      id: randomUUID(),
      variantId: input.variantId,
      type: input.type,
      qty: input.qty,
      unitCost: input.unitCost,
      note: input.note,
      createdAt: new Date().toISOString(),
    };

    this.data.movements.unshift(movement);
    await this.persist();
    return movement;
  }

  async listMovements() {
    return this.data.movements.map((movement) => {
      const variant = this.data.variants.find(
        (item) => item.id === movement.variantId,
      );
      const product = variant
        ? this.data.products.find((item) => item.id === variant.productId)
        : null;

      return {
        ...movement,
        product,
        variant,
      };
    });
  }

  async getStockSummary() {
    const movementTotals = this.data.movements.reduce(
      (acc, movement) => {
        acc[movement.variantId] =
          (acc[movement.variantId] ?? 0) + movement.qty;
        return acc;
      },
      {} as Record<string, number>,
    );

    const products = this.data.products.map((product) => {
      const variants = this.data.variants
        .filter((variant) => variant.productId === product.id)
        .map((variant) => {
          const delta = movementTotals[variant.id] ?? 0;
          const currentQty = variant.qty + delta;
          const totalCost = currentQty * variant.costPrice;

          return {
            ...variant,
            currentQty,
            totalCost,
          };
        });

      const totalQty = variants.reduce(
        (sum, variant) => sum + variant.currentQty,
        0,
      );
      const totalCost = variants.reduce(
        (sum, variant) => sum + variant.totalCost,
        0,
      );

      return {
        ...product,
        totalQty,
        totalCost,
        variants,
      };
    });

    return { products, updatedAt: new Date().toISOString() };
  }
}
