"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AppHeader from "@/app/components/app-header";
import { apiFetch, resolveImageUrl } from "@/lib/api";

type Variant = {
  id: string;
  color: string;
  size: string;
  qty: number;
  costPrice: number;
  salePrice: number;
  sku: string;
  currentQty?: number;
  totalCost?: number;
};

type Product = {
  id: string;
  name: string;
  baseCode: string;
  imageUrl: string | null;
  tags: string[];
  categoryId: string | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
  variants: Variant[];
};

type Category = {
  id: string;
  name: string;
};

type SummaryResponse = {
  products: Array<{
    id: string;
    totalQty: number;
    totalCost: number;
    variants: Array<{ id: string; currentQty: number; totalCost: number }>;
  }>;
};

type Movement = {
  id: string;
  type: "IN" | "OUT" | "RETURN" | "ADJUST";
  qty: number;
  note: string | null;
  createdAt: string;
  product?: { id: string } | null;
  variant?: { color: string; size: string } | null;
};

const movementLabels: Record<Movement["type"], string> = {
  IN: "入库",
  OUT: "出库",
  RETURN: "退货",
  ADJUST: "调整",
};

export default function ProductDetailPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiFetch<Product>(`/products/${id}`),
      apiFetch<Category[]>("/categories"),
      apiFetch<SummaryResponse>("/stock/summary"),
      apiFetch<Movement[]>("/stock/movements"),
    ])
      .then(([productData, categoryData, summaryData, movementData]) => {
        setProduct(productData);
        setCategories(categoryData);
        setSummary(summaryData);
        setMovements(movementData);
      })
      .catch(() => null);
  }, [id]);

  const handleDelete = async () => {
    if (!product) return;
    const confirmed = window.confirm("确认删除该商品？删除后可在此页面恢复。");
    if (!confirmed) return;
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/products/${product.id}`, { method: "DELETE" });
      setProduct({ ...product, isDeleted: true });
      setMessage("商品已删除");
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  };

  const handleRestore = async () => {
    if (!product) return;
    const confirmed = window.confirm("确认恢复该商品？");
    if (!confirmed) return;
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isDeleted: false }),
      });
      setProduct({ ...product, isDeleted: false });
      setMessage("商品已恢复");
    } catch (err) {
      setError(err instanceof Error ? err.message : "恢复失败");
    }
  };

  const categoryName = useMemo(() => {
    if (!product?.categoryId) return "-";
    return categories.find((item) => item.id === product.categoryId)?.name ?? "-";
  }, [product, categories]);

  const enrichedVariants = useMemo(() => {
    if (!product) return [];
    const productSummary = summary?.products.find((item) => item.id === product.id);
    return product.variants.map((variant) => {
      const summaryVariant = productSummary?.variants.find(
        (item) => item.id === variant.id,
      );
      return {
        ...variant,
        currentQty: summaryVariant?.currentQty ?? variant.qty,
        totalCost: summaryVariant?.totalCost ?? variant.qty * variant.costPrice,
      };
    });
  }, [product, summary]);

  const totals = useMemo(() => {
    return enrichedVariants.reduce(
      (acc, variant) => {
        acc.qty += variant.currentQty ?? 0;
        acc.cost += variant.totalCost ?? 0;
        return acc;
      },
      { qty: 0, cost: 0 },
    );
  }, [enrichedVariants]);

  const productMovements = useMemo(() => {
    if (!product) return [];
    return movements
      .filter((movement) => movement.product?.id === product.id)
      .slice(0, 20)
      .map((movement) => ({
        ...movement,
        dateLabel: new Date(movement.createdAt).toLocaleString("zh-CN"),
      }));
  }, [movements, product]);

  if (!product) {
    return (
      <div className="min-h-screen px-6 py-12">
        <div className="mx-auto max-w-5xl rounded-3xl bg-white/90 p-8 text-sm text-[#6b645a]">
          正在加载商品详情...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <AppHeader
          label="商品详情"
          title={`${product.name}`}
          description={`商品编码 ${product.baseCode}`}
        />

        <div className="flex flex-wrap items-center justify-between gap-4">
          {product.isDeleted ? (
            <span className="rounded-full border border-[#f0c7b3] bg-[#fff1ea] px-3 py-1 text-xs text-[#b14d2a]">
              已删除
            </span>
          ) : (
            <span className="rounded-full border border-[#c9e2c8] bg-[#f1fff1] px-3 py-1 text-xs text-[#386641]">
              正常
            </span>
          )}
          <div className="flex gap-2">
            {product.isDeleted ? (
              <button
                type="button"
                onClick={handleRestore}
                className="rounded-2xl border border-[#e4d7c5] px-4 py-2 text-sm text-[#6b645a]"
              >
                恢复商品
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-2xl border border-[#f0c7b3] px-4 py-2 text-sm text-[#b14d2a]"
              >
                删除商品
              </button>
            )}
          </div>
        </div>

        {product.deletedAt ? (
          <div className="text-xs text-[#6b645a]">
            删除时间：{new Date(product.deletedAt).toLocaleString("zh-CN")}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-[#f0c7b3] bg-[#fff1ea] px-4 py-3 text-sm text-[#b14d2a]">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="rounded-2xl border border-[#c9e2c8] bg-[#f1fff1] px-4 py-3 text-sm text-[#386641]">
            {message}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl bg-white/90 p-6 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
            {resolveImageUrl(product.imageUrl) ? (
              <img
                src={resolveImageUrl(product.imageUrl) ?? ""}
                alt={product.name}
                className="h-64 w-full rounded-3xl bg-[#f5efe6] object-contain"
              />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-3xl bg-[#eadfce] text-sm text-[#6b645a]">
                暂无图片
              </div>
            )}
          </div>
          <div className="rounded-3xl bg-white/90 p-6 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
            <div className="grid gap-4 text-sm text-[#6b645a]">
              <div>分类：{categoryName}</div>
              <div>标签：{product.tags?.length ? product.tags.join("，") : "-"}</div>
              <div>总库存：{totals.qty}</div>
              <div>总成本：¥{totals.cost.toFixed(2)}</div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white/90 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr] bg-[#f5efe6] px-6 py-3 text-sm font-semibold text-[#5c544b]">
            <div>颜色</div>
            <div>尺码</div>
            <div>SKU</div>
            <div>库存</div>
            <div>成本价</div>
            <div>售价</div>
          </div>
          {enrichedVariants.map((variant) => (
            <div
              key={variant.id}
              className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr] border-t border-[#eadfce] px-6 py-3 text-sm text-[#6b645a]"
            >
              <div>{variant.color}</div>
              <div>{variant.size}</div>
              <div>{variant.sku}</div>
              <div>{variant.currentQty}</div>
              <div>¥{variant.costPrice.toFixed(2)}</div>
              <div>¥{variant.salePrice.toFixed(2)}</div>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-3xl bg-white/90 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
          <div className="px-6 py-4 text-base font-semibold text-[#1f1811]">
            最近库存流水
          </div>
          <div className="grid grid-cols-[1.2fr_1fr_1fr_0.8fr_1.2fr] bg-[#f5efe6] px-6 py-3 text-sm font-semibold text-[#5c544b]">
            <div>时间</div>
            <div>类型</div>
            <div>颜色/尺码</div>
            <div>数量</div>
            <div>备注</div>
          </div>
          {productMovements.length ? (
            productMovements.map((movement) => (
              <div
                key={movement.id}
                className="grid grid-cols-[1.2fr_1fr_1fr_0.8fr_1.2fr] border-t border-[#eadfce] px-6 py-3 text-sm text-[#6b645a]"
              >
                <div>{movement.dateLabel}</div>
                <div>{movementLabels[movement.type]}</div>
                <div>
                  {movement.variant
                    ? `${movement.variant.color} / ${movement.variant.size}`
                    : "-"}
                </div>
                <div>{movement.qty}</div>
                <div>{movement.note ?? "-"}</div>
              </div>
            ))
          ) : (
            <div className="px-6 py-10 text-center text-sm text-[#6b645a]">
              暂无库存流水
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
