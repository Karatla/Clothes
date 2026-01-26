"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/app/components/app-header";
import { apiFetch } from "@/lib/api";

type SaleItem = {
  id: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  variant?: {
    color: string;
    size: string;
    product?: { name: string; baseCode: string } | null;
  } | null;
};

type Sale = {
  id: string;
  saleNo: string;
  soldAt: string;
  totalAmount: number;
  note: string | null;
  items: SaleItem[];
};

export default function SalesListPage() {
  const [sales, setSales] = useState<Sale[]>([]);

  const loadSales = async () => {
    const data = await apiFetch<Sale[]>("/sales");
    setSales(data);
  };

  useEffect(() => {
    loadSales().catch(() => null);
  }, []);

  const handleDelete = async (id: string) => {
    await apiFetch(`/sales/${id}`, { method: "DELETE" });
    await loadSales();
  };

  const formatted = useMemo(
    () =>
      sales.map((sale) => ({
        ...sale,
        soldAtLabel: new Date(sale.soldAt).toLocaleString("zh-CN"),
      })),
    [sales],
  );

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <AppHeader
          label="销售记录"
          title="历史销售订单"
          description="可查看销售详情并删除错误记录。"
        />

        <section className="space-y-4">
          {formatted.length ? (
            formatted.map((sale) => (
              <div
                key={sale.id}
                className="rounded-3xl bg-white/90 p-6 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-[#1f1811]">
                      {sale.saleNo}
                    </p>
                    <p className="text-xs text-[#6b645a]">{sale.soldAtLabel}</p>
                  </div>
                  <div className="text-sm text-[#6b645a]">
                    总金额 ¥{sale.totalAmount.toFixed(2)}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(sale.id)}
                    className="rounded-2xl border border-[#f0c7b3] px-4 py-2 text-sm text-[#b14d2a]"
                  >
                    删除
                  </button>
                </div>
                <div className="mt-4 overflow-hidden rounded-2xl border border-[#eadfce]">
                  <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] bg-[#f5efe6] px-4 py-2 text-sm font-semibold text-[#5c544b]">
                    <div>商品</div>
                    <div>颜色/尺码</div>
                    <div>数量</div>
                    <div>小计</div>
                  </div>
                  {sale.items.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[1.4fr_1fr_1fr_1fr] border-t border-[#eadfce] px-4 py-2 text-sm text-[#6b645a]"
                    >
                      <div>
                        {item.variant?.product
                          ? `${item.variant.product.name} (${item.variant.product.baseCode})`
                          : "-"}
                      </div>
                      <div>
                        {item.variant
                          ? `${item.variant.color} / ${item.variant.size}`
                          : "-"}
                      </div>
                      <div>{item.qty}</div>
                      <div>¥{item.lineTotal.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-[#eadfce] px-6 py-10 text-center text-sm text-[#6b645a]">
              暂无销售记录
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
