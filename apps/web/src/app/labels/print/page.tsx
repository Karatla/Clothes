"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { apiFetch } from "@/lib/api";

type Variant = {
  id: string;
  color: string;
  size: string;
  sku: string;
  barcode: string | null;
  salePrice: number;
  currentQty?: number;
};

type Product = {
  id: string;
  name: string;
  baseCode: string;
  variants: Variant[];
};

type Settings = Record<string, string>;

type LabelItem = {
  key: string;
  productName: string;
  baseCode: string;
  color: string;
  size: string;
  barcode: string;
  salePrice: number;
  qr: string;
};

/** 标签物理尺寸，单位 mm */
const LABEL_SIZES: Record<string, { w: number; h: number }> = {
  "40x30": { w: 40, h: 30 },
  "50x30": { w: 50, h: 30 },
  "60x40": { w: 60, h: 40 },
};

function LabelsPrintInner() {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [copies, setCopies] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [variantFilter, setVariantFilter] = useState<string[] | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setProductId(params.get("productId"));
    const variants = params.get("variantIds");
    setVariantFilter(variants ? variants.split(",").filter(Boolean) : null);

    Promise.all([
      apiFetch<Product[]>("/products"),
      apiFetch<Settings>("/settings"),
    ])
      .then(([productData, settingData]) => {
        setProducts(productData);
        setSettings(settingData);
        setReady(true);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "读取数据失败"),
      );
  }, []);

  const selectedVariants = useMemo(() => {
    const rows: Array<{ product: Product; variant: Variant }> = [];
    products.forEach((product) => {
      if (productId && product.id !== productId) return;
      product.variants.forEach((variant) => {
        if (variantFilter && !variantFilter.includes(variant.id)) return;
        rows.push({ product, variant });
      });
    });
    return rows;
  }, [products, productId, variantFilter]);

  const sizeKey = settings["label.size"] ?? "40x30";
  const size = LABEL_SIZES[sizeKey] ?? LABEL_SIZES["40x30"];
  const isA4 = sizeKey === "a4";
  const showPrice = settings["label.showPrice"] === "true";
  const showShopName = settings["label.showShopName"] === "true";
  const shopName = settings["shop.name"] ?? "";

  // 默认每个规格按当前库存数量打印，最多 99 张
  useEffect(() => {
    if (!ready || selectedVariants.length === 0) return;
    setCopies((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const next: Record<string, string> = {};
      selectedVariants.forEach(({ variant }) => {
        const qty = variant.currentQty ?? 0;
        next[variant.id] = String(Math.min(Math.max(qty, 1), 99));
      });
      return next;
    });
  }, [ready, selectedVariants]);

  const handleGenerate = async () => {
    setError(null);
    const missing = selectedVariants.filter(({ variant }) => !variant.barcode);
    if (missing.length > 0) {
      try {
        await apiFetch("/variants/ensure-barcodes", {
          method: "POST",
          body: JSON.stringify(productId ? { productId } : {}),
        });
        const refreshed = await apiFetch<Product[]>("/products");
        setProducts(refreshed);
        setError("部分规格刚补发了条码，请再点一次生成");
        return;
      } catch (err) {
        setError(err instanceof Error ? err.message : "补发条码失败");
        return;
      }
    }

    const result: LabelItem[] = [];
    for (const { product, variant } of selectedVariants) {
      const count = Math.max(0, Math.min(Number(copies[variant.id]) || 0, 99));
      if (count === 0 || !variant.barcode) continue;

      const qr = await QRCode.toDataURL(variant.barcode, {
        margin: 0,
        width: 240,
        errorCorrectionLevel: "M",
      });

      for (let i = 0; i < count; i += 1) {
        result.push({
          key: `${variant.id}-${i}`,
          productName: product.name,
          baseCode: product.baseCode,
          color: variant.color,
          size: variant.size,
          barcode: variant.barcode,
          salePrice: variant.salePrice,
          qr,
        });
      }
    }

    if (result.length === 0) {
      setError("没有要打印的标签，请填写打印数量");
      return;
    }

    setLabels(result);
  };

  const totalLabels = labels.length;

  return (
    <div className="min-h-screen bg-[#faf6ef] px-6 py-10">
      <style>{`
        @page { size: ${isA4 ? "A4" : `${size.w}mm ${size.h}mm`}; margin: ${isA4 ? "8mm" : "0"}; }
        @media print {
          body { background: #fff; }
          .no-print { display: none !important; }
          .label-sheet { gap: 0 !important; }
          .label {
            break-inside: avoid;
            page-break-inside: avoid;
            ${isA4 ? "" : "page-break-after: always;"}
          }
          ${isA4 ? "" : ".label:last-child { page-break-after: auto; }"}
        }
      `}</style>

      <div className="no-print mx-auto mb-8 w-full max-w-4xl space-y-5">
        <div className="rounded-3xl bg-white/90 p-6 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-[#1f1811]">打印商品标签</p>
              <p className="mt-1 text-sm text-[#6b645a]">
                标签尺寸 {sizeKey === "a4" ? "A4 一版多张" : `${size.w} × ${size.h} mm`}
                （在
                <a href="/settings" className="underline">
                  系统设置
                </a>
                里修改）
              </p>
            </div>
            <a
              href="/inventory"
              className="rounded-2xl border border-[#e4d7c5] px-4 py-2 text-sm text-[#6b645a]"
            >
              返回库存
            </a>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-[#eadfce]">
            <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr_0.8fr] bg-[#f5efe6] px-4 py-2 text-sm font-semibold text-[#5c544b]">
              <div>商品</div>
              <div>颜色/尺码</div>
              <div>条码</div>
              <div>库存</div>
              <div>打印张数</div>
            </div>
            {selectedVariants.map(({ product, variant }) => (
              <div
                key={variant.id}
                className="grid grid-cols-[1.6fr_1fr_1fr_1fr_0.8fr] items-center border-t border-[#eadfce] bg-white px-4 py-2 text-sm text-[#6b645a]"
              >
                <div className="truncate">
                  {product.name} ({product.baseCode})
                </div>
                <div>
                  {variant.color} / {variant.size}
                </div>
                <div>{variant.barcode ?? "未生成"}</div>
                <div>{variant.currentQty ?? "-"}</div>
                <div>
                  <input
                    value={copies[variant.id] ?? ""}
                    onChange={(event) =>
                      setCopies((prev) => ({
                        ...prev,
                        [variant.id]: event.target.value,
                      }))
                    }
                    className="w-16 rounded-xl border border-[#e4d7c5] px-2 py-1 text-sm"
                    inputMode="numeric"
                  />
                </div>
              </div>
            ))}
            {selectedVariants.length === 0 ? (
              <div className="bg-white px-4 py-8 text-center text-sm text-[#6b645a]">
                {ready ? "没有可打印的规格" : "正在读取..."}
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-[#f0c7b3] bg-[#fff1ea] px-4 py-3 text-sm text-[#b14d2a]">
              {error}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleGenerate()}
              className="rounded-2xl bg-[#1f1811] px-6 py-3 text-sm font-semibold text-white"
            >
              生成标签
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={totalLabels === 0}
              className="rounded-2xl bg-[#a7652d] px-6 py-3 text-sm font-semibold text-white disabled:bg-[#bdb5a8]"
            >
              打印（{totalLabels} 张）
            </button>
          </div>

          <p className="mt-3 text-xs text-[#8a8073]">
            打印时请在浏览器的打印设置里把「边距」设为无、关闭「页眉页脚」，
            纸张选择你的标签纸尺寸。
          </p>
        </div>
      </div>

      <div
        className={`label-sheet mx-auto flex w-full flex-wrap ${
          isA4 ? "max-w-4xl gap-2" : "max-w-4xl gap-2"
        }`}
      >
        {labels.map((label) => (
          <div
            key={label.key}
            className="label flex items-center gap-2 overflow-hidden border border-dashed border-[#d9d2c6] bg-white p-1"
            style={{ width: `${size.w}mm`, height: `${size.h}mm` }}
          >
            <img
              src={label.qr}
              alt={label.barcode}
              style={{
                width: `${Math.min(size.h - 6, 22)}mm`,
                height: `${Math.min(size.h - 6, 22)}mm`,
              }}
            />
            <div className="min-w-0 flex-1 leading-tight">
              {showShopName && shopName ? (
                <div style={{ fontSize: "5pt" }} className="truncate text-[#6b645a]">
                  {shopName}
                </div>
              ) : null}
              <div style={{ fontSize: "7pt" }} className="truncate font-semibold">
                {label.productName}
              </div>
              <div style={{ fontSize: "6pt" }} className="truncate">
                {label.baseCode}
              </div>
              <div style={{ fontSize: "6pt" }} className="truncate">
                {label.color} / {label.size}
              </div>
              {showPrice ? (
                <div style={{ fontSize: "8pt" }} className="font-semibold">
                  ¥{label.salePrice.toFixed(2)}
                </div>
              ) : null}
              <div style={{ fontSize: "6pt" }} className="tracking-wider">
                {label.barcode}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LabelsPrintPage() {
  return (
    <Suspense fallback={null}>
      <LabelsPrintInner />
    </Suspense>
  );
}
