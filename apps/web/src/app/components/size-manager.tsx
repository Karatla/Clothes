"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Size = {
  id: string;
  name: string;
  isActive: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
};

export default function SizeManager({ open, onClose, onUpdated }: Props) {
  const [sizes, setSizes] = useState<Size[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const data = await apiFetch<Size[]>("/sizes");
    setSizes(data);
  };

  useEffect(() => {
    if (open) {
      load().catch((err) => setError(err.message));
    }
  }, [open]);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("请输入尺码名称");
      return;
    }

    await apiFetch("/sizes", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setName("");
    setError(null);
    await load();
    onUpdated();
  };

  const handleRename = async (id: string, value: string) => {
    await apiFetch(`/sizes/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: value }),
    });
    await load();
    onUpdated();
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await apiFetch(`/sizes/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    });
    await load();
    onUpdated();
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/sizes/${id}`, { method: "DELETE" });
    await load();
    onUpdated();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-[0_30px_120px_-60px_rgba(27,20,12,0.6)]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-[#1f1811]">管理尺码</h3>
            <p className="mt-1 text-sm text-[#6b645a]">
              可以添加、重命名或停用尺码
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
            placeholder="新增尺码"
            className="flex-1 rounded-2xl border border-[#e4d7c5] px-4 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-2xl bg-[#a7652d] px-4 py-2 text-sm font-semibold text-white"
          >
            添加尺码
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-[#f0c7b3] bg-[#fff1ea] px-4 py-2 text-sm text-[#b14d2a]">
            {error}
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {sizes.map((size) => (
            <div
              key={size.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#eadfce] bg-[#fbf7f0] px-4 py-3"
            >
              <input
                defaultValue={size.name}
                onBlur={(event) => handleRename(size.id, event.target.value)}
                className="flex-1 rounded-xl border border-[#e4d7c5] bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => handleToggle(size.id, !size.isActive)}
                className="rounded-full border border-[#e4d7c5] px-3 py-1 text-xs text-[#6b645a]"
              >
                {size.isActive ? "停用" : "启用"}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(size.id)}
                className="rounded-full border border-[#f0c7b3] px-3 py-1 text-xs text-[#b14d2a]"
              >
                删除
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
