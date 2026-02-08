"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/app/components/app-header";
import { apiFetch, resolveImageUrl } from "@/lib/api";

type VariantSummary = {
  id: string;
  color: string;
  size: string;
  currentQty: number;
  costPrice: number;
  totalCost: number;
};

type ProductSummary = {
  id: string;
  name: string;
  baseCode: string;
  imageUrl?: string | null;
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
  totalQty: number;
  totalCost: number;
  variants: VariantSummary[];
};

type SummaryTotals = {
  totalQty: number;
  totalCost: number;
  productCount: number;
  variantCount: number;
};

type CategorySummary = {
  categoryId: string;
  categoryName: string;
  totalQty: number;
  totalCost: number;
  productCount: number;
  variantCount: number;
};

type CategoryOption = {
  id: string;
  name: string;
};

type SummaryResponse = {
  products: ProductSummary[];
  totals: SummaryTotals;
  categories: CategorySummary[];
  updatedAt: string;
};

export default function InventorySummaryPage() {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    apiFetch<CategoryOption[]>("/categories?active=true")
      .then(setCategories)
      .catch(() => null);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (categoryId) params.set("categoryId", categoryId);
    if (keyword) params.set("keyword", keyword);
    const query = params.toString();
    apiFetch<SummaryResponse>(`/stock/summary${query ? `?${query}` : ""}`)
      .then(setSummary)
      .catch(() => null);
  }, [categoryId, keyword]);

  const updatedAtLabel = useMemo(() => {
    if (!summary?.updatedAt) return "";
    return new Date(summary.updatedAt).toLocaleString("zh-CN");
  }, [summary?.updatedAt]);

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <AppHeader
          label="库存总览"
          title="当前库存与总数量"
          description="查看每个商品的库存汇总与颜色尺码明细。"
        />

        <div className="flex justify-end">
          <a
            href="/products/deleted"
            className="rounded-2xl border border-[#e4d7c5] px-4 py-2 text-sm text-[#6b645a]"
          >
            已删除商品
          </a>
        </div>

        <section className="rounded-3xl bg-white/90 p-8 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2 text-sm text-[#6b645a]">
              分类筛选
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
              >
                <option value="">全部分类</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-[#6b645a]">
              关键词搜索
              <input
                value={keywordInput}
                onChange={(event) => setKeywordInput(event.target.value)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
                placeholder="商品名称 / 款号"
              />
            </label>
            <div className="flex items-end gap-3">
              <button
                type="button"
                onClick={() => setKeyword(keywordInput.trim())}
                className="flex-1 rounded-2xl bg-[#1f1811] px-4 py-3 text-sm font-semibold text-white"
              >
                搜索
              </button>
              <button
                type="button"
                onClick={() => {
                  setKeywordInput("");
                  setKeyword("");
                  setCategoryId("");
                }}
                className="rounded-2xl border border-[#e4d7c5] px-4 py-3 text-sm text-[#6b645a]"
              >
                清空
              </button>
            </div>
          </div>
        </section>

        {summary ? (
          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl bg-white/90 p-6 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
              <p className="text-sm text-[#6b645a]">总数量</p>
              <p className="mt-2 text-2xl font-semibold text-[#1f1811]">
                {summary.totals.totalQty}
              </p>
            </div>
            <div className="rounded-3xl bg-white/90 p-6 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
              <p className="text-sm text-[#6b645a]">总成本</p>
              <p className="mt-2 text-2xl font-semibold text-[#1f1811]">
                ¥{summary.totals.totalCost.toFixed(2)}
              </p>
            </div>
            <div className="rounded-3xl bg-white/90 p-6 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
              <p className="text-sm text-[#6b645a]">在库商品数</p>
              <p className="mt-2 text-2xl font-semibold text-[#1f1811]">
                {summary.totals.productCount}
              </p>
            </div>
            <div className="rounded-3xl bg-white/90 p-6 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
              <p className="text-sm text-[#6b645a]">在库单品数</p>
              <p className="mt-2 text-2xl font-semibold text-[#1f1811]">
                {summary.totals.variantCount}
              </p>
            </div>
          </section>
        ) : null}

        {summary?.categories?.length ? (
          <section className="overflow-hidden rounded-3xl bg-white/90 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
            <div className="px-6 py-4 text-base font-semibold text-[#1f1811]">
              分类库存汇总
            </div>
            <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr] bg-[#f5efe6] px-6 py-3 text-sm font-semibold text-[#5c544b]">
              <div>分类</div>
              <div>总数量</div>
              <div>总成本</div>
              <div>商品数</div>
              <div>单品数</div>
            </div>
            {summary.categories.map((category) => (
              <div
                key={category.categoryId}
                className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr] border-t border-[#eadfce] px-6 py-3 text-sm text-[#6b645a]"
              >
                <div>{category.categoryName}</div>
                <div>{category.totalQty}</div>
                <div>¥{category.totalCost.toFixed(2)}</div>
                <div>{category.productCount}</div>
                <div>{category.variantCount}</div>
              </div>
            ))}
          </section>
        ) : null}

        {updatedAtLabel ? (
          <div className="text-right text-xs text-[#6b645a]">
            更新时间：{updatedAtLabel}
          </div>
        ) : null}

        <section className="space-y-4 rounded-3xl bg-white/90 p-8 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
          {summary?.products.length ? (
            summary.products.map((product) => (
              <details
                key={product.id}
                className="rounded-3xl border border-[#eadfce] bg-[#fbf7f0] px-6 py-4"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {resolveImageUrl(product.imageUrl) ? (
                      <img
                        src={resolveImageUrl(product.imageUrl) ?? ""}
                        alt={product.name}
                        className="h-14 w-14 rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eadfce] text-xs text-[#6b645a]">
                        暂无图片
                      </div>
                    )}
                    <div>
                      <p className="text-lg font-semibold text-[#1f1811]">
                        {product.name}
                      </p>
                      <p className="text-xs text-[#6b645a]">
                        编码 {product.baseCode}
                      </p>
                      <a
                        href={`/products/${product.id}`}
                        className="text-xs text-[#a7652d]"
                      >
                        查看详情
                      </a>
                    </div>
                  </div>
                  <div className="flex gap-6 text-sm text-[#6b645a]">
                    <span>总数量 {product.totalQty}</span>
                    <span>总成本 ¥{product.totalCost.toFixed(2)}</span>
                  </div>
                </summary>
                <div className="mt-4 overflow-hidden rounded-2xl border border-[#eadfce] bg-white">
                  <div className="grid grid-cols-[1fr_1fr_1fr_1fr] bg-[#f5efe6] px-4 py-2 text-sm font-semibold text-[#5c544b]">
                    <div>颜色</div>
                    <div>尺码</div>
                    <div>当前数量</div>
                    <div>成本总额</div>
                  </div>
                  {product.variants.map((variant) => (
                    <div
                      key={variant.id}
                      className="grid grid-cols-[1fr_1fr_1fr_1fr] border-t border-[#eadfce] px-4 py-2 text-sm text-[#6b645a]"
                    >
                      <div>{variant.color}</div>
                      <div>{variant.size}</div>
                      <div>{variant.currentQty}</div>
                      <div>¥{variant.totalCost.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </details>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-[#eadfce] px-6 py-10 text-center text-sm text-[#6b645a]">
              暂无库存数据，请先录入商品或进行入库。
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
