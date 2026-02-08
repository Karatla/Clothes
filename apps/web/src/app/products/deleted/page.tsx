"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/app/components/app-header";
import { apiFetch } from "@/lib/api";

type Product = {
  id: string;
  name: string;
  baseCode: string;
  deletedAt?: string | null;
};

export default function DeletedProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const loadProducts = async () => {
    const params = new URLSearchParams();
    params.set("deleted", "true");
    if (keyword) params.set("keyword", keyword);
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    const data = await apiFetch<Product[]>(`/products?${params.toString()}`);
    setProducts(data);
  };

  useEffect(() => {
    loadProducts().catch((err) => setError(err.message));
  }, [keyword, start, end]);

  const handleRestore = async (id: string) => {
    const confirmed = window.confirm("确认恢复该商品？");
    if (!confirmed) return;
    await apiFetch(`/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isDeleted: false }),
    });
    await loadProducts();
  };

  const formatted = useMemo(
    () =>
      products.map((product) => ({
        ...product,
        deletedAtLabel: product.deletedAt
          ? new Date(product.deletedAt).toLocaleString("zh-CN")
          : "-",
      })),
    [products],
  );

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <AppHeader
          label="已删除商品"
          title="已删除商品列表"
          description="可查看或恢复被删除的商品。"
        />

        <section className="rounded-3xl bg-white/90 p-6 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
          <div className="grid gap-4 md:grid-cols-4">
            <label className="space-y-2 text-sm text-[#6b645a]">
              关键词搜索
              <input
                value={keywordInput}
                onChange={(event) => setKeywordInput(event.target.value)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
                placeholder="商品名称 / 款号"
              />
            </label>
            <label className="space-y-2 text-sm text-[#6b645a]">
              删除开始
              <input
                type="date"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
              />
            </label>
            <label className="space-y-2 text-sm text-[#6b645a]">
              删除结束
              <input
                type="date"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
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
                  setStart("");
                  setEnd("");
                }}
                className="rounded-2xl border border-[#e4d7c5] px-4 py-3 text-sm text-[#6b645a]"
              >
                清空
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-[#f0c7b3] bg-[#fff1ea] px-4 py-3 text-sm text-[#b14d2a]">
            {error}
          </div>
        ) : null}

        <section className="space-y-4">
          {formatted.length ? (
            formatted.map((product) => (
              <div
                key={product.id}
                className="rounded-3xl bg-white/90 p-6 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-[#1f1811]">
                      {product.name}
                    </p>
                    <p className="text-xs text-[#6b645a]">
                      款号 {product.baseCode}
                    </p>
                    <p className="mt-1 text-xs text-[#6b645a]">
                      删除时间 {product.deletedAtLabel}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`/products/${product.id}`}
                      className="rounded-2xl border border-[#e4d7c5] px-4 py-2 text-sm text-[#6b645a]"
                    >
                      查看详情
                    </a>
                    <button
                      type="button"
                      onClick={() => handleRestore(product.id)}
                      className="rounded-2xl border border-[#c9e2c8] px-4 py-2 text-sm text-[#386641]"
                    >
                      恢复
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-[#eadfce] px-6 py-10 text-center text-sm text-[#6b645a]">
              暂无已删除商品
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
