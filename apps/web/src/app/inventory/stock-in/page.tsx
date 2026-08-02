"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/app/components/app-header";
import SizeManager from "@/app/components/size-manager";
import SearchableSelect from "@/app/components/searchable-select";
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
  tags?: string[] | null;
  variants: Variant[];
};

type PurchaseOrderItem = {
  variantId: string;
  color: string;
  size: string;
  sku: string;
  inQty: number;
  unitCost: number;
  returnedQty: number;
  currentQty: number;
  returnableQty: number;
};

type PurchaseOrder = {
  id: string;
  orderNo: string;
  productId: string;
  product?: { id: string; name: string; baseCode: string } | null;
  note: string | null;
  occurredAt: string;
  totalQty: number;
  totalCost: number;
  returnedQty: number;
  returnableQty: number;
  items: PurchaseOrderItem[];
};

type Size = {
  id: string;
  name: string;
  isActive: boolean;
};

type Cell = {
  qty: string;
  cost: string;
};

type ColorRow = {
  id: string;
  color: string;
  /** 该颜色所有尺码统一的售价，留空表示不改动已有售价 */
  salePrice: string;
  cells: Record<string, Cell>;
};

const emptyCell = (): Cell => ({ qty: "", cost: "" });

const buildCells = (sizes: string[], existing?: Record<string, Cell>) =>
  sizes.reduce((acc, size) => {
    acc[size] = existing?.[size] ?? emptyCell();
    return acc;
  }, {} as Record<string, Cell>);

const createRow = (sizes: string[]): ColorRow => ({
  id: makeId(),
  color: "",
  salePrice: "",
  cells: buildCells(sizes),
});

const toLocalDateTime = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

export default function StockInPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sizeOptions, setSizeOptions] = useState<Size[]>([]);
  const [showSizeManager, setShowSizeManager] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [rows, setRows] = useState<ColorRow[]>([]);
  const [note, setNote] = useState("");
  const [newSizeName, setNewSizeName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastStockInProductId, setLastStockInProductId] = useState<string | null>(
    null,
  );

  // 进货退货
  const [returnProductId, setReturnProductId] = useState<string | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderStart, setOrderStart] = useState("");
  const [orderEnd, setOrderEnd] = useState("");
  const [returnQty, setReturnQty] = useState<Record<string, string>>({});
  const [returnedAt, setReturnedAt] = useState(toLocalDateTime(new Date()));
  const [returnNote, setReturnNote] = useState("");
  const [returnMessage, setReturnMessage] = useState<string | null>(null);
  const [returnError, setReturnError] = useState<string | null>(null);

  const sizeNames = sizeOptions.map((size) => size.name);

  const loadSizes = async () => {
    const data = await apiFetch<Size[]>("/sizes?active=true");
    setSizeOptions(data);
  };

  const loadProducts = async () => {
    const data = await apiFetch<Product[]>("/products");
    setProducts(data);
    if (data.length > 0) {
      setProductId((prev) => prev ?? data[0].id);
      setReturnProductId((prev) => prev ?? data[0].id);
    }
  };

  const loadOrders = async (targetProductId: string | null) => {
    if (!targetProductId) {
      setOrders([]);
      return;
    }
    const data = await apiFetch<PurchaseOrder[]>(
      `/purchase/orders?productId=${encodeURIComponent(targetProductId)}`,
    );
    setOrders(data);
  };

  useEffect(() => {
    Promise.all([loadProducts(), loadSizes()]).catch(() => null);
  }, []);

  useEffect(() => {
    setOrderId(null);
    setReturnQty({});
    loadOrders(returnProductId).catch(() => null);
  }, [returnProductId]);

  useEffect(() => {
    if (sizeNames.length === 0) {
      setRows((prev) => (prev.length ? prev : []));
      return;
    }
    setRows((prev) => {
      if (prev.length === 0) {
        return [createRow(sizeNames)];
      }
      return prev.map((row) => ({
        ...row,
        cells: buildCells(sizeNames, row.cells),
      }));
    });
  }, [sizeOptions]);

  const selectedProduct = products.find((product) => product.id === productId);

  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        value: product.id,
        label: `${product.name} (${product.baseCode})`,
        keywords: (product.tags ?? []).join(" "),
      })),
    [products],
  );

  const selectedOrder = orders.find((order) => order.id === orderId) ?? null;

  const orderOptions = useMemo(() => {
    const startTime = orderStart
      ? new Date(`${orderStart}T00:00:00`).getTime()
      : null;
    const endTime = orderEnd
      ? new Date(`${orderEnd}T23:59:59.999`).getTime()
      : null;

    return orders
      .filter((order) => {
        const time = new Date(order.occurredAt).getTime();
        if (startTime !== null && time < startTime) return false;
        if (endTime !== null && time > endTime) return false;
        return true;
      })
      .map((order) => ({
        value: order.id,
        label: order.orderNo,
        description: `${new Date(order.occurredAt).toLocaleString("zh-CN")} · 入库 ${
          order.totalQty
        } 件 · 可退 ${order.returnableQty} 件${order.note ? ` · ${order.note}` : ""}`,
        keywords: order.note ?? "",
      }));
  }, [orders, orderStart, orderEnd]);

  const returnTotals = useMemo(() => {
    if (!selectedOrder) {
      return { qty: 0, cost: 0 };
    }
    return selectedOrder.items.reduce(
      (acc, item) => {
        const qty = Number(returnQty[item.variantId]) || 0;
        acc.qty += qty;
        acc.cost += qty * item.unitCost;
        return acc;
      },
      { qty: 0, cost: 0 },
    );
  }, [selectedOrder, returnQty]);

  const existingColors = useMemo(() => {
    const colors = new Set<string>();
    selectedProduct?.variants.forEach((variant) => colors.add(variant.color));
    return Array.from(colors);
  }, [selectedProduct]);

  const handleRowChange = (
    rowId: string,
    size: string,
    field: keyof Cell,
    value: string,
  ) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              cells: {
                ...row.cells,
                [size]: { ...row.cells[size], [field]: value },
              },
            }
          : row,
      ),
    );
  };

  const handleRowColor = (rowId: string, value: string) => {
    setRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, color: value } : row)),
    );
  };

  const handleAddRow = () => {
    setRows((prev) => [...prev, createRow(sizeNames)]);
  };

  const handleRemoveRow = (rowId: string) => {
    setRows((prev) => prev.filter((row) => row.id !== rowId));
  };

  const handleAddSize = async () => {
    const name = newSizeName.trim();
    if (!name) {
      setError("请输入尺码名称");
      return;
    }

    setError(null);
    setMessage(null);

    try {
      await apiFetch("/sizes", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setNewSizeName("");
      await loadSizes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增尺码失败");
    }
  };

  const totals = useMemo(() => {
    let totalQty = 0;
    let totalCost = 0;
    const rowTotals = rows.map((row) => {
      let rowQty = 0;
      let rowCost = 0;
      sizeNames.forEach((size) => {
        const cell = row.cells[size];
        const qty = Number(cell?.qty) || 0;
        const cost = Number(cell?.cost) || 0;
        rowQty += qty;
        rowCost += qty * cost;
      });
      totalQty += rowQty;
      totalCost += rowCost;
      return { rowQty, rowCost };
    });
    return { totalQty, totalCost, rowTotals };
  }, [rows, sizeNames]);

  const handleSubmit = async () => {
    setError(null);
    setMessage(null);

    if (!productId) {
      setError("请选择商品");
      return;
    }

    const items: Array<{
      color: string;
      size: string;
      qty: number;
      unitCost: number;
      salePrice: number | null;
    }> = [];
    let missingCost = false;
    let badSalePrice = false;

    rows.forEach((row) => {
      const color = row.color.trim();
      if (!color) return;
      const rawSalePrice = row.salePrice.trim();
      let salePrice: number | null = null;
      if (rawSalePrice !== "") {
        const parsed = Number(rawSalePrice);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          badSalePrice = true;
        } else {
          salePrice = parsed;
        }
      }
      sizeNames.forEach((size) => {
        const cell = row.cells[size];
        const qty = Number(cell?.qty) || 0;
        if (qty <= 0) return;
        const costValue = Number(cell?.cost);
        if (!Number.isFinite(costValue)) {
          missingCost = true;
          return;
        }
        items.push({ color, size, qty, unitCost: costValue, salePrice });
      });
    });

    if (badSalePrice) {
      setError("售价必须大于 0，或者留空不修改");
      return;
    }

    if (items.length === 0) {
      setError("请至少填写一个入库数量与成本");
      return;
    }

    if (missingCost) {
      setError("请填写对应的入库成本");
      return;
    }

    try {
      await apiFetch("/stock/batch-in", {
        method: "POST",
        body: JSON.stringify({
          productId,
          note: note.trim() || null,
          items,
        }),
      });

      setRows((prev) =>
        prev.map((row) => ({
          ...row,
          cells: buildCells(sizeNames),
        })),
      );
      setNote("");
      setMessage("入库成功，库存已更新");
      setLastStockInProductId(productId);
      await loadProducts().catch(() => null);
      if (returnProductId === productId) {
        await loadOrders(returnProductId).catch(() => null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "入库失败");
    }
  };

  const handleReturnSubmit = async () => {
    setReturnError(null);
    setReturnMessage(null);

    if (!selectedOrder) {
      setReturnError("请选择进货订单");
      return;
    }

    const items = selectedOrder.items
      .map((item) => ({
        variantId: item.variantId,
        qty: Number(returnQty[item.variantId]) || 0,
        returnableQty: item.returnableQty,
        label: `${item.color} / ${item.size}`,
      }))
      .filter((item) => item.qty > 0);

    if (items.length === 0) {
      setReturnError("请填写退货数量");
      return;
    }

    const invalid = items.find((item) => item.qty > item.returnableQty);
    if (invalid) {
      setReturnError(
        `${invalid.label} 最多只能退 ${invalid.returnableQty} 件`,
      );
      return;
    }

    try {
      const result = await apiFetch<{ returnNo: string; totalQty: number }>(
        "/purchase/returns",
        {
          method: "POST",
          body: JSON.stringify({
            purchaseOrderId: selectedOrder.id,
            returnedAt: new Date(returnedAt).toISOString(),
            note: returnNote.trim() || null,
            items: items.map((item) => ({
              variantId: item.variantId,
              qty: item.qty,
            })),
          }),
        },
      );

      setReturnQty({});
      setReturnNote("");
      setReturnMessage(
        `退货成功，退货单号 ${result.returnNo}，共 ${result.totalQty} 件，库存已扣减`,
      );
      await Promise.all([
        loadOrders(returnProductId).catch(() => null),
        loadProducts().catch(() => null),
      ]);
    } catch (err) {
      setReturnError(err instanceof Error ? err.message : "退货失败");
    }
  };

  return (
    <div className="min-h-screen px-6 py-12">
      <SizeManager
        open={showSizeManager}
        onClose={() => setShowSizeManager(false)}
        onUpdated={loadSizes}
      />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <AppHeader
          label="进货入库"
          title="新增库存记录"
          description="按颜色与尺码录入数量与成本，支持新增颜色与尺码。"
        />

        <section className="rounded-3xl bg-white/90 p-8 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
          <div>
            <p className="text-lg font-semibold text-[#1f1811]">进货入库</p>
            <p className="mt-1 text-sm text-[#6b645a]">
              选择商品后按颜色与尺码填写数量与成本，保存后会生成一张进货订单。
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="space-y-2 text-sm text-[#6b645a]">
              商品
              <SearchableSelect
                value={productId}
                onChange={(value) => {
                  setProductId(value);
                  setRows([createRow(sizeNames)]);
                }}
                options={productOptions}
                placeholder="请选择商品"
                searchPlaceholder="按名称 / 款号 / 标签搜索"
                emptyText="没有匹配的商品"
              />
            </div>
            <label className="space-y-2 text-sm text-[#6b645a]">
              备注（可选）
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
                placeholder="如：补货"
              />
            </label>
            <label className="space-y-2 text-sm text-[#6b645a]">
              新增尺码
              <div className="flex gap-2">
                <input
                  value={newSizeName}
                  onChange={(event) => setNewSizeName(event.target.value)}
                  className="flex-1 rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
                  placeholder="如：XL"
                />
                <button
                  type="button"
                  onClick={handleAddSize}
                  className="rounded-2xl bg-[#1f1811] px-4 text-sm font-semibold text-white"
                >
                  添加
                </button>
              </div>
            </label>
            <label className="space-y-2 text-sm text-[#6b645a]">
              尺码管理
              <button
                type="button"
                onClick={() => setShowSizeManager(true)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-sm text-[#6b645a]"
              >
                管理尺码
              </button>
            </label>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-[#eadfce]">
            <div
              className="grid bg-[#f5efe6] text-sm font-semibold text-[#5c544b]"
              style={{
                gridTemplateColumns: `160px repeat(${sizeNames.length}, minmax(0, 1fr)) 140px`,
              }}
            >
              <div className="px-4 py-3">颜色</div>
              {sizeNames.map((size) => (
                <div key={size} className="px-4 py-3 text-center">
                  {size}
                </div>
              ))}
              <div className="px-4 py-3 text-center">行合计</div>
            </div>
            {rows.map((row, rowIndex) => (
              <div
                key={row.id}
                className="grid border-t border-[#eadfce] bg-white"
                style={{
                  gridTemplateColumns: `160px repeat(${sizeNames.length}, minmax(0, 1fr)) 140px`,
                }}
              >
                <div className="px-4 py-3">
                  <input
                    list="color-options"
                    value={row.color}
                    onChange={(event) =>
                      handleRowColor(row.id, event.target.value)
                    }
                    placeholder={rowIndex === 0 ? "如：黑色" : "颜色"}
                    className="w-full rounded-xl border border-[#e4d7c5] px-3 py-2 text-sm"
                  />
                  <input
                    value={row.salePrice}
                    onChange={(event) =>
                      setRows((prev) =>
                        prev.map((item) =>
                          item.id === row.id
                            ? { ...item, salePrice: event.target.value }
                            : item,
                        ),
                      )
                    }
                    placeholder="售价（选填）"
                    className="mt-2 w-full rounded-xl border border-[#e4d7c5] px-3 py-2 text-sm"
                  />
                  {rows.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(row.id)}
                      className="mt-2 text-xs text-[#b14d2a]"
                    >
                      删除颜色
                    </button>
                  ) : null}
                </div>
                {sizeNames.map((size) => (
                  <div key={`${row.id}-${size}`} className="px-3 py-3">
                    <div className="space-y-2">
                      <input
                        value={row.cells[size]?.qty ?? ""}
                        onChange={(event) =>
                          handleRowChange(row.id, size, "qty", event.target.value)
                        }
                        className="w-full rounded-xl border border-[#e4d7c5] px-2 py-1 text-xs"
                        placeholder="数量"
                      />
                      <input
                        value={row.cells[size]?.cost ?? ""}
                        onChange={(event) =>
                          handleRowChange(row.id, size, "cost", event.target.value)
                        }
                        className="w-full rounded-xl border border-[#e4d7c5] px-2 py-1 text-xs"
                        placeholder="成本"
                      />
                    </div>
                  </div>
                ))}
                <div className="flex flex-col items-center justify-center px-3 py-3 text-sm text-[#6b645a]">
                  <div>数量 {totals.rowTotals[rowIndex]?.rowQty ?? 0}</div>
                  <div>金额 {totals.rowTotals[rowIndex]?.rowCost ?? 0}</div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-[#eadfce] bg-[#f5efe6] px-4 py-3 text-sm font-semibold text-[#5c544b]">
              <button
                type="button"
                onClick={handleAddRow}
                className="rounded-2xl border border-[#e4d7c5] bg-white px-4 py-2 text-sm"
              >
                添加颜色
              </button>
              <div className="flex gap-6">
                <span>总数量 {totals.totalQty}</span>
                <span>总金额 {totals.totalCost}</span>
              </div>
            </div>
          </div>

          <datalist id="color-options">
            {existingColors.map((color) => (
              <option key={color} value={color} />
            ))}
          </datalist>

          {error ? (
            <div className="mt-6 rounded-2xl border border-[#f0c7b3] bg-[#fff1ea] px-4 py-3 text-sm text-[#b14d2a]">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#c9e2c8] bg-[#f1fff1] px-4 py-3 text-sm text-[#386641]">
              <span>{message}</span>
              {lastStockInProductId ? (
                <a
                  href={`/labels/print?productId=${lastStockInProductId}`}
                  className="rounded-2xl bg-[#a7652d] px-4 py-2 text-sm font-semibold text-white"
                >
                  打印本次入库标签
                </a>
              ) : null}
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

        <section className="rounded-3xl bg-white/90 p-8 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-[#1f1811]">进货退货</p>
              <p className="mt-1 text-sm text-[#6b645a]">
                先选商品，再选该商品对应的进货订单，按颜色尺码填写退货数量，库存与成本会自动回退。
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="space-y-2 text-sm text-[#6b645a]">
              商品
              <SearchableSelect
                value={returnProductId}
                onChange={setReturnProductId}
                options={productOptions}
                placeholder="请选择商品"
                searchPlaceholder="按名称 / 款号 / 标签搜索"
                emptyText="没有匹配的商品"
              />
            </div>
            <div className="space-y-2 text-sm text-[#6b645a]">
              进货订单
              <SearchableSelect
                value={orderId}
                onChange={(value) => {
                  setOrderId(value);
                  setReturnQty({});
                  setReturnMessage(null);
                  setReturnError(null);
                }}
                options={orderOptions}
                placeholder={
                  orders.length ? "请选择进货订单" : "该商品暂无进货订单"
                }
                searchPlaceholder="按进货单号 / 备注搜索"
                emptyText="没有匹配的进货订单"
                disabled={orders.length === 0}
                filters={
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-[#8a8073]">
                      开始日期
                      <input
                        type="date"
                        value={orderStart}
                        onChange={(event) => setOrderStart(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-[#e4d7c5] px-2 py-1 text-sm"
                      />
                    </label>
                    <label className="text-xs text-[#8a8073]">
                      结束日期
                      <input
                        type="date"
                        value={orderEnd}
                        onChange={(event) => setOrderEnd(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-[#e4d7c5] px-2 py-1 text-sm"
                      />
                    </label>
                  </div>
                }
              />
            </div>
            <label className="space-y-2 text-sm text-[#6b645a]">
              退货日期
              <input
                type="datetime-local"
                value={returnedAt}
                onChange={(event) => setReturnedAt(event.target.value)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
              />
            </label>
            <label className="space-y-2 text-sm text-[#6b645a] md:col-span-3">
              退货备注（可选）
              <input
                value={returnNote}
                onChange={(event) => setReturnNote(event.target.value)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
                placeholder="如：质量问题退厂"
              />
            </label>
          </div>

          {selectedOrder ? (
            <>
              <div className="mt-6 flex flex-wrap gap-6 rounded-2xl bg-[#fbf7f0] px-4 py-3 text-sm text-[#6b645a]">
                <span>单号 {selectedOrder.orderNo}</span>
                <span>
                  入库日期{" "}
                  {new Date(selectedOrder.occurredAt).toLocaleString("zh-CN")}
                </span>
                <span>入库 {selectedOrder.totalQty} 件</span>
                <span>已退 {selectedOrder.returnedQty} 件</span>
                <span>可退 {selectedOrder.returnableQty} 件</span>
              </div>

              <div className="mt-4 overflow-hidden rounded-3xl border border-[#eadfce]">
                <div className="grid grid-cols-[1fr_1fr_1fr_0.8fr_0.8fr_0.8fr_1fr] bg-[#f5efe6] px-4 py-3 text-sm font-semibold text-[#5c544b]">
                  <div>颜色</div>
                  <div>尺码</div>
                  <div>进货单价</div>
                  <div>入库</div>
                  <div>已退</div>
                  <div>可退</div>
                  <div>退货数量</div>
                </div>
                {selectedOrder.items.map((item) => {
                  const value = returnQty[item.variantId] ?? "";
                  const over = (Number(value) || 0) > item.returnableQty;
                  return (
                    <div
                      key={item.variantId}
                      className="grid grid-cols-[1fr_1fr_1fr_0.8fr_0.8fr_0.8fr_1fr] items-center border-t border-[#eadfce] bg-white px-4 py-2 text-sm text-[#6b645a]"
                    >
                      <div>{item.color}</div>
                      <div>{item.size}</div>
                      <div>¥{item.unitCost.toFixed(2)}</div>
                      <div>{item.inQty}</div>
                      <div>{item.returnedQty}</div>
                      <div>{item.returnableQty}</div>
                      <div>
                        <input
                          value={value}
                          onChange={(event) =>
                            setReturnQty((prev) => ({
                              ...prev,
                              [item.variantId]: event.target.value,
                            }))
                          }
                          disabled={item.returnableQty <= 0}
                          className={`w-full rounded-xl border px-2 py-1 text-sm disabled:bg-[#f5efe6] ${
                            over ? "border-[#d96b48] bg-[#fff3ee]" : "border-[#e4d7c5]"
                          }`}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-end gap-6 border-t border-[#eadfce] bg-[#f5efe6] px-4 py-3 text-sm font-semibold text-[#5c544b]">
                  <span>退货件数 {returnTotals.qty}</span>
                  <span>退货金额 ¥{returnTotals.cost.toFixed(2)}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-6 rounded-3xl border border-dashed border-[#eadfce] px-6 py-10 text-center text-sm text-[#6b645a]">
              {orders.length
                ? "请选择需要退货的进货订单"
                : "该商品还没有进货订单，先完成一次入库后再退货"}
            </div>
          )}

          {returnError ? (
            <div className="mt-6 rounded-2xl border border-[#f0c7b3] bg-[#fff1ea] px-4 py-3 text-sm text-[#b14d2a]">
              {returnError}
            </div>
          ) : null}
          {returnMessage ? (
            <div className="mt-6 rounded-2xl border border-[#c9e2c8] bg-[#f1fff1] px-4 py-3 text-sm text-[#386641]">
              {returnMessage}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleReturnSubmit}
            disabled={!selectedOrder}
            className="mt-6 w-full rounded-2xl bg-[#1f1811] px-4 py-3 text-base font-semibold text-white disabled:bg-[#bdb5a8]"
          >
            保存退货
          </button>
        </section>
      </div>
    </div>
  );
}
