"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/app/components/app-header";
import { apiFetch } from "@/lib/api";

type ReturnItem = {
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

type ReturnRecord = {
  id: string;
  returnNo: string;
  returnedAt: string;
  totalAmount: number;
  sale?: { saleNo: string } | null;
  items: ReturnItem[];
};

export default function ReturnsListPage() {
  const [records, setRecords] = useState<ReturnRecord[]>([]);

  useEffect(() => {
    apiFetch<ReturnRecord[]>("/returns")
      .then(setRecords)
      .catch(() => null);
  }, []);

  const formatted = useMemo(
    () =>
      records.map((record) => ({
        ...record,
        returnedAtLabel: new Date(record.returnedAt).toLocaleString("zh-CN"),
      })),
    [records],
  );

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <AppHeader
          label="退货记录"
          title="退货历史"
          description="查看已完成的退货记录。"
        />

        <section className="space-y-4">
          {formatted.length ? (
            formatted.map((record) => (
              <div
                key={record.id}
                className="rounded-3xl bg-white/90 p-6 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-[#1f1811]">
                      {record.returnNo}
                    </p>
                    <p className="text-xs text-[#6b645a]">
                      {record.returnedAtLabel} · 原销售 {record.sale?.saleNo ?? "-"}
                    </p>
                  </div>
                  <div className="text-sm text-[#6b645a]">
                    退款金额 ¥{record.totalAmount.toFixed(2)}
                  </div>
                </div>
                <div className="mt-4 overflow-hidden rounded-2xl border border-[#eadfce]">
                  <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] bg-[#f5efe6] px-4 py-2 text-sm font-semibold text-[#5c544b]">
                    <div>商品</div>
                    <div>颜色/尺码</div>
                    <div>数量</div>
                    <div>小计</div>
                  </div>
                  {record.items.map((item) => (
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
              暂无退货记录
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
