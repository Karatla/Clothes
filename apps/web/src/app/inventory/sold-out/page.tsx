"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/app/components/app-header";
import { apiFetch, resolveImageUrl } from "@/lib/api";

type ProductSummary = {
  id: string;
  name: string;
  baseCode: string;
  imageUrl?: string | null;
  totalQty: number;
  category?: { id: string; name: string } | null;
};

type CategoryOption = {
  id: string;
  name: string;
};

type SummaryResponse = {
  products: ProductSummary[];
};

export default function SoldOutInventoryPage() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
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
    params.set("stockStatus", "sold-out");
    if (categoryId) params.set("categoryId", categoryId);
    if (keyword) params.set("keyword", keyword);
    apiFetch<SummaryResponse>(`/stock/summary?${params.toString()}`)
      .then((data) => setProducts(data.products))
      .catch(() => null);
  }, [categoryId, keyword]);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name, "zh-CN")),
    [categories],
  );

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <AppHeader
          label="库存总览"
          title="已售空商品"
          description="查看当前总库存小于等于 0 的商品。"
        />

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
                {sortedCategories.map((category) => (
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
                  setCategoryId("");
                  setKeywordInput("");
                  setKeyword("");
                }}
                className="rounded-2xl border border-[#e4d7c5] px-4 py-3 text-sm text-[#6b645a]"
              >
                清空
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-3xl bg-white/90 p-8 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
          {products.length ? (
            products.map((product) => (
              <div
                key={product.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#eadfce] bg-[#fbf7f0] p-5"
              >
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
                      {product.category?.name ? ` · ${product.category.name}` : ""}
                    </p>
                  </div>
                </div>
                <div className="text-sm font-semibold text-[#b14d2a]">
                  当前库存 {product.totalQty}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-[#eadfce] px-6 py-10 text-center text-sm text-[#6b645a]">
              暂无已售空商品
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
