"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/app/components/app-header";
import CategoryManager from "@/app/components/category-manager";
import SizeManager from "@/app/components/size-manager";
import { API_BASE, apiFetch, uploadFile } from "@/lib/api";
import { makeId } from "@/lib/id";

type Category = {
  id: string;
  name: string;
  isActive: boolean;
};

type Size = {
  id: string;
  name: string;
  isActive: boolean;
};

type ProductPreview = {
  id: string;
  name: string;
  baseCode: string;
  imageUrl: string | null;
  variants: Array<{ id: string; color: string; size: string; qty: number }>;
};

type Cell = {
  qty: string;
  cost: string;
  price: string;
};

type ColorRow = {
  id: string;
  name: string;
  cells: Record<string, Cell>;
};

const emptyCell = (): Cell => ({ qty: "", cost: "", price: "" });

const buildCells = (sizes: string[], existing?: Record<string, Cell>) =>
  sizes.reduce((acc, size) => {
    acc[size] = existing?.[size] ?? emptyCell();
    return acc;
  }, {} as Record<string, Cell>);

const createRow = (sizes: string[]): ColorRow => ({
  id: makeId(),
  name: "",
  cells: buildCells(sizes),
});

export default function ProductEntryPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<ProductPreview[]>([]);
  const [showManager, setShowManager] = useState(false);
  const [showSizeManager, setShowSizeManager] = useState(false);
  const [sizes, setSizes] = useState<Size[]>([]);

  const [name, setName] = useState("");
  const [baseCode, setBaseCode] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [tags, setTags] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [rows, setRows] = useState<ColorRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const sizeNames = sizes.map((size) => size.name);

  const loadCategories = async () => {
    const data = await apiFetch<Category[]>("/categories?active=true");
    setCategories(data);
    if (!categoryId && data.length > 0) {
      setCategoryId(data[0].id);
    }
  };

  const loadProducts = async () => {
    const data = await apiFetch<ProductPreview[]>("/products");
    setProducts(data);
  };

  const loadSizes = async () => {
    const data = await apiFetch<Size[]>("/sizes?active=true");
    setSizes(data);
  };

  useEffect(() => {
    loadCategories().catch(() => null);
    loadProducts().catch(() => null);
    loadSizes().catch(() => null);
  }, []);

  useEffect(() => {
    if (sizeNames.length === 0) {
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
  }, [sizes]);

  const totals = useMemo(() => {
    let totalQty = 0;
    let totalAmount = 0;

    const rowTotals = rows.map((row) => {
      let rowQty = 0;
      let rowAmount = 0;
      sizeNames.forEach((size) => {
        const cell = row.cells[size];
        const qty = Number(cell.qty) || 0;
        const price = Number(cell.price) || 0;
        rowQty += qty;
        rowAmount += qty * price;
      });
      totalQty += rowQty;
      totalAmount += rowAmount;
      return { rowQty, rowAmount };
    });

    return { totalQty, totalAmount, rowTotals };
  }, [rows]);

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

  const handleRowName = (rowId: string, value: string) => {
    setRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, name: value } : row)),
    );
  };

  const handleAddRow = () =>
    setRows((prev) => [...prev, createRow(sizeNames)]);

  const handleRemoveRow = (rowId: string) => {
    setRows((prev) => prev.filter((row) => row.id !== rowId));
  };

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadFile(file);
      setImageUrl(`${API_BASE}${url}`);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "上传失败",
      );
    } finally {
      setUploading(false);
    }
  };

  const buildVariants = () => {
    const variants: Array<{
      color: string;
      size: string;
      qty: number;
      costPrice: number;
      salePrice: number;
      sku: string;
    }> = [];

    rows.forEach((row) => {
      if (!row.name.trim()) return;
      sizeNames.forEach((size) => {
        const cell = row.cells[size];
        const qty = Number(cell.qty) || 0;
        const costPrice = Number(cell.cost) || 0;
        const salePrice = Number(cell.price) || 0;

        if (qty <= 0 && costPrice <= 0 && salePrice <= 0) return;

        variants.push({
          color: row.name.trim(),
          size,
          qty,
          costPrice,
          salePrice,
          sku: `${baseCode}-${row.name.trim()}-${size}`,
        });
      });
    });

    return variants;
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!name.trim() || !baseCode.trim()) {
      setError("请填写商品名称和基础编码");
      return;
    }

    const variants = buildVariants();
    if (variants.length === 0) {
      setError("请至少填写一个尺码的库存信息");
      return;
    }

    await apiFetch("/products", {
      method: "POST",
      body: JSON.stringify({
        name,
        baseCode,
        categoryId,
        tags: tags
          .split(/[,，]/)
          .map((tag) => tag.trim())
          .filter(Boolean),
        imageUrl,
        variants,
      }),
    });

    setName("");
    setBaseCode("");
    setTags("");
    setImageUrl(null);
    setRows([createRow(sizeNames)]);
    setSuccess("商品已保存");
    await loadProducts();
  };

  return (
    <div className="min-h-screen px-6 py-12">
      <CategoryManager
        open={showManager}
        onClose={() => setShowManager(false)}
        onUpdated={loadCategories}
      />
      <SizeManager
        open={showSizeManager}
        onClose={() => setShowSizeManager(false)}
        onUpdated={loadSizes}
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <AppHeader
          label="商品录入"
          title="新建商品与颜色尺码库存"
          description="录入基础商品并添加颜色尺码库存。"
        />

        <section className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="space-y-6 rounded-3xl bg-white/90 p-8 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-[#6b645a]">
                商品名称
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base text-[#1f1811]"
                  placeholder="如：羽绒服"
                />
              </label>
              <label className="space-y-2 text-sm text-[#6b645a]">
                基础编码
                <input
                  value={baseCode}
                  onChange={(event) => setBaseCode(event.target.value)}
                  className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base text-[#1f1811]"
                  placeholder="如：5031"
                />
              </label>
              <label className="space-y-2 text-sm text-[#6b645a]">
                分类
                <div className="flex gap-2">
                  <select
                    value={categoryId ?? ""}
                    onChange={(event) => setCategoryId(event.target.value)}
                    className="flex-1 rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base text-[#1f1811]"
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowManager(true)}
                    className="rounded-2xl border border-[#e4d7c5] px-4 text-sm text-[#6b645a]"
                  >
                    管理
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
              <label className="space-y-2 text-sm text-[#6b645a]">
                标签（逗号分隔）
                <input
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base text-[#1f1811]"
                  placeholder="如：新款,冬季"
                />
              </label>
            </div>

            <div className="rounded-3xl border border-dashed border-[#e4d7c5] bg-[#fbf7f0] p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#1f1811]">商品图片</p>
                  <p className="mt-1 text-xs text-[#6b645a]">
                    支持 JPG/PNG，建议使用 1:1
                  </p>
                </div>
                <label className="rounded-2xl bg-[#a7652d] px-4 py-2 text-sm font-semibold text-white">
                  {uploading ? "上传中..." : "选择图片"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) =>
                      handleUpload(event.target.files?.[0] ?? null)
                    }
                  />
                </label>
              </div>
              {imageUrl ? (
                <div className="mt-4 flex items-center gap-4">
                  <img
                    src={imageUrl}
                    alt="商品图片预览"
                    className="h-24 w-24 rounded-2xl object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl(null)}
                    className="rounded-2xl border border-[#e4d7c5] px-4 py-2 text-sm text-[#6b645a]"
                  >
                    移除图片
                  </button>
                </div>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-3xl border border-[#eadfce]">
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
                      value={row.name}
                      onChange={(event) =>
                        handleRowName(row.id, event.target.value)
                      }
                      placeholder={rowIndex === 0 ? "如：灰色" : "颜色"}
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
                        <input
                          value={row.cells[size]?.price ?? ""}
                          onChange={(event) =>
                            handleRowChange(row.id, size, "price", event.target.value)
                          }
                          className="w-full rounded-xl border border-[#e4d7c5] px-2 py-1 text-xs"
                          placeholder="售价"
                        />
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-col items-center justify-center px-3 py-3 text-sm text-[#6b645a]">
                    <div>数量 {totals.rowTotals[rowIndex]?.rowQty ?? 0}</div>
                    <div>金额 {totals.rowTotals[rowIndex]?.rowAmount ?? 0}</div>
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
                  <span>总金额 {totals.totalAmount}</span>
                </div>
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl border border-[#f0c7b3] bg-[#fff1ea] px-4 py-3 text-sm text-[#b14d2a]">
                {error}
              </div>
            ) : null}
            {success ? (
              <div className="rounded-2xl border border-[#c9e2c8] bg-[#f1fff1] px-4 py-3 text-sm text-[#386641]">
                {success}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleSubmit}
              className="w-full rounded-2xl bg-[#1f1811] px-4 py-3 text-base font-semibold text-white"
            >
              保存商品
            </button>
          </div>

          <aside className="space-y-4 rounded-3xl bg-white/90 p-6 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
            <h2 className="text-lg font-semibold text-[#1f1811]">近期录入</h2>
            <div className="space-y-3 text-sm text-[#6b645a]">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 rounded-2xl border border-[#eadfce] bg-[#fbf7f0] p-3"
                >
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-12 w-12 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eadfce] text-xs text-[#6b645a]">
                      暂无图片
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-[#1f1811]">
                      {product.name}
                    </div>
                    <div className="text-xs text-[#6b645a]">
                      编码 {product.baseCode} · {product.variants.length} 个尺码
                    </div>
                    <a
                      href={`/products/${product.id}`}
                      className="text-xs text-[#a7652d]"
                    >
                      查看详情
                    </a>
                  </div>
                </div>
              ))}
              {products.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#eadfce] px-4 py-6 text-center text-xs text-[#6b645a]">
                  暂无商品数据
                </div>
              ) : null}
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
