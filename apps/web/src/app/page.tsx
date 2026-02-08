"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AppHeader from "./components/app-header";
import { apiFetch } from "@/lib/api";

export default function Home() {
  const [range, setRange] = useState<"today" | "7" | "30" | "custom">("today");
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const [daily, setDaily] = useState<Array<{ date: string; revenue: number; refunds: number }>>([]);
  const [topProducts, setTopProducts] = useState<Array<{ name: string; baseCode: string; revenue: number }>>([]);
  const [lowStock, setLowStock] = useState<Array<{ name: string; baseCode: string; totalQty: number }>>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const now = new Date();
    const endDate = new Date(now.getTime());
    const startDate = new Date(now.getTime());
    if (range === "today") {
      startDate.setDate(endDate.getDate());
    } else if (range === "7") {
      startDate.setDate(endDate.getDate() - 6);
    } else {
      startDate.setDate(endDate.getDate() - 29);
    }

    if (range !== "custom") {
      setStart(startDate.toISOString().slice(0, 10));
      setEnd(endDate.toISOString().slice(0, 10));
    }
  }, [range]);

  useEffect(() => {
    if (!start || !end) return;
    Promise.all([
      apiFetch<Array<{ date: string; revenue: number; refunds: number }>>(
        `/reports/daily?start=${start}&end=${end}`,
      ),
      apiFetch<Array<{ name: string; baseCode: string; revenue: number }>>(
        `/reports/top-products?start=${start}&end=${end}&limit=10`,
      ),
      apiFetch<{ products: Array<{ name: string; baseCode: string; totalQty: number }> }>(
        "/stock/summary",
      ),
    ])
      .then(([dailyData, topData, summary]) => {
        setDaily(dailyData);
        setTopProducts(topData);
        const low = summary.products
          .map((product) => ({
            name: product.name,
            baseCode: product.baseCode,
            totalQty: product.totalQty,
          }))
          .filter((item) => item.totalQty < 5)
          .sort((a, b) => a.totalQty - b.totalQty)
          .slice(0, 10);
        setLowStock(low);
      })
      .catch(() => null);
  }, [start, end, refreshKey]);

  const revenueSeries = useMemo(
    () => daily.map((item) => ({
      ...item,
      net: item.revenue - item.refunds,
    })),
    [daily],
  );

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <AppHeader
          label="管理中心"
          title="服装库存系统仪表盘"
          description="欢迎回来，系统已准备好处理库存与进货。"
        />

        <section className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl bg-white/90 p-8 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
            <h2 className="text-xl font-semibold text-[#1f1811]">下一步操作</h2>
            <p className="mt-3 text-sm text-[#6b645a]">
              商品录入模块已经就绪，可以开始建立颜色尺码库存表。
            </p>
            <div className="mt-6 grid gap-4">
              <div className="rounded-2xl border border-[#eadfce] bg-[#fbf7f0] px-4 py-3 text-sm text-[#5c544b]">
                API 运行端口：3001
              </div>
              <div className="rounded-2xl border border-[#eadfce] bg-[#fbf7f0] px-4 py-3 text-sm text-[#5c544b]">
                前端运行端口：3000
              </div>
              <a
                href="/products/new"
                className="inline-flex items-center justify-center rounded-2xl bg-[#a7652d] px-4 py-3 text-sm font-semibold text-white"
              >
                进入商品录入
              </a>
            </div>
          </div>
          <div className="rounded-3xl bg-[#1f1811] p-8 text-white shadow-[0_25px_90px_-60px_rgba(36,27,14,0.6)]">
            <h2 className="text-xl font-semibold">登录已就绪</h2>
            <p className="mt-3 text-sm text-white/70">
              管理员登录功能已经完成，可以开始添加商品和库存模块。
            </p>
            <div className="mt-6 space-y-3 text-sm text-white/70">
              <div>下一阶段：商品基础信息 + 颜色尺码矩阵</div>
              <div>记得在 .env 中配置管理员账号</div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <div className="rounded-3xl bg-white/90 p-6 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#1f1811]">销售趋势</h3>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setRange("today");
                    setRefreshKey((prev) => prev + 1);
                  }}
                  className={`rounded-full px-3 py-1 ${range === "today" ? "bg-[#1f1811] text-white" : "border border-[#eadfce] text-[#6b645a]"}`}
                >
                  今天
                </button>
                <button
                  type="button"
                  onClick={() => setRange("7")}
                  className={`rounded-full px-3 py-1 ${range === "7" ? "bg-[#1f1811] text-white" : "border border-[#eadfce] text-[#6b645a]"}`}
                >
                  7天
                </button>
                <button
                  type="button"
                  onClick={() => setRange("30")}
                  className={`rounded-full px-3 py-1 ${range === "30" ? "bg-[#1f1811] text-white" : "border border-[#eadfce] text-[#6b645a]"}`}
                >
                  30天
                </button>
                <button
                  type="button"
                  onClick={() => setRange("custom")}
                  className={`rounded-full px-3 py-1 ${range === "custom" ? "bg-[#1f1811] text-white" : "border border-[#eadfce] text-[#6b645a]"}`}
                >
                  自定义
                </button>
              </div>
            </div>
            {range === "custom" ? (
              <div className="mt-3 flex gap-2 text-xs text-[#6b645a]">
                <input
                  type="date"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                  className="rounded-xl border border-[#eadfce] px-2 py-1"
                />
                <span>至</span>
                <input
                  type="date"
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                  className="rounded-xl border border-[#eadfce] px-2 py-1"
                />
              </div>
            ) : null}
            <div className="mt-4 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueSeries}>
                  <XAxis dataKey="date" hide />
                  <YAxis hide />
                  <Tooltip formatter={(value) => `¥${Number(value).toFixed(2)}`} />
                  <Line type="monotone" dataKey="net" stroke="#a7652d" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-3xl bg-white/90 p-6 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
            <h3 className="text-base font-semibold text-[#1f1811]">热销商品</h3>
            <div className="mt-4 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value) => `¥${Number(value).toFixed(2)}`} />
                  <Bar dataKey="revenue" fill="#1f1811" radius={[4, 4, 4, 4]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-3xl bg-white/90 p-6 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
            <h3 className="text-base font-semibold text-[#1f1811]">库存预警</h3>
            <div className="mt-4 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lowStock} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="totalQty" fill="#b14d2a" radius={[4, 4, 4, 4]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
