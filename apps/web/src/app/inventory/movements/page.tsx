"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/app/components/app-header";
import { apiFetch } from "@/lib/api";

type Movement = {
  id: string;
  type: "IN" | "OUT" | "RETURN" | "ADJUST";
  qty: number;
  unitCost: number | null;
  note: string | null;
  createdAt: string;
  product?: { name: string; baseCode: string } | null;
  variant?: { color: string; size: string; sku: string } | null;
};

const typeLabels: Record<Movement["type"], string> = {
  IN: "入库",
  OUT: "出库",
  RETURN: "退货",
  ADJUST: "调整",
};

export default function MovementsPage() {
  const [movements, setMovements] = useState<Movement[]>([]);

  useEffect(() => {
    apiFetch<Movement[]>("/stock/movements")
      .then(setMovements)
      .catch(() => null);
  }, []);

  const formatted = useMemo(
    () =>
      movements.map((movement) => ({
        ...movement,
        date: new Date(movement.createdAt).toLocaleString("zh-CN"),
      })),
    [movements],
  );

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <AppHeader
          label="库存流水"
          title="库存变动记录"
          description="所有入库、调整与未来出库记录都会显示在这里。"
        />

        <section className="overflow-hidden rounded-3xl bg-white/90 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
          <div className="grid grid-cols-[1.2fr_1fr_1fr_0.8fr_0.8fr_1fr] bg-[#f5efe6] px-6 py-3 text-sm font-semibold text-[#5c544b]">
            <div>时间</div>
            <div>商品</div>
            <div>颜色/尺码</div>
            <div>类型</div>
            <div>数量</div>
            <div>备注</div>
          </div>
          {formatted.length ? (
            formatted.map((movement) => (
              <div
                key={movement.id}
                className="grid grid-cols-[1.2fr_1fr_1fr_0.8fr_0.8fr_1fr] border-t border-[#eadfce] px-6 py-3 text-sm text-[#6b645a]"
              >
                <div>{movement.date}</div>
                <div>
                  {movement.product
                    ? `${movement.product.name} (${movement.product.baseCode})`
                    : "-"}
                </div>
                <div>
                  {movement.variant
                    ? `${movement.variant.color} / ${movement.variant.size}`
                    : "-"}
                </div>
                <div>{typeLabels[movement.type]}</div>
                <div>{movement.qty}</div>
                <div>{movement.note ?? "-"}</div>
              </div>
            ))
          ) : (
            <div className="px-6 py-10 text-center text-sm text-[#6b645a]">
              暂无库存流水记录
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
