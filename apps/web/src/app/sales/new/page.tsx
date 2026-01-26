"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/app/components/app-header";
import SizeManager from "@/app/components/size-manager";
import { apiFetch } from "@/lib/api";
import { makeId } from "@/lib/id";

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

type LineItem = {
  id: string;
  productId: string;
  color: string;
  size: string;
  qty: string;
  price: string;
};

const createItem = (productId: string) => ({
  id: makeId(),
  productId,
  color: "",
  size: "",
  qty: "",
  price: "",
});

const toLocalDateTime = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

export default function SalesCreatePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sizeOptions, setSizeOptions] = useState<Size[]>([]);
  const [showSizeManager, setShowSizeManager] = useState(false);
  const [items, setItems] = useState<LineItem[]>([]);
  const [soldAt, setSoldAt] = useState(toLocalDateTime(new Date()));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<Product[]>("/products"),
      apiFetch<Size[]>("/sizes?active=true"),
    ])
      .then(([data, sizes]) => {
        setProducts(data);
        setSizeOptions(sizes);
        if (data.length > 0) {
          setItems([createItem(data[0].id)]);
        }
      })
      .catch(() => null);
  }, []);

  const totals = useMemo(() => {
    return items.reduce((sum, item) => {
      const qty = Number(item.qty) || 0;
      const price = Number(item.price) || 0;
      return sum + qty * price;
    }, 0);
  }, [items]);

  const updateItem = (id: string, patch: Partial<LineItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const handleAdd = () => {
    if (products.length === 0) return;
    setItems((prev) => [...prev, createItem(products[0].id)]);
  };

  const handleRemove = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = async () => {
    setError(null);
    setMessage(null);

    if (items.length === 0) {
      setError("请添加销售明细");
      return;
    }

    const payloadItems = items
      .map((item) => {
        const product = products.find((p) => p.id === item.productId);
        const variant = product?.variants.find(
          (v) => v.color === item.color && v.size === item.size,
        );
        return {
          variantId: variant?.id,
          qty: Number(item.qty),
          unitPrice: Number(item.price),
        };
      })
      .filter((item) => item.variantId && item.qty && item.unitPrice);

    if (payloadItems.length === 0) {
      setError("请完善销售明细");
      return;
    }

    await apiFetch("/sales", {
      method: "POST",
      body: JSON.stringify({
        soldAt: new Date(soldAt).toISOString(),
        note: note.trim() || null,
        items: payloadItems,
      }),
    });

    setMessage("销售记录已保存");
    setNote("");
    setItems((prev) => (prev.length ? [createItem(prev[0].productId)] : []));
  };

  return (
    <div className="min-h-screen px-6 py-12">
      <SizeManager
        open={showSizeManager}
        onClose={() => setShowSizeManager(false)}
        onUpdated={() =>
          apiFetch<Size[]>("/sizes?active=true").then(setSizeOptions)
        }
      />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <AppHeader
          label="销售开单"
          title="快速销售录入"
          description="填写颜色尺码与自定义单价，系统自动扣减库存。"
        />

        <section className="rounded-3xl bg-white/90 p-8 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-[#6b645a]">
              销售日期
              <input
                type="datetime-local"
                value={soldAt}
                onChange={(event) => setSoldAt(event.target.value)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
              />
            </label>
            <label className="space-y-2 text-sm text-[#6b645a]">
              备注
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
                placeholder="可选"
              />
            </label>
          </div>

          <div className="mt-6 space-y-4">
            {items.map((item, index) => {
              const product = products.find((p) => p.id === item.productId);
              const colors = Array.from(
                new Set(product?.variants.map((v) => v.color) ?? []),
              );
              const sizes = Array.from(
                new Set(
                  (product?.variants ?? [])
                    .filter((v) => (item.color ? v.color === item.color : true))
                    .map((v) => v.size),
                ),
              ).sort((a, b) => {
                const order = sizeOptions.map((size) => size.name);
                const ai = order.indexOf(a);
                const bi = order.indexOf(b);
                if (ai === -1 && bi === -1) return a.localeCompare(b);
                if (ai === -1) return 1;
                if (bi === -1) return -1;
                return ai - bi;
              });

              return (
                <div
                  key={item.id}
                  className="rounded-3xl border border-[#eadfce] bg-[#fbf7f0] p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#1f1811]">
                      明细 {index + 1}
                    </p>
                    {items.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => handleRemove(item.id)}
                        className="text-xs text-[#b14d2a]"
                      >
                        删除
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-6">
                    <select
                      value={item.productId}
                      onChange={(event) =>
                        updateItem(item.id, {
                          productId: event.target.value,
                          color: "",
                          size: "",
                        })
                      }
                      className="rounded-2xl border border-[#e4d7c5] px-3 py-2 text-sm"
                    >
                      {products.map((productItem) => (
                        <option key={productItem.id} value={productItem.id}>
                          {productItem.name} ({productItem.baseCode})
                        </option>
                      ))}
                    </select>
                    <select
                      value={item.color}
                      onChange={(event) =>
                        updateItem(item.id, {
                          color: event.target.value,
                          size: "",
                        })
                      }
                      className="rounded-2xl border border-[#e4d7c5] px-3 py-2 text-sm"
                    >
                      <option value="">颜色</option>
                      {colors.map((color) => (
                        <option key={color} value={color}>
                          {color}
                        </option>
                      ))}
                    </select>
                    <select
                      value={item.size}
                      onChange={(event) =>
                        updateItem(item.id, { size: event.target.value })
                      }
                      className="rounded-2xl border border-[#e4d7c5] px-3 py-2 text-sm"
                    >
                      <option value="">尺码</option>
                      {sizes.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowSizeManager(true)}
                      className="rounded-2xl border border-[#e4d7c5] px-3 py-2 text-xs text-[#6b645a]"
                    >
                      管理尺码
                    </button>
                    <input
                      value={item.qty}
                      onChange={(event) =>
                        updateItem(item.id, { qty: event.target.value })
                      }
                      className="rounded-2xl border border-[#e4d7c5] px-3 py-2 text-sm"
                      placeholder="数量"
                    />
                    <input
                      value={item.price}
                      onChange={(event) =>
                        updateItem(item.id, { price: event.target.value })
                      }
                      className="rounded-2xl border border-[#e4d7c5] px-3 py-2 text-sm"
                      placeholder="单价"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={handleAdd}
              className="rounded-2xl border border-[#e4d7c5] bg-white px-4 py-2 text-sm"
            >
              添加明细
            </button>
            <div className="text-sm font-semibold text-[#1f1811]">
              总金额 ¥{totals.toFixed(2)}
            </div>
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
            保存销售
          </button>
        </section>
      </div>
    </div>
  );
}
