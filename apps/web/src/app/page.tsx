import LogoutButton from "./components/logout-button";

export default function Home() {
  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white/80 px-8 py-6 shadow-[0_20px_80px_-50px_rgba(36,27,14,0.4)]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#a7652d]">
              管理中心
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#1f1811]">
              服装库存系统仪表盘
            </h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-[#6b645a]">
            <span className="rounded-full border border-[#eadfce] bg-[#fbf7f0] px-4 py-2">
              管理员已登录
            </span>
            <LogoutButton />
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl bg-white/90 p-8 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
            <h2 className="text-xl font-semibold text-[#1f1811]">下一步操作</h2>
            <p className="mt-3 text-sm text-[#6b645a]">
              接下来将进入商品录入与颜色尺码表格的搭建。你可以先确认管理员账号与端口配置是否正确。
            </p>
            <div className="mt-6 grid gap-4">
              <div className="rounded-2xl border border-[#eadfce] bg-[#fbf7f0] px-4 py-3 text-sm text-[#5c544b]">
                API 运行端口：3001
              </div>
              <div className="rounded-2xl border border-[#eadfce] bg-[#fbf7f0] px-4 py-3 text-sm text-[#5c544b]">
                前端运行端口：3000
              </div>
            </div>
          </div>
          <div className="rounded-3xl bg-[#1f1811] p-8 text-white shadow-[0_25px_90px_-60px_rgba(36,27,14,0.6)]">
            <h2 className="text-xl font-semibold">登录已就绪</h2>
            <p className="mt-3 text-sm text-white/70">
              管理员登录功能已经完成，可以开始添加商品和库存模块。
            </p>
            <div className="mt-6 space-y-3 text-sm text-white/70">
              <div>下一阶段：商品基础信息 + 颜色尺码矩阵</div>
              <div>记得在 .env 中配置管理员账号</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
