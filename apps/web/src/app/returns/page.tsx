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

type SearchType = "default" | "productCode" | "saleNo" | "returnNo" | "returnId";

export default function ReturnsListPage() {
  const [records, setRecords] = useState<ReturnRecord[]>([]);
  const [searchType, setSearchType] = useState<SearchType>("default");
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    if (minAmount.trim()) params.set("minAmount", minAmount.trim());
    if (maxAmount.trim()) params.set("maxAmount", maxAmount.trim());
    params.set("searchType", searchType);
    if (searchType !== "default" && keyword.trim()) {
      params.set("keyword", keyword.trim());
    }

    apiFetch<ReturnRecord[]>(`/returns${params.toString() ? `?${params.toString()}` : ""}`)
      .then(setRecords)
      .catch(() => null);
  }, [start, end, minAmount, maxAmount, searchType, keyword]);

  const formatted = useMemo(
    () =>
      records.map((record) => ({
        ...record,
        returnedAtLabel: new Date(record.returnedAt).toLocaleString("zh-CN"),
      })),
    [records],
  );

  const keywordPlaceholder =
    searchType === "productCode"
      ? "输入商品码"
      : searchType === "saleNo"
        ? "输入原订单号"
        : searchType === "returnNo"
          ? "输入退货单号"
          : searchType === "returnId"
            ? "输入退货单 ID"
            : "当前方式无需关键词";

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <AppHeader
          label="退货记录"
          title="退货历史"
          description="查看已完成的退货记录并按条件搜索。"
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
              />
            </label>
            <label className="space-y-2 text-sm text-[#6b645a]">
              结束日期
              <input
                type="date"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
              />
            </label>
            <label className="space-y-2 text-sm text-[#6b645a]">
              最低金额
              <input
                value={minAmount}
                onChange={(event) => setMinAmount(event.target.value)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
                placeholder="如：100"
              />
            </label>
            <label className="space-y-2 text-sm text-[#6b645a]">
              最高金额
              <input
                value={maxAmount}
                onChange={(event) => setMaxAmount(event.target.value)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
                placeholder="如：500"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-sm text-[#6b645a]">
            {[
              ["default", "默认"],
              ["productCode", "商品码"],
              ["saleNo", "原订单号"],
              ["returnNo", "退货单号"],
              ["returnId", "退货单ID"],
            ].map(([value, label]) => (
              <label
                key={value}
                className="flex items-center gap-2 rounded-full border border-[#e4d7c5] px-4 py-2"
              >
                <input
                  type="radio"
                  name="returns-search-type"
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
                setMinAmount("");
                setMaxAmount("");
              }}
              className="rounded-2xl border border-[#e4d7c5] px-5 py-3 text-sm text-[#6b645a]"
            >
              清空
            </button>
          </div>
        </section>

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
