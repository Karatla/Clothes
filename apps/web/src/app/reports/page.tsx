"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AppHeader from "@/app/components/app-header";
import { apiFetch } from "@/lib/api";

type ReportRow = {
  productId: string;
  productName: string;
  baseCode: string;
  variantId?: string;
  color?: string;
  size?: string;
  soldQty: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
};

type ReportResponse = {
  groupBy: "product" | "variant";
  start: string;
  end: string;
  totals: Omit<ReportRow, "productId" | "productName" | "baseCode" | "variantId" | "color" | "size">;
  rows: ReportRow[];
};

type DailyRow = { date: string; revenue: number; refunds: number };

const toLocalDate = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

export default function ReportsPage() {
  const [groupBy, setGroupBy] = useState<"product" | "variant">("product");
  const [start, setStart] = useState(toLocalDate(new Date()));
  const [end, setEnd] = useState(toLocalDate(new Date()));
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadReport = async () => {
    setError(null);
    const data = await apiFetch<ReportResponse>(
      `/reports/sales?groupBy=${groupBy}&start=${start}&end=${end}`,
    );
    setReport(data);
  };

  useEffect(() => {
    Promise.all([
      loadReport(),
      apiFetch<DailyRow[]>(`/reports/daily?start=${start}&end=${end}`),
    ])
      .then(([, dailyData]) => setDaily(dailyData))
      .catch((err) => setError(err.message));
  }, [groupBy, start, end, refreshKey]);

  const handleToday = () => {
    const today = toLocalDate(new Date());
    setStart(today);
    setEnd(today);
    setRefreshKey((prev) => prev + 1);
  };

  const profitChart = useMemo(() => {
    if (!report) return [];
    return report.rows.slice(0, 10).map((row) => ({
      name: row.productName,
      profit: row.profit,
    }));
  }, [report]);

  const csvContent = useMemo(() => {
    if (!report) return "";
    const header =
      groupBy === "product"
        ? ["商品", "编码", "销量", "销售额", "成本", "利润", "利润率"]
        : ["商品", "编码", "颜色", "尺码", "销量", "销售额", "成本", "利润", "利润率"];
    const lines = report.rows.map((row) => {
      const base = [row.productName, row.baseCode];
      const tail = [
        row.soldQty.toString(),
        row.revenue.toFixed(2),
        row.cost.toFixed(2),
        row.profit.toFixed(2),
        `${(row.margin * 100).toFixed(1)}%`,
      ];
      return groupBy === "product"
        ? [...base, ...tail]
        : [...base, row.color ?? "", row.size ?? "", ...tail];
    });

    return [header, ...lines].map((line) => line.join(",")).join("\n");
  }, [report, groupBy]);

  const handleDownload = () => {
    if (!csvContent) return;
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sales-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <AppHeader
          label="销售报表"
          title="销售与利润分析"
          description="按商品或颜色尺码查看销售与利润情况。"
        />

        <section className="rounded-3xl bg-white/90 p-6 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex rounded-2xl border border-[#eadfce] bg-[#fbf7f0] p-1">
              <button
                type="button"
                onClick={() => setGroupBy("product")}
                className={`rounded-2xl px-4 py-2 text-sm ${groupBy === "product" ? "bg-[#1f1811] text-white" : "text-[#6b645a]"}`}
              >
                按商品
              </button>
              <button
                type="button"
                onClick={() => setGroupBy("variant")}
                className={`rounded-2xl px-4 py-2 text-sm ${groupBy === "variant" ? "bg-[#1f1811] text-white" : "text-[#6b645a]"}`}
              >
                按颜色尺码
              </button>
            </div>
            <label className="text-sm text-[#6b645a]">
              开始
              <input
                type="date"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                className="ml-2 rounded-xl border border-[#e4d7c5] px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm text-[#6b645a]">
              结束
              <input
                type="date"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                className="ml-2 rounded-xl border border-[#e4d7c5] px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={handleToday}
              className="rounded-2xl border border-[#e4d7c5] bg-white px-4 py-2 text-sm"
            >
              今天
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-2xl border border-[#e4d7c5] bg-white px-4 py-2 text-sm"
            >
              导出 CSV
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-[#f0c7b3] bg-[#fff1ea] px-4 py-3 text-sm text-[#b14d2a]">
              {error}
            </div>
          ) : null}

          <div className="mt-6 overflow-hidden rounded-2xl border border-[#eadfce]">
            <div
              className={`grid ${groupBy === "product" ? "grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr]" : "grid-cols-[1.2fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr]"} bg-[#f5efe6] px-4 py-2 text-sm font-semibold text-[#5c544b]`}
            >
              <div>商品</div>
              <div>编码</div>
              {groupBy === "variant" ? (
                <>
                  <div>颜色</div>
                  <div>尺码</div>
                </>
              ) : null}
              <div>销量</div>
              <div>销售额</div>
              <div>成本</div>
              <div>利润</div>
              <div>利润率</div>
            </div>
            {report?.rows.length ? (
              report.rows.map((row) => (
                <div
                  key={row.variantId ?? row.productId}
                  className={`grid ${groupBy === "product" ? "grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr]" : "grid-cols-[1.2fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr]"} border-t border-[#eadfce] px-4 py-2 text-sm text-[#6b645a]`}
                >
                  <div>{row.productName}</div>
                  <div>{row.baseCode}</div>
                  {groupBy === "variant" ? (
                    <>
                      <div>{row.color}</div>
                      <div>{row.size}</div>
                    </>
                  ) : null}
                  <div>{row.soldQty}</div>
                  <div>¥{row.revenue.toFixed(2)}</div>
                  <div>¥{row.cost.toFixed(2)}</div>
                  <div>¥{row.profit.toFixed(2)}</div>
                  <div>{(row.margin * 100).toFixed(1)}%</div>
                </div>
              ))
            ) : (
              <div className="px-6 py-10 text-center text-sm text-[#6b645a]">
                暂无报表数据
              </div>
            )}
            {report ? (
              <div
                className={`grid ${groupBy === "product" ? "grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr]" : "grid-cols-[1.2fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr]"} border-t border-[#eadfce] bg-[#fdf9f2] px-4 py-2 text-sm font-semibold text-[#5c544b]`}
              >
                <div>合计</div>
                <div />
                {groupBy === "variant" ? (
                  <>
                    <div />
                    <div />
                  </>
                ) : null}
                <div>{report.totals.soldQty}</div>
                <div>¥{report.totals.revenue.toFixed(2)}</div>
                <div>¥{report.totals.cost.toFixed(2)}</div>
                <div>¥{report.totals.profit.toFixed(2)}</div>
                <div>{(report.totals.margin * 100).toFixed(1)}%</div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl bg-white/90 p-6 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
            <h3 className="text-base font-semibold text-[#1f1811]">利润前十商品</h3>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={profitChart} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value) => `¥${Number(value).toFixed(2)}`} />
                  <Bar dataKey="profit" fill="#1f1811" radius={[4, 4, 4, 4]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-3xl bg-white/90 p-6 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
            <h3 className="text-base font-semibold text-[#1f1811]">销售 vs 退货</h3>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily}>
                  <XAxis dataKey="date" hide />
                  <YAxis hide />
                  <Tooltip formatter={(value) => `¥${Number(value).toFixed(2)}`} />
                  <Bar dataKey="revenue" fill="#a7652d" radius={[4, 4, 4, 4]} />
                  <Bar dataKey="refunds" fill="#b14d2a" radius={[4, 4, 4, 4]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
