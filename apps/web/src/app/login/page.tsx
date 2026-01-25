"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? "登录失败，请检查账号或密码");
      }

      router.push("/");
    } catch (loginError) {
      const message =
        loginError instanceof Error
          ? loginError.message
          : "登录失败，请稍后再试";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f6f2ea] via-[#f4ede2] to-[#e7dfd4]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-12">
        <div className="grid w-full grid-cols-1 overflow-hidden rounded-3xl bg-white/80 shadow-[0_30px_120px_-60px_rgba(36,27,14,0.5)] backdrop-blur md:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col justify-between gap-10 p-10 md:p-12">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#a7652d]">
                Clothes Stock
              </p>
              <h1 className="text-3xl font-semibold leading-tight text-[#1f1811] md:text-4xl">
                服装库存管理系统
              </h1>
              <p className="text-base leading-relaxed text-[#6b645a]">
                统一管理商品、颜色、尺码和库存，快速录入销售价格，自动统计数量与利润。
              </p>
            </div>
            <div className="grid gap-4 text-sm text-[#6b645a]">
              <div className="rounded-2xl border border-[#eadfce] bg-[#fbf7f0] px-4 py-3">
                支持中文颜色编码与尺码矩阵录入
              </div>
              <div className="rounded-2xl border border-[#eadfce] bg-[#fbf7f0] px-4 py-3">
                销售、退换货与利润统计一体化
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-center gap-6 bg-[#fbf8f4] p-10 md:p-12">
            <div>
              <h2 className="text-2xl font-semibold text-[#1f1811]">管理员登录</h2>
              <p className="mt-2 text-sm text-[#6b645a]">
                使用管理员账号进入系统
              </p>
            </div>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="block space-y-2 text-sm font-medium text-[#3d342b]">
                账号邮箱
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-2xl border border-[#e4d7c5] bg-white px-4 py-3 text-base text-[#1f1811] shadow-sm outline-none transition focus:border-[#a7652d] focus:ring-2 focus:ring-[#e7c8a8]"
                  placeholder="admin@example.com"
                  required
                />
              </label>
              <label className="block space-y-2 text-sm font-medium text-[#3d342b]">
                密码
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-[#e4d7c5] bg-white px-4 py-3 text-base text-[#1f1811] shadow-sm outline-none transition focus:border-[#a7652d] focus:ring-2 focus:ring-[#e7c8a8]"
                  placeholder="请输入密码"
                  required
                />
              </label>
              {error ? (
                <div className="rounded-2xl border border-[#f0c7b3] bg-[#fff1ea] px-4 py-3 text-sm text-[#b14d2a]">
                  {error}
                </div>
              ) : null}
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center rounded-2xl bg-[#a7652d] px-4 py-3 text-base font-semibold text-white shadow-lg shadow-[#a7652d]/30 transition hover:bg-[#8f5426] disabled:cursor-not-allowed disabled:bg-[#c89f7a]"
              >
                {isSubmitting ? "正在登录..." : "进入系统"}
              </button>
            </form>
            <p className="text-xs text-[#8a8073]">
              如需修改管理员账号，请更新后端 .env 配置。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
