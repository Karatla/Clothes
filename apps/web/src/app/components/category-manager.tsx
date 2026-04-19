"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

type Category = {
  id: string;
  name: string;
  isActive: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
};

export default function CategoryManager({ open, onClose, onUpdated }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const data = await apiFetch<Category[]>("/categories");
    setCategories(data);
  };

  useEffect(() => {
    if (open) {
      load().catch((err) => setError(err.message));
    }
  }, [open]);

  const filteredCategories = useMemo(() => {
    const keyword = search.trim();
    return categories
      .filter((category) => (keyword ? category.name.includes(keyword) : true))
      .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  }, [categories, search]);

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("请输入分类名称");
      return;
    }

    if (categories.some((category) => category.name === trimmedName)) {
      setError("分类已存在，请勿重复添加");
      return;
    }

    try {
      await apiFetch("/categories", {
        method: "POST",
        body: JSON.stringify({ name: trimmedName }),
      });
      setName("");
      setError(null);
      await load();
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "分类保存失败");
    }
  };

  const handleRename = async (id: string, value: string) => {
    const trimmedValue = value.trim();
    const current = categories.find((category) => category.id === id);
    if (!current || current.name === trimmedValue) {
      return;
    }
    if (!trimmedValue) {
      setError("分类名称不能为空");
      return;
    }
    if (categories.some((category) => category.id !== id && category.name === trimmedValue)) {
      setError("分类已存在，请勿重复添加");
      return;
    }

    try {
      await apiFetch(`/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmedValue }),
      });
      setError(null);
      await load();
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "分类更新失败");
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await apiFetch(`/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    });
    await load();
    onUpdated();
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/categories/${id}`, { method: "DELETE" });
    await load();
    onUpdated();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-3xl bg-white p-6 shadow-[0_30px_120px_-60px_rgba(27,20,12,0.6)]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-[#1f1811]">管理分类</h3>
            <p className="mt-1 text-sm text-[#6b645a]">
              可以添加、重命名或停用分类
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#eadfce] px-3 py-1 text-sm text-[#6b645a]"
          >
            关闭
          </button>
        </div>

        <div className="mt-6 flex gap-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="新增分类名称"
            className="flex-1 rounded-2xl border border-[#e4d7c5] px-4 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-2xl bg-[#a7652d] px-4 py-2 text-sm font-semibold text-white"
          >
            添加分类
          </button>
        </div>

        <div className="mt-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索分类名称"
            className="w-full rounded-2xl border border-[#e4d7c5] px-4 py-2 text-sm"
          />
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-[#f0c7b3] bg-[#fff1ea] px-4 py-2 text-sm text-[#b14d2a]">
            {error}
          </div>
        ) : null}

        <div className="mt-6 max-h-[50vh] space-y-3 overflow-y-auto pr-1">
          {filteredCategories.map((category) => (
            <div
              key={category.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#eadfce] bg-[#fbf7f0] px-4 py-3"
            >
              <input
                defaultValue={category.name}
                onBlur={(event) =>
                  handleRename(category.id, event.target.value)
                }
                className="flex-1 rounded-xl border border-[#e4d7c5] bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => handleToggle(category.id, !category.isActive)}
                className="rounded-full border border-[#e4d7c5] px-3 py-1 text-xs text-[#6b645a]"
              >
                {category.isActive ? "停用" : "启用"}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(category.id)}
                className="rounded-full border border-[#f0c7b3] px-3 py-1 text-xs text-[#b14d2a]"
              >
                删除
              </button>
            </div>
          ))}
          {filteredCategories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#eadfce] px-4 py-6 text-center text-sm text-[#6b645a]">
              没有匹配的分类
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
