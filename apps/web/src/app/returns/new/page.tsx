"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/app/components/app-header";
import { apiFetch } from "@/lib/api";

type SaleItem = {
  id: string;
  qty: number;
  unitPrice: number;
  variant: {
    id: string;
    color: string;
    size: string;
    product?: { name: string; baseCode: string } | null;
  } | null;
};

type Sale = {
  id: string;
  saleNo: string;
  soldAt: string;
  items: SaleItem[];
};

type ReturnItem = {
  variantId: string;
  qty: number;
  unitPrice: number;
};

type ReturnRecord = {
  id: string;
  saleId: string;
  items: Array<{ variantId: string; qty: number }>;
};

type Product = {
  id: string;
  name: string;
  baseCode: string;
  variants: Array<{ id: string; color: string; size: string }>;
};

type ExchangeItem = {
  id: string;
  productId: string;
  color: string;
  size: string;
  qty: string;
  price: string;
};

const createExchangeItem = (productId: string) => ({
  id: crypto.randomUUID(),
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

export default function ReturnsPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [saleId, setSaleId] = useState<string | null>(null);
  const [returnedAt, setReturnedAt] = useState(toLocalDateTime(new Date()));
  const [note, setNote] = useState("");
  const [refundPrices, setRefundPrices] = useState<Record<string, string>>({});
  const [refundQty, setRefundQty] = useState<Record<string, string>>({});
  const [exchangeItems, setExchangeItems] = useState<ExchangeItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<Sale[]>("/sales"),
      apiFetch<ReturnRecord[]>("/returns"),
      apiFetch<Product[]>("/products"),
    ])
      .then(([salesData, returnData, productData]) => {
        setSales(salesData);
        setReturns(returnData);
        setProducts(productData);
        if (salesData.length > 0) {
          setSaleId(salesData[0].id);
        }
        if (productData.length > 0) {
          setExchangeItems([createExchangeItem(productData[0].id)]);
        }
      })
      .catch(() => null);
  }, []);

  const selectedSale = sales.find((sale) => sale.id === saleId);

  const remainingMap = useMemo(() => {
    const totals: Record<string, number> = {};
    selectedSale?.items.forEach((item) => {
      if (!item.variant) return;
      totals[item.variant.id] = (totals[item.variant.id] ?? 0) + item.qty;
    });

    returns
      .filter((record) => record.saleId === saleId)
      .forEach((record) => {
        record.items.forEach((item) => {
          totals[item.variantId] = (totals[item.variantId] ?? 0) - item.qty;
        });
      });

    return totals;
  }, [selectedSale, returns, saleId]);

  const refundTotal = useMemo(() => {
    return selectedSale?.items.reduce((sum, item) => {
      if (!item.variant) return sum;
      const qty = Number(refundQty[item.variant.id] ?? 0) || 0;
      const price = Number(refundPrices[item.variant.id] ?? item.unitPrice) || 0;
      return sum + qty * price;
    }, 0) ?? 0;
  }, [selectedSale, refundQty, refundPrices]);

  const exchangeTotal = useMemo(() => {
    return exchangeItems.reduce((sum, item) => {
      const qty = Number(item.qty) || 0;
      const price = Number(item.price) || 0;
      return sum + qty * price;
    }, 0);
  }, [exchangeItems]);

  const updateExchangeItem = (id: string, patch: Partial<ExchangeItem>) => {
    setExchangeItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const handleAddExchange = () => {
    if (products.length === 0) return;
    setExchangeItems((prev) => [...prev, createExchangeItem(products[0].id)]);
  };

  const handleRemoveExchange = (id: string) => {
    setExchangeItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = async () => {
    setError(null);
    setMessage(null);

    if (!selectedSale) {
      setError("请选择销售记录");
      return;
    }

    const returnItems: ReturnItem[] = [];
    selectedSale.items.forEach((item) => {
      if (!item.variant) return;
      const qty = Number(refundQty[item.variant.id] ?? 0) || 0;
      const price = Number(refundPrices[item.variant.id] ?? item.unitPrice) || 0;
      if (qty > 0 && price > 0) {
        returnItems.push({ variantId: item.variant.id, qty, unitPrice: price });
      }
    });

    if (returnItems.length === 0) {
      setError("请填写退货数量");
      return;
    }

    await apiFetch("/returns", {
      method: "POST",
      body: JSON.stringify({
        saleId: selectedSale.id,
        returnedAt: new Date(returnedAt).toISOString(),
        note: note.trim() || null,
        items: returnItems,
      }),
    });

    const exchangePayload = exchangeItems
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

    if (exchangePayload.length > 0) {
      await apiFetch("/sales", {
        method: "POST",
        body: JSON.stringify({
          soldAt: new Date(returnedAt).toISOString(),
          note: "换货销售",
          items: exchangePayload,
        }),
      });
    }

    setMessage("退货记录已保存");
    setRefundPrices({});
    setRefundQty({});
  };

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <AppHeader
          label="退换货"
          title="退货与换货处理"
          description="可选销售记录，填写退货与换货内容。"
        />

        <section className="rounded-3xl bg-white/90 p-8 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-[#6b645a]">
              销售记录
              <select
                value={saleId ?? ""}
                onChange={(event) => setSaleId(event.target.value)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
              >
                {sales.map((sale) => (
                  <option key={sale.id} value={sale.id}>
                    {sale.saleNo}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-[#6b645a]">
              退货日期
              <input
                type="datetime-local"
                value={returnedAt}
                onChange={(event) => setReturnedAt(event.target.value)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
              />
            </label>
          </div>

          <div className="mt-6 space-y-4">
            <p className="text-sm font-semibold text-[#1f1811]">退货明细</p>
            {selectedSale?.items.map((item) => {
              const variant = item.variant;
              if (!variant) return null;
              const remaining = remainingMap[variant.id] ?? 0;
              return (
                <div
                  key={item.id}
                  className="grid gap-3 rounded-2xl border border-[#eadfce] bg-[#fbf7f0] px-4 py-3 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]"
                >
                  <div className="text-sm text-[#6b645a]">
                    {variant.product
                      ? `${variant.product.name} (${variant.product.baseCode})`
                      : "-"}
                    <div className="text-xs text-[#8a8073]">
                      {variant.color} / {variant.size}
                    </div>
                  </div>
                  <div className="text-sm text-[#6b645a]">
                    可退 {remaining}
                  </div>
                  <input
                    value={refundQty[variant.id] ?? ""}
                    onChange={(event) =>
                      setRefundQty((prev) => ({
                        ...prev,
                        [variant.id]: event.target.value,
                      }))
                    }
                    className="rounded-xl border border-[#e4d7c5] px-3 py-2 text-sm"
                    placeholder="退货数量"
                  />
                  <input
                    value={refundPrices[variant.id] ?? item.unitPrice}
                    onChange={(event) =>
                      setRefundPrices((prev) => ({
                        ...prev,
                        [variant.id]: event.target.value,
                      }))
                    }
                    className="rounded-xl border border-[#e4d7c5] px-3 py-2 text-sm"
                    placeholder="退款单价"
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-8 space-y-4">
            <p className="text-sm font-semibold text-[#1f1811]">换货明细（可选）</p>
            {exchangeItems.map((item) => {
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
              );

              return (
                <div
                  key={item.id}
                  className="grid gap-3 rounded-2xl border border-[#eadfce] bg-white px-4 py-3 md:grid-cols-5"
                >
                  <select
                    value={item.productId}
                    onChange={(event) =>
                      updateExchangeItem(item.id, {
                        productId: event.target.value,
                        color: "",
                        size: "",
                      })
                    }
                    className="rounded-xl border border-[#e4d7c5] px-3 py-2 text-sm"
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
                      updateExchangeItem(item.id, {
                        color: event.target.value,
                        size: "",
                      })
                    }
                    className="rounded-xl border border-[#e4d7c5] px-3 py-2 text-sm"
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
                      updateExchangeItem(item.id, { size: event.target.value })
                    }
                    className="rounded-xl border border-[#e4d7c5] px-3 py-2 text-sm"
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
                      updateExchangeItem(item.id, { qty: event.target.value })
                    }
                    className="rounded-xl border border-[#e4d7c5] px-3 py-2 text-sm"
                    placeholder="数量"
                  />
                  <input
                    value={item.price}
                    onChange={(event) =>
                      updateExchangeItem(item.id, { price: event.target.value })
                    }
                    className="rounded-xl border border-[#e4d7c5] px-3 py-2 text-sm"
                    placeholder="单价"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveExchange(item.id)}
                    className="text-xs text-[#b14d2a]"
                  >
                    删除
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={handleAddExchange}
              className="rounded-2xl border border-[#e4d7c5] bg-white px-4 py-2 text-sm"
            >
              添加换货明细
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-sm text-[#6b645a]">
            <div>退款金额 ¥{refundTotal.toFixed(2)}</div>
            <div>换货金额 ¥{exchangeTotal.toFixed(2)}</div>
            <div>差额 ¥{(exchangeTotal - refundTotal).toFixed(2)}</div>
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
            保存退货/换货
          </button>
        </section>
      </div>
    </div>
  );
}
