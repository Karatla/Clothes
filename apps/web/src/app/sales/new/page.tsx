"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/app/components/app-header";
import SearchableSelect from "@/app/components/searchable-select";
import BarcodeScanner from "@/app/components/barcode-scanner";
import { apiFetch } from "@/lib/api";
import { makeId } from "@/lib/id";

type Variant = {
  id: string;
  color: string;
  size: string;
  sku: string;
  salePrice: number;
  currentQty: number;
};

type Product = {
  id: string;
  name: string;
  baseCode: string;
  tags?: string[] | null;
  variants: Variant[];
};

type Size = {
  id: string;
  name: string;
  isActive: boolean;
};

type ScanResult = {
  variantId: string;
  productId: string;
  product: { id: string; name: string; baseCode: string };
  color: string;
  size: string;
  salePrice: number;
  currentQty: number;
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
  const [items, setItems] = useState<LineItem[]>([]);
  const [soldAt, setSoldAt] = useState(toLocalDateTime(new Date()));
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("现金");
  const [received, setReceived] = useState("");
  const [savedSaleId, setSavedSaleId] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
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

  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        value: product.id,
        label: `${product.name} (${product.baseCode})`,
        keywords: (product.tags ?? []).join(" "),
      })),
    [products],
  );

  const getVariant = (item: LineItem) => {
    const product = products.find((p) => p.id === item.productId);
    return product?.variants.find(
      (variant) => variant.color === item.color && variant.size === item.size,
    );
  };

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

  /** 扫码：已在单子里就数量 +1，否则新增一行并带出售价 */
  const handleScan = async (code: string) => {
    setError(null);
    try {
      const found = await apiFetch<ScanResult>(
        `/variants/by-barcode/${encodeURIComponent(code)}`,
      );

      if (found.salePrice <= 0) {
        setScanMessage(
          `${found.product.name} ${found.color}/${found.size} 未设置售价，请先设置`,
        );
        return;
      }

      let added = false;
      setItems((prev) => {
        const index = prev.findIndex(
          (item) =>
            item.productId === found.productId &&
            item.color === found.color &&
            item.size === found.size,
        );

        if (index >= 0) {
          added = true;
          return prev.map((item, i) =>
            i === index
              ? { ...item, qty: String((Number(item.qty) || 0) + 1) }
              : item,
          );
        }

        const blank = prev.find(
          (item) => !item.color && !item.size && !item.qty && !item.price,
        );
        const next: LineItem = {
          id: blank?.id ?? makeId(),
          productId: found.productId,
          color: found.color,
          size: found.size,
          qty: "1",
          price: String(found.salePrice),
        };
        added = true;
        return blank
          ? prev.map((item) => (item.id === blank.id ? next : item))
          : [...prev, next];
      });

      if (added) {
        setScanMessage(
          `已添加 ${found.product.name} ${found.color}/${found.size}，剩余库存 ${found.currentQty}`,
        );
      }
    } catch (err) {
      setScanMessage(err instanceof Error ? err.message : "扫码失败");
    }
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
        const variant = getVariant(item);
        const qtyValue = item.qty === "" ? Number.NaN : Number(item.qty);
        const priceValue = item.price === "" ? Number.NaN : Number(item.price);
        return {
          variantId: variant?.id,
          qty: qtyValue,
          unitPrice: priceValue,
        };
      })
      .filter(
        (item) =>
          item.variantId && item.qty > 0 && Number.isFinite(item.unitPrice),
      );

    if (payloadItems.length !== items.length) {
      setError("请完善每一条销售明细");
      return;
    }

    const exceededItem = items.find((item) => {
      const variant = getVariant(item);
      const qtyValue = Number(item.qty) || 0;
      return variant && qtyValue > variant.currentQty;
    });

    if (exceededItem) {
      setError("销售数量不能超过剩余库存");
      return;
    }

    const receivedValue = received.trim() === "" ? null : Number(received);
    if (receivedValue !== null && !Number.isFinite(receivedValue)) {
      setError("实收金额必须是数字");
      return;
    }
    if (receivedValue !== null && receivedValue < totals) {
      setError("实收金额不能少于应收金额");
      return;
    }

    try {
      const saved = await apiFetch<{ id: string; saleNo: string }>("/sales", {
        method: "POST",
        body: JSON.stringify({
          soldAt: new Date(soldAt).toISOString(),
          note: note.trim() || null,
          paymentMethod,
          receivedAmount: receivedValue,
          items: payloadItems,
        }),
      });

      setSavedSaleId(saved?.id ?? null);
      setMessage(`销售记录已保存${saved?.saleNo ? `，单号 ${saved.saleNo}` : ""}`);
      setNote("");
      setReceived("");
      setScanMessage(null);
      setItems((prev) => (prev.length ? [createItem(prev[0].productId)] : []));
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  };

  return (
    <div className="min-h-screen px-6 py-12">
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => void handleScan(code)}
        title="扫码开单"
      />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <AppHeader
          label="销售开单"
          title="快速销售录入"
          description="填写颜色尺码与自定义单价，系统自动扣减库存。"
        />

        <section className="rounded-3xl bg-white/90 p-6 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setScanMessage(null);
                setScannerOpen(true);
              }}
              className="rounded-2xl bg-[#a7652d] px-6 py-3 text-base font-semibold text-white"
            >
              扫码开单
            </button>
            <input
              onKeyDown={(event) => {
                // 扫码枪就是一个键盘：扫完自动回车
                if (event.key === "Enter") {
                  const target = event.currentTarget;
                  void handleScan(target.value);
                  target.value = "";
                }
              }}
              className="min-w-[16rem] flex-1 rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
              placeholder="或用扫码枪扫这里 / 手动输入编号后回车"
              inputMode="numeric"
            />
          </div>
          {scanMessage ? (
            <div className="mt-3 rounded-2xl border border-[#eadfce] bg-[#fbf7f0] px-4 py-2 text-sm text-[#6b645a]">
              {scanMessage}
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl bg-white/90 p-8 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
          <div className="grid gap-4 md:grid-cols-3">
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
              const selectedVariant = getVariant(item);
              const qtyValue = Number(item.qty) || 0;
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
                    <SearchableSelect
                      value={item.productId}
                      onChange={(value) =>
                        updateItem(item.id, {
                          productId: value,
                          color: "",
                          size: "",
                        })
                      }
                      options={productOptions}
                      placeholder="请选择商品"
                      searchPlaceholder="按名称 / 款号 / 标签搜索"
                      emptyText="没有匹配的商品"
                    />
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
                      onChange={(event) => {
                        const size = event.target.value;
                        const matched = product?.variants.find(
                          (v) => v.color === item.color && v.size === size,
                        );
                        updateItem(item.id, {
                          size,
                          // 自动带出售价，未设置售价的规格留空并提示
                          price:
                            matched && matched.salePrice > 0
                              ? String(matched.salePrice)
                              : "",
                        });
                      }}
                      className="rounded-2xl border border-[#e4d7c5] px-3 py-2 text-sm"
                    >
                      <option value="">尺码</option>
                      {sizes.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                    <input
                      value={item.qty}
                      onChange={(event) =>
                        updateItem(item.id, { qty: event.target.value })
                      }
                      className={`rounded-2xl border px-3 py-2 text-sm ${selectedVariant && qtyValue > selectedVariant.currentQty ? "border-[#d96b48] bg-[#fff3ee]" : "border-[#e4d7c5]"}`}
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
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[#8a8073]">
                    <span>
                      剩余库存 {selectedVariant ? selectedVariant.currentQty : "请选择颜色和尺码"}
                    </span>
                    {selectedVariant && qtyValue > selectedVariant.currentQty ? (
                      <span className="text-[#b14d2a]">输入数量超过剩余库存</span>
                    ) : null}
                    {selectedVariant && selectedVariant.salePrice <= 0 ? (
                      <span className="text-[#b14d2a]">
                        该规格未设置售价，
                        <a
                          href={`/products/${item.productId}`}
                          className="underline"
                        >
                          去设置
                        </a>
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 grid gap-4 rounded-2xl border border-[#eadfce] bg-[#fbf7f0] p-4 md:grid-cols-4">
            <label className="space-y-2 text-sm text-[#6b645a]">
              收款方式
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
              >
                {["现金", "微信", "支付宝", "银行卡", "其他"].map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-[#6b645a]">
              应收金额
              <div className="rounded-2xl border border-[#e4d7c5] bg-white px-4 py-3 text-base font-semibold text-[#1f1811]">
                ¥{totals.toFixed(2)}
              </div>
            </label>
            <label className="space-y-2 text-sm text-[#6b645a]">
              实收（可留空）
              <input
                value={received}
                onChange={(event) => setReceived(event.target.value)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
                placeholder="如：100"
                inputMode="decimal"
              />
            </label>
            <label className="space-y-2 text-sm text-[#6b645a]">
              找零
              <div className="rounded-2xl border border-[#e4d7c5] bg-white px-4 py-3 text-base font-semibold text-[#1f1811]">
                {received.trim() === "" || !Number.isFinite(Number(received))
                  ? "-"
                  : `¥${Math.max(0, Number(received) - totals).toFixed(2)}`}
              </div>
            </label>
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
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#c9e2c8] bg-[#f1fff1] px-4 py-3 text-sm text-[#386641]">
              <span>{message}</span>
              {savedSaleId ? (
                <a
                  href={`/sales/${savedSaleId}/receipt`}
                  className="rounded-2xl bg-[#a7652d] px-4 py-2 text-sm font-semibold text-white"
                >
                  打印小票
                </a>
              ) : null}
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
