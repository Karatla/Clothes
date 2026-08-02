"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { apiFetch } from "@/lib/api";

type SaleItem = {
  id: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  lineCost: number;
  profit: number;
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
  note: string | null;
  paymentMethod: string | null;
  receivedAmount: number | null;
  changeAmount: number | null;
  items: SaleItem[];
};

type Settings = Record<string, string>;

/** 热敏纸的实际打印宽度：58mm 纸可打 48mm，80mm 纸可打 72mm */
const PAPER = {
  "58": { page: "58mm", content: "48mm", base: "9px" },
  "80": { page: "80mm", content: "72mm", base: "11px" },
  a4: { page: "A4", content: "180mm", base: "13px" },
} as const;

export default function ReceiptPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [sale, setSale] = useState<Sale | null>(null);
  const [settings, setSettings] = useState<Settings>({});
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([apiFetch<Sale>(`/sales/${id}`), apiFetch<Settings>("/settings")])
      .then(async ([saleData, settingData]) => {
        setSale(saleData);
        setSettings(settingData);
        if (settingData["receipt.showQr"] === "true" && saleData?.saleNo) {
          setQr(
            await QRCode.toDataURL(saleData.saleNo, {
              margin: 0,
              width: 160,
              errorCorrectionLevel: "M",
            }),
          );
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "读取订单失败"),
      );
  }, [id]);

  const widthKey = (settings["receipt.width"] ?? "80") as keyof typeof PAPER;
  const paper = PAPER[widthKey] ?? PAPER["80"];
  const showCost = settings["receipt.showCost"] === "true";
  const copies = Math.max(1, Math.min(Number(settings["receipt.copies"]) || 1, 5));

  const totals = useMemo(() => {
    if (!sale) return { qty: 0, kinds: 0 };
    return {
      qty: sale.items.reduce((sum, item) => sum + item.qty, 0),
      kinds: sale.items.length,
    };
  }, [sale]);

  if (error) {
    return (
      <div className="p-10 text-center text-sm text-[#b14d2a]">{error}</div>
    );
  }

  if (!sale) {
    return <div className="p-10 text-center text-sm text-[#6b645a]">读取中...</div>;
  }

  const receipt = (
    <div className="receipt" style={{ width: paper.content }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "1.4em", fontWeight: 700 }}>
          {settings["shop.name"] || "　"}
        </div>
        {settings["shop.phone"] ? <div>电话：{settings["shop.phone"]}</div> : null}
        {settings["shop.address"] ? <div>{settings["shop.address"]}</div> : null}
      </div>

      <div className="divider" />

      <div>单号：{sale.saleNo}</div>
      <div>时间：{new Date(sale.soldAt).toLocaleString("zh-CN")}</div>
      {sale.note ? <div>备注：{sale.note}</div> : null}

      <div className="divider" />

      <div className="row head">
        <span className="c1">商品</span>
        <span className="c2">数量</span>
        <span className="c3">单价</span>
        <span className="c4">金额</span>
      </div>

      {sale.items.map((item) => (
        <div key={item.id} className="item">
          <div className="name">
            {item.variant?.product
              ? `${item.variant.product.name} ${item.variant.product.baseCode}`
              : "-"}
          </div>
          <div className="row">
            <span className="c1">
              {item.variant ? `${item.variant.color}/${item.variant.size}` : ""}
            </span>
            <span className="c2">{item.qty}</span>
            <span className="c3">{item.unitPrice.toFixed(2)}</span>
            <span className="c4">{item.lineTotal.toFixed(2)}</span>
          </div>
        </div>
      ))}

      <div className="divider" />

      <div className="row">
        <span>合计件数</span>
        <span>
          {totals.qty} 件 / {totals.kinds} 款
        </span>
      </div>
      <div className="row bold">
        <span>应收金额</span>
        <span>¥{sale.totalAmount.toFixed(2)}</span>
      </div>
      {sale.paymentMethod ? (
        <div className="row">
          <span>收款方式</span>
          <span>{sale.paymentMethod}</span>
        </div>
      ) : null}
      {sale.receivedAmount !== null ? (
        <div className="row">
          <span>实收</span>
          <span>¥{sale.receivedAmount.toFixed(2)}</span>
        </div>
      ) : null}
      {sale.changeAmount !== null ? (
        <div className="row">
          <span>找零</span>
          <span>¥{sale.changeAmount.toFixed(2)}</span>
        </div>
      ) : null}

      {showCost ? (
        <>
          <div className="divider" />
          <div className="row">
            <span>成本</span>
            <span>¥{sale.totalCost.toFixed(2)}</span>
          </div>
          <div className="row">
            <span>毛利</span>
            <span>¥{sale.totalProfit.toFixed(2)}</span>
          </div>
        </>
      ) : null}

      <div className="divider" />

      {qr ? (
        <div style={{ textAlign: "center", marginTop: "2mm" }}>
          <img src={qr} alt={sale.saleNo} style={{ width: "20mm" }} />
          <div style={{ fontSize: "0.85em" }}>退换货请出示此码</div>
        </div>
      ) : null}

      {settings["shop.footer"] ? (
        <div style={{ textAlign: "center", marginTop: "2mm" }}>
          {settings["shop.footer"]}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="receipt-page">
      <style>{`
        @page { size: ${paper.page} auto; margin: ${widthKey === "a4" ? "10mm" : "2mm"}; }
        .receipt-page { background: #f4f1ea; padding: 24px 12px; min-height: 100vh; }
        .receipt {
          margin: 0 auto;
          background: #fff;
          padding: 3mm 2mm;
          color: #000;
          font-family: "PingFang SC", "Microsoft YaHei", monospace;
          font-size: ${paper.base};
          line-height: 1.45;
        }
        .receipt .divider {
          border-top: 1px dashed #000;
          margin: 1.5mm 0;
        }
        .receipt .row { display: flex; justify-content: space-between; gap: 2mm; }
        .receipt .row.head { font-weight: 700; }
        .receipt .row.bold { font-weight: 700; font-size: 1.15em; }
        .receipt .item { margin-bottom: 1mm; }
        .receipt .item .name { font-weight: 600; word-break: break-all; }
        .receipt .c1 { flex: 1 1 auto; min-width: 0; }
        .receipt .c2 { width: 12%; text-align: right; }
        .receipt .c3 { width: 22%; text-align: right; }
        .receipt .c4 { width: 24%; text-align: right; }
        .receipt + .receipt { page-break-before: always; margin-top: 8mm; }

        @media print {
          .receipt-page { background: #fff; padding: 0; }
          .no-print { display: none !important; }
          .receipt { box-shadow: none; margin: 0; }
        }
      `}</style>

      <div className="no-print mx-auto mb-6 flex w-full max-w-md flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex-1 rounded-2xl bg-[#1f1811] px-6 py-3 text-sm font-semibold text-white"
        >
          打印小票
        </button>
        <a
          href="/sales"
          className="rounded-2xl border border-[#e4d7c5] bg-white px-5 py-3 text-sm text-[#6b645a]"
        >
          返回
        </a>
      </div>
      <p className="no-print mx-auto mb-6 max-w-md text-center text-xs text-[#8a8073]">
        纸张：{widthKey === "a4" ? "A4" : `${widthKey}mm 热敏纸`}
        （在
        <a href="/settings" className="underline">
          系统设置
        </a>
        里修改）。打印时请把边距设为无、关闭页眉页脚。
      </p>

      {Array.from({ length: copies }).map((_, index) => (
        <div key={index}>{receipt}</div>
      ))}
    </div>
  );
}
