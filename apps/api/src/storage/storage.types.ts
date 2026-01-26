export type Category = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  name: string;
  baseCode: string;
  categoryId: string | null;
  tags: string[];
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Variant = {
  id: string;
  productId: string;
  color: string;
  size: string;
  qty: number;
  costPrice: number;
  salePrice: number;
  sku: string;
};

export type StockMovement = {
  id: string;
  variantId: string;
  type: 'IN' | 'OUT' | 'RETURN' | 'ADJUST';
  qty: number;
  unitCost: number | null;
  note: string | null;
  createdAt: string;
};

export type StoreData = {
  categories: Category[];
  products: Product[];
  variants: Variant[];
  movements: StockMovement[];
};
