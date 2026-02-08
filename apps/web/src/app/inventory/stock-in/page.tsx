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

type Cell = {
  qty: string;
  cost: string;
};

type ColorRow = {
  id: string;
  color: string;
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
  cells: buildCells(sizes),
});

export default function StockInPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sizeOptions, setSizeOptions] = useState<Size[]>([]);
  const [showSizeManager, setShowSizeManager] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<ColorRow[]>([]);
  const [note, setNote] = useState("");
  const [newSizeName, setNewSizeName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sizeNames = sizeOptions.map((size) => size.name);

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

  const productOptions = useMemo(() => {
    const keyword = search.trim();
    const filtered = keyword
      ? products.filter(
          (product) =>
            product.name.includes(keyword) || product.baseCode.includes(keyword),
        )
      : products;
    if (selectedProduct && !filtered.some((item) => item.id === selectedProduct.id)) {
      return [selectedProduct, ...filtered];
    }
    return filtered;
  }, [products, search, selectedProduct]);

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
    }> = [];
    let missingCost = false;

    rows.forEach((row) => {
      const color = row.color.trim();
      if (!color) return;
      sizeNames.forEach((size) => {
        const cell = row.cells[size];
        const qty = Number(cell?.qty) || 0;
        if (qty <= 0) return;
        const costValue = Number(cell?.cost);
        if (!Number.isFinite(costValue)) {
          missingCost = true;
          return;
        }
        items.push({ color, size, qty, unitCost: costValue });
      });
    });

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "入库失败");
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
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2 text-sm text-[#6b645a]">
              商品
              <select
                value={productId ?? ""}
                onChange={(event) => {
                  setProductId(event.target.value);
                  setRows([createRow(sizeNames)]);
                }}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
              >
                {productOptions.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.baseCode})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-[#6b645a]">
              搜索款号/名称
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base"
                placeholder="如：5031 / 羽绒服"
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
