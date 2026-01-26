import AppHeader from "./components/app-header";

export default function Home() {
  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <AppHeader
          label="管理中心"
          title="服装库存系统仪表盘"
          description="欢迎回来，系统已准备好处理库存与进货。"
        />

        <section className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl bg-white/90 p-8 shadow-[0_25px_90px_-60px_rgba(36,27,14,0.4)]">
            <h2 className="text-xl font-semibold text-[#1f1811]">下一步操作</h2>
            <p className="mt-3 text-sm text-[#6b645a]">
              商品录入模块已经就绪，可以开始建立颜色尺码库存表。
            </p>
            <div className="mt-6 grid gap-4">
              <div className="rounded-2xl border border-[#eadfce] bg-[#fbf7f0] px-4 py-3 text-sm text-[#5c544b]">
                API 运行端口：3001
              </div>
              <div className="rounded-2xl border border-[#eadfce] bg-[#fbf7f0] px-4 py-3 text-sm text-[#5c544b]">
                前端运行端口：3000
              </div>
              <a
                href="/products/new"
                className="inline-flex items-center justify-center rounded-2xl bg-[#a7652d] px-4 py-3 text-sm font-semibold text-white"
              >
                进入商品录入
              </a>
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
