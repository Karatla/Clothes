"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AppHeader from "@/app/components/app-header";
import { apiFetch, resolveImageUrl, uploadFile } from "@/lib/api";

type Variant = {
  id: string;
  color: string;
  size: string;
  qty: number;
  costPrice: number;
  salePrice: number;
  sku: string;
  barcode?: string | null;
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
  const [uploadingImage, setUploadingImage] = useState(false);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [savingPrice, setSavingPrice] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState<"fixed" | "costMarkup" | "percent">(
    "fixed",
  );
  const [bulkValue, setBulkValue] = useState("");
  const [bulkOnlyMissing, setBulkOnlyMissing] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);

  const loadProduct = async (productId: string) => {
    const data = await apiFetch<Product>(`/products/${productId}`);
    setProduct(data);
    setPriceDrafts({});
    return data;
  };

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

  const handleSavePrice = async (variantId: string) => {
    const raw = priceDrafts[variantId];
    if (raw === undefined || raw.trim() === "") return;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      setError("请输入有效的售价");
      return;
    }

    setError(null);
    setMessage(null);
    setSavingPrice(variantId);
    try {
      await apiFetch(`/variants/${variantId}`, {
        method: "PATCH",
        body: JSON.stringify({ salePrice: value }),
      });
      if (id) await loadProduct(id);
      setMessage("售价已更新");
    } catch (err) {
      setError(err instanceof Error ? err.message : "售价更新失败");
    } finally {
      setSavingPrice(null);
    }
  };

  const handleBulkPrice = async () => {
    if (!product) return;
    const value = Number(bulkValue);
    if (!Number.isFinite(value) || bulkValue.trim() === "") {
      setError("请输入数值");
      return;
    }

    const label =
      bulkMode === "fixed"
        ? `把售价统一设为 ¥${value}`
        : bulkMode === "costMarkup"
          ? `按成本加价 ${value}% 重新计算售价`
          : `在现价基础上调整 ${value}%`;
    if (
      !window.confirm(
        `确认${label}？${bulkOnlyMissing ? "（只改售价为 0 的规格）" : "（该商品全部规格）"}`,
      )
    ) {
      return;
    }

    setError(null);
    setMessage(null);
    setBulkSaving(true);
    try {
      const result = await apiFetch<{ count: number }>("/variants/bulk-price", {
        method: "POST",
        body: JSON.stringify({
          productId: product.id,
          mode: bulkMode,
          value,
          onlyMissing: bulkOnlyMissing,
        }),
      });
      await loadProduct(product.id);
      setBulkValue("");
      setMessage(`已更新 ${result.count} 个规格的售价`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "批量改价失败");
    } finally {
      setBulkSaving(false);
    }
  };

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

  const handleImageChange = async (file: File | null) => {
    if (!product || !file) return;
    setError(null);
    setMessage(null);
    setUploadingImage(true);

    try {
      const { url } = await uploadFile(file);
      await apiFetch(`/products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({ imageUrl: url }),
      });
      setProduct({ ...product, imageUrl: url });
      setMessage("商品图片已更新");
    } catch (err) {
      setError(err instanceof Error ? err.message : "图片更新失败");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!product) return;
    setError(null);
    setMessage(null);

    try {
      await apiFetch(`/products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({ imageUrl: null }),
      });
      setProduct({ ...product, imageUrl: null });
      setMessage("商品图片已移除");
    } catch (err) {
      setError(err instanceof Error ? err.message : "图片移除失败");
    }
  };

  const categoryName = useMemo(() => {
    if (!product?.categoryId) return "-";
    return categories.find((item) => item.id === product.categoryId)?.name ?? "-";
  }, [product, categories]);

  const missingPriceCount = useMemo(
    () => (product?.variants ?? []).filter((v) => v.salePrice <= 0).length,
    [product],
  );

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
              <div className="space-y-4">
                <img
                  src={resolveImageUrl(product.imageUrl) ?? ""}
                  alt={product.name}
                  className="h-64 w-full rounded-3xl bg-[#f5efe6] object-contain"
                />
                <div className="flex flex-wrap gap-3">
                  <label className="rounded-2xl bg-[#a7652d] px-4 py-2 text-sm font-semibold text-white">
                    {uploadingImage ? "上传中..." : "更换图片"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingImage}
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        void handleImageChange(file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleRemoveImage()}
                    className="rounded-2xl border border-[#e4d7c5] px-4 py-2 text-sm text-[#6b645a]"
                  >
                    移除图片
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex h-64 items-center justify-center rounded-3xl bg-[#eadfce] text-sm text-[#6b645a]">
                  暂无图片
                </div>
                <label className="inline-flex rounded-2xl bg-[#a7652d] px-4 py-2 text-sm font-semibold text-white">
                  {uploadingImage ? "上传中..." : "上传图片"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingImage}
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      void handleImageChange(file);
                      event.target.value = "";
                    }}
                  />
                </label>
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

        <section className="rounded-3xl bg-white/90 p-6 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-[#1f1811]">批量改价</p>
              <p className="mt-1 text-sm text-[#6b645a]">
                一次修改该商品所有规格的售价。
              </p>
            </div>
            <a
              href={`/labels/print?productId=${product.id}`}
              className="rounded-2xl bg-[#a7652d] px-5 py-2 text-sm font-semibold text-white"
            >
              打印标签
            </a>
            {missingPriceCount > 0 ? (
              <div className="rounded-2xl border border-[#f0c7b3] bg-[#fff1ea] px-4 py-2 text-sm text-[#b14d2a]">
                有 {missingPriceCount} 个规格未设置售价，无法销售
              </div>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[1.2fr_1fr_auto]">
            <label className="space-y-2 text-sm text-[#6b645a]">
              改价方式
              <select
                value={bulkMode}
                onChange={(event) =>
                  setBulkMode(event.target.value as typeof bulkMode)
                }
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
              >
                <option value="fixed">统一设为固定售价</option>
                <option value="costMarkup">按成本加价（%）</option>
                <option value="percent">在现价上涨跌（%）</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-[#6b645a]">
              {bulkMode === "fixed" ? "售价（元）" : "百分比（%）"}
              <input
                value={bulkValue}
                onChange={(event) => setBulkValue(event.target.value)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
                placeholder={bulkMode === "fixed" ? "如：199" : "如：50"}
              />
            </label>
            <button
              type="button"
              onClick={handleBulkPrice}
              disabled={bulkSaving}
              className="self-end rounded-2xl bg-[#1f1811] px-6 py-3 text-sm font-semibold text-white disabled:bg-[#bdb5a8]"
            >
              {bulkSaving ? "处理中..." : "应用"}
            </button>
          </div>

          <label className="mt-4 flex items-center gap-3 text-sm text-[#6b645a]">
            <input
              type="checkbox"
              checked={bulkOnlyMissing}
              onChange={(event) => setBulkOnlyMissing(event.target.checked)}
            />
            只修改售价为 0 的规格
          </label>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white/90 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
          <div className="grid grid-cols-[1fr_1fr_1.4fr_0.8fr_1fr_1.6fr] bg-[#f5efe6] px-6 py-3 text-sm font-semibold text-[#5c544b]">
            <div>颜色</div>
            <div>尺码</div>
            <div>SKU</div>
            <div>库存</div>
            <div>成本价</div>
            <div>售价</div>
          </div>
          {enrichedVariants.map((variant) => {
            const draft = priceDrafts[variant.id];
            const current = variant.salePrice.toFixed(2);
            const dirty = draft !== undefined && draft !== current;
            return (
              <div
                key={variant.id}
                className={`grid grid-cols-[1fr_1fr_1.4fr_0.8fr_1fr_1.6fr] items-center border-t border-[#eadfce] px-6 py-3 text-sm text-[#6b645a] ${
                  variant.salePrice <= 0 ? "bg-[#fff1ea]" : ""
                }`}
              >
                <div>{variant.color}</div>
                <div>{variant.size}</div>
                <div className="truncate">
                  {variant.sku}
                  <div className="text-xs text-[#8a8073]">
                    {variant.barcode ?? "条码未生成"}
                  </div>
                </div>
                <div>{variant.currentQty}</div>
                <div>¥{variant.costPrice.toFixed(2)}</div>
                <div className="flex items-center gap-2">
                  <input
                    value={draft ?? current}
                    onChange={(event) =>
                      setPriceDrafts((prev) => ({
                        ...prev,
                        [variant.id]: event.target.value,
                      }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void handleSavePrice(variant.id);
                    }}
                    className={`w-24 rounded-xl border px-2 py-1 text-sm ${
                      variant.salePrice <= 0
                        ? "border-[#d96b48]"
                        : "border-[#e4d7c5]"
                    }`}
                  />
                  {dirty ? (
                    <button
                      type="button"
                      onClick={() => void handleSavePrice(variant.id)}
                      disabled={savingPrice === variant.id}
                      className="rounded-xl bg-[#1f1811] px-3 py-1 text-xs font-semibold text-white"
                    >
                      {savingPrice === variant.id ? "..." : "保存"}
                    </button>
                  ) : null}
                  {variant.salePrice <= 0 ? (
                    <span className="text-xs text-[#b14d2a]">未设置</span>
                  ) : null}
                </div>
              </div>
            );
          })}
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
