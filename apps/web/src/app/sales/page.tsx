"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/app/components/app-header";
import { apiFetch } from "@/lib/api";

type SaleItem = {
  id: string;
  qty: number;
  unitPrice: number;
  unitCost: number;
  lineTotal: number;
  lineCost: number;
  profit: number;
  profitEstimated: boolean;
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
  totalCost: number;
  totalProfit: number;
  profitEstimated: boolean;
  note: string | null;
  items: SaleItem[];
};

type SearchType = "default" | "productCode" | "saleNo" | "saleId";

const toLocalDate = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

export default function SalesListPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchType, setSearchType] = useState<SearchType>("default");
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [minProfit, setMinProfit] = useState("");
  const [maxProfit, setMaxProfit] = useState("");

  const loadSales = async () => {
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    if (minProfit.trim()) params.set("minProfit", minProfit.trim());
    if (maxProfit.trim()) params.set("maxProfit", maxProfit.trim());
    params.set("searchType", searchType);
    if (searchType !== "default" && keyword.trim()) {
      params.set("keyword", keyword.trim());
    }
    const query = params.toString();
    const data = await apiFetch<Sale[]>(`/sales${query ? `?${query}` : ""}`);
    setSales(data);
  };

  useEffect(() => {
    loadSales().catch(() => null);
  }, [start, end, minProfit, maxProfit, searchType, keyword]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("确认删除这条销售记录？库存将自动回滚。")) {
      return;
    }
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

  const keywordPlaceholder =
    searchType === "productCode"
      ? "输入商品码"
      : searchType === "saleNo"
        ? "输入订单号"
        : searchType === "saleId"
          ? "输入订单 ID"
          : "当前方式无需关键词";

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <AppHeader
          label="销售记录"
          title="历史销售订单"
          description="可查看销售详情、利润和退换货入口。"
        />

        <section className="rounded-3xl bg-white/90 p-6 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
          <div className="grid gap-4 md:grid-cols-4">
            <label className="space-y-2 text-sm text-[#6b645a]">
              开始日期
              <input
                type="date"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
                max={toLocalDate(new Date(2100, 0, 1))}
              />
            </label>
            <label className="space-y-2 text-sm text-[#6b645a]">
              结束日期
              <input
                type="date"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
                max={toLocalDate(new Date(2100, 0, 1))}
              />
            </label>
            <label className="space-y-2 text-sm text-[#6b645a]">
              最低盈利
              <input
                value={minProfit}
                onChange={(event) => setMinProfit(event.target.value)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
                placeholder="如：100"
              />
            </label>
            <label className="space-y-2 text-sm text-[#6b645a]">
              最高盈利
              <input
                value={maxProfit}
                onChange={(event) => setMaxProfit(event.target.value)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
                placeholder="如：500"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-sm text-[#6b645a]">
            {[
              ["default", "默认"],
              ["productCode", "商品码"],
              ["saleNo", "订单号"],
              ["saleId", "订单ID"],
            ].map(([value, label]) => (
              <label
                key={value}
                className="flex items-center gap-2 rounded-full border border-[#e4d7c5] px-4 py-2"
              >
                <input
                  type="radio"
                  name="sales-search-type"
                  value={value}
                  checked={searchType === value}
                  onChange={() => setSearchType(value as SearchType)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto_auto]">
            <input
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              disabled={searchType === "default"}
              className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base disabled:bg-[#f5efe6]"
              placeholder={keywordPlaceholder}
            />
            <button
              type="button"
              onClick={() => setKeyword(keywordInput.trim())}
              className="rounded-2xl bg-[#1f1811] px-5 py-3 text-sm font-semibold text-white"
            >
              搜索
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchType("default");
                setKeywordInput("");
                setKeyword("");
                setStart("");
                setEnd("");
                setMinProfit("");
                setMaxProfit("");
              }}
              className="rounded-2xl border border-[#e4d7c5] px-5 py-3 text-sm text-[#6b645a]"
            >
              清空
            </button>
          </div>
        </section>

        <section className="space-y-4">
          {formatted.length ? (
            formatted.map((sale) => (
              <div
                key={sale.id}
                className="rounded-3xl bg-white/90 p-6 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-[#1f1811]">
                      {sale.saleNo}
                    </p>
                    <p className="text-xs text-[#6b645a]">{sale.soldAtLabel}</p>
                    {sale.profitEstimated ? (
                      <p className="mt-1 text-xs text-[#b14d2a]">
                        历史订单利润按当前成本估算
                      </p>
                    ) : null}
                  </div>
                  <div className="grid gap-1 text-right text-sm text-[#6b645a]">
                    <div>总金额 ¥{sale.totalAmount.toFixed(2)}</div>
                    <div>销售成本 ¥{sale.totalCost.toFixed(2)}</div>
                    <div className="font-semibold text-[#1f1811]">
                      盈利 ¥{sale.totalProfit.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/returns/new?saleId=${sale.id}`}
                      className="rounded-2xl border border-[#d6d0ff] px-4 py-2 text-sm text-[#5a49b7]"
                    >
                      退换货
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDelete(sale.id)}
                      className="rounded-2xl border border-[#f0c7b3] px-4 py-2 text-sm text-[#b14d2a]"
                    >
                      删除
                    </button>
                  </div>
                </div>
                <div className="mt-4 overflow-hidden rounded-2xl border border-[#eadfce]">
                  <div className="grid grid-cols-[1.4fr_1fr_0.8fr_1fr_1fr_1fr] bg-[#f5efe6] px-4 py-2 text-sm font-semibold text-[#5c544b]">
                    <div>商品</div>
                    <div>颜色/尺码</div>
                    <div>数量</div>
                    <div>销售额</div>
                    <div>成本</div>
                    <div>利润</div>
                  </div>
                  {sale.items.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[1.4fr_1fr_0.8fr_1fr_1fr_1fr] border-t border-[#eadfce] px-4 py-2 text-sm text-[#6b645a]"
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
                      <div>¥{item.lineCost.toFixed(2)}</div>
                      <div>¥{item.profit.toFixed(2)}</div>
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
