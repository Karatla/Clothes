"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/app/components/app-header";
import SizeManager from "@/app/components/size-manager";
import { apiFetch } from "@/lib/api";

type Variant = {
  id: string;
  color: string;
  size: string;
  sku: string;
};

type Product = {
  id: string;
  name: string;
  baseCode: string;
  variants: Variant[];
};

type Size = {
  id: string;
  name: string;
  isActive: boolean;
};

export default function StockInPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sizeOptions, setSizeOptions] = useState<Size[]>([]);
  const [showSizeManager, setShowSizeManager] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSizes = async () => {
    const data = await apiFetch<Size[]>("/sizes?active=true");
    setSizeOptions(data);
  };

  const loadProducts = async () => {
    const data = await apiFetch<Product[]>("/products");
    setProducts(data);
    if (data.length > 0) {
      setProductId(data[0].id);
    }
  };

  useEffect(() => {
    Promise.all([loadProducts(), loadSizes()]).catch(() => null);
  }, []);

  const selectedProduct = products.find((product) => product.id === productId);

  const colors = useMemo(() => {
    const set = new Set<string>();
    selectedProduct?.variants.forEach((variant) => set.add(variant.color));
    return Array.from(set);
  }, [selectedProduct]);

  const sizes = useMemo(() => {
    const set = new Set<string>();
    selectedProduct?.variants
      .filter((variant) => (color ? variant.color === color : true))
      .forEach((variant) => set.add(variant.size));
    const order = sizeOptions.map((size) => size.name);
    return Array.from(set).sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [selectedProduct, color, sizeOptions]);

  const variantId = selectedProduct?.variants.find(
    (variant) => variant.color === color && variant.size === size,
  )?.id;

  const handleSubmit = async () => {
    setError(null);
    setMessage(null);

    if (!variantId) {
      setError("请选择颜色和尺码");
      return;
    }

    const qtyValue = Number(qty);
    const costValue = unitCost ? Number(unitCost) : null;

    if (!qtyValue || qtyValue <= 0) {
      setError("入库数量必须大于 0");
      return;
    }

    await apiFetch("/stock/movements", {
      method: "POST",
      body: JSON.stringify({
        variantId,
        type: "IN",
        qty: qtyValue,
        unitCost: costValue,
        note: note.trim() || null,
      }),
    });

    setQty("");
    setUnitCost("");
    setNote("");
    setMessage("入库成功，库存已更新");
  };

  return (
    <div className="min-h-screen px-6 py-12">
      <SizeManager
        open={showSizeManager}
        onClose={() => setShowSizeManager(false)}
        onUpdated={loadSizes}
      />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <AppHeader
          label="进货入库"
          title="新增库存记录"
          description="选择商品颜色尺码，填写入库数量与成本。"
        />

        <section className="rounded-3xl bg-white/90 p-8 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-[#6b645a]">
              商品
              <select
                value={productId ?? ""}
                onChange={(event) => {
                  setProductId(event.target.value);
                  setColor("");
                  setSize("");
                }}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.baseCode})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-[#6b645a]">
              颜色
              <select
                value={color}
                onChange={(event) => {
                  setColor(event.target.value);
                  setSize("");
                }}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
              >
                <option value="">请选择颜色</option>
                {colors.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-[#6b645a]">
              尺码
              <div className="flex gap-2">
                <select
                  value={size}
                  onChange={(event) => setSize(event.target.value)}
                  className="flex-1 rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
                >
                  <option value="">请选择尺码</option>
                  {sizes.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowSizeManager(true)}
                  className="rounded-2xl border border-[#e4d7c5] px-4 text-sm text-[#6b645a]"
                >
                  管理
                </button>
              </div>
            </label>
            <label className="space-y-2 text-sm text-[#6b645a]">
              入库数量
              <input
                value={qty}
                onChange={(event) => setQty(event.target.value)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
                placeholder="请输入数量"
              />
            </label>
            <label className="space-y-2 text-sm text-[#6b645a]">
              单位成本（可选）
              <input
                value={unitCost}
                onChange={(event) => setUnitCost(event.target.value)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
                placeholder="如：300"
              />
            </label>
            <label className="space-y-2 text-sm text-[#6b645a]">
              备注（可选）
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
                placeholder="如：补货"
              />
            </label>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-[#f0c7b3] bg-[#fff1ea] px-4 py-3 text-sm text-[#b14d2a]">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="mt-6 rounded-2xl border border-[#c9e2c8] bg-[#f1fff1] px-4 py-3 text-sm text-[#386641]">
              {message}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleSubmit}
            className="mt-6 w-full rounded-2xl bg-[#1f1811] px-4 py-3 text-base font-semibold text-white"
          >
            保存入库
          </button>
        </section>
      </div>
    </div>
  );
}
