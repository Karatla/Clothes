"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/app/components/app-header";
import { apiFetch } from "@/lib/api";

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
  totalQty: number;
  totalCost: number;
  variants: VariantSummary[];
};

type SummaryResponse = {
  products: ProductSummary[];
  updatedAt: string;
};

export default function InventorySummaryPage() {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);

  useEffect(() => {
    apiFetch<SummaryResponse>("/stock/summary")
      .then(setSummary)
      .catch(() => null);
  }, []);

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <AppHeader
          label="库存总览"
          title="当前库存与总数量"
          description="查看每个商品的库存汇总与颜色尺码明细。"
        />

        <section className="space-y-4 rounded-3xl bg-white/90 p-8 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
          {summary?.products.length ? (
            summary.products.map((product) => (
              <details
                key={product.id}
                className="rounded-3xl border border-[#eadfce] bg-[#fbf7f0] px-6 py-4"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
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
