"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/app/components/app-header";
import { apiFetch } from "@/lib/api";

type Settings = Record<string, string>;

const RECEIPT_WIDTHS = [
  { value: "58", label: "58mm 热敏小票" },
  { value: "80", label: "80mm 热敏小票（推荐）" },
  { value: "a4", label: "A4 纸" },
];

const LABEL_SIZES = [
  { value: "40x30", label: "40 × 30 mm（推荐）" },
  { value: "50x30", label: "50 × 30 mm" },
  { value: "60x40", label: "60 × 40 mm" },
  { value: "a4", label: "A4 不干胶（一版多张）" },
];

const inputClass =
  "w-full rounded-2xl border border-[#e4d7c5] px-4 py-3 text-base";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Settings>("/settings")
      .then(setSettings)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "读取设置失败"),
      );
  }, []);

  const update = (key: string, value: string) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    setMessage(null);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await apiFetch<Settings>("/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setSettings(saved);
      setMessage("设置已保存");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("确认恢复所有设置为默认值？")) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await apiFetch<Settings>("/settings/reset", {
        method: "POST",
      });
      setSettings(saved);
      setMessage("已恢复默认设置");
    } catch (err) {
      setError(err instanceof Error ? err.message : "恢复失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <AppHeader
          label="系统设置"
          title="店铺与打印设置"
          description="这里的内容会打印在小票和商品标签上，随时可以修改。"
        />

        {settings ? (
          <>
            <section className="rounded-3xl bg-white/90 p-8 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
              <p className="text-lg font-semibold text-[#1f1811]">店铺信息</p>
              <p className="mt-1 text-sm text-[#6b645a]">
                打印在小票抬头和页脚。
              </p>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-[#6b645a]">
                  店铺名称
                  <input
                    value={settings["shop.name"] ?? ""}
                    onChange={(event) => update("shop.name", event.target.value)}
                    className={inputClass}
                    placeholder="如：小美服饰"
                  />
                </label>
                <label className="space-y-2 text-sm text-[#6b645a]">
                  联系电话
                  <input
                    value={settings["shop.phone"] ?? ""}
                    onChange={(event) =>
                      update("shop.phone", event.target.value)
                    }
                    className={inputClass}
                    placeholder="如：13800000000"
                  />
                </label>
                <label className="space-y-2 text-sm text-[#6b645a] md:col-span-2">
                  店铺地址
                  <input
                    value={settings["shop.address"] ?? ""}
                    onChange={(event) =>
                      update("shop.address", event.target.value)
                    }
                    className={inputClass}
                    placeholder="如：XX 市 XX 路 88 号"
                  />
                </label>
                <label className="space-y-2 text-sm text-[#6b645a] md:col-span-2">
                  小票页脚
                  <input
                    value={settings["shop.footer"] ?? ""}
                    onChange={(event) =>
                      update("shop.footer", event.target.value)
                    }
                    className={inputClass}
                    placeholder="如：凭小票 7 天内可退换"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-3xl bg-white/90 p-8 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
              <p className="text-lg font-semibold text-[#1f1811]">小票打印</p>
              <p className="mt-1 text-sm text-[#6b645a]">
                纸张宽度要和你的小票机一致，否则会打偏。
              </p>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-[#6b645a]">
                  纸张宽度
                  <select
                    value={settings["receipt.width"] ?? "80"}
                    onChange={(event) =>
                      update("receipt.width", event.target.value)
                    }
                    className={inputClass}
                  >
                    {RECEIPT_WIDTHS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm text-[#6b645a]">
                  默认打印份数
                  <input
                    value={settings["receipt.copies"] ?? "1"}
                    onChange={(event) =>
                      update("receipt.copies", event.target.value)
                    }
                    className={inputClass}
                  />
                </label>
                <label className="flex items-center gap-3 text-sm text-[#6b645a]">
                  <input
                    type="checkbox"
                    checked={settings["receipt.showQr"] === "true"}
                    onChange={(event) =>
                      update("receipt.showQr", String(event.target.checked))
                    }
                  />
                  底部打印订单二维码（退货时扫码定位订单）
                </label>
                <label className="flex items-center gap-3 text-sm text-[#6b645a]">
                  <input
                    type="checkbox"
                    checked={settings["receipt.showCost"] === "true"}
                    onChange={(event) =>
                      update("receipt.showCost", String(event.target.checked))
                    }
                  />
                  打印成本与利润（给客人的小票请勿勾选）
                </label>
              </div>
            </section>

            <section className="rounded-3xl bg-white/90 p-8 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
              <p className="text-lg font-semibold text-[#1f1811]">商品标签</p>
              <p className="mt-1 text-sm text-[#6b645a]">
                贴在货品上的二维码标签，尺寸要和标签纸一致。
              </p>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-[#6b645a]">
                  标签尺寸
                  <select
                    value={settings["label.size"] ?? "40x30"}
                    onChange={(event) =>
                      update("label.size", event.target.value)
                    }
                    className={inputClass}
                  >
                    {LABEL_SIZES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm text-[#6b645a]">
                  条码前缀（可留空）
                  <input
                    value={settings["barcode.prefix"] ?? ""}
                    onChange={(event) =>
                      update("barcode.prefix", event.target.value)
                    }
                    className={inputClass}
                    placeholder="如：MM"
                  />
                </label>
                <label className="flex items-center gap-3 text-sm text-[#6b645a]">
                  <input
                    type="checkbox"
                    checked={settings["label.showPrice"] === "true"}
                    onChange={(event) =>
                      update("label.showPrice", String(event.target.checked))
                    }
                  />
                  标签上打印售价
                </label>
                <label className="flex items-center gap-3 text-sm text-[#6b645a]">
                  <input
                    type="checkbox"
                    checked={settings["label.showShopName"] === "true"}
                    onChange={(event) =>
                      update("label.showShopName", String(event.target.checked))
                    }
                  />
                  标签上打印店铺名称
                </label>
              </div>
            </section>

            {error ? (
              <div className="rounded-2xl border border-[#f0c7b3] bg-[#fff1ea] px-4 py-3 text-sm text-[#b14d2a]">
                {error}
              </div>
            ) : null}
            {message ? (
              <div className="rounded-2xl border border-[#c9e2c8] bg-[#f1fff1] px-4 py-3 text-sm text-[#386641]">
                {message}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-2xl bg-[#1f1811] px-4 py-3 text-base font-semibold text-white disabled:bg-[#bdb5a8]"
              >
                {saving ? "保存中..." : "保存设置"}
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={saving}
                className="rounded-2xl border border-[#e4d7c5] px-5 py-3 text-sm text-[#6b645a]"
              >
                恢复默认
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-3xl border border-dashed border-[#eadfce] px-6 py-10 text-center text-sm text-[#6b645a]">
            {error ?? "正在读取设置..."}
          </div>
        )}
      </div>
    </div>
  );
}
