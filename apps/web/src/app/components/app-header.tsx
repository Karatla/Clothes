import LogoutButton from "./logout-button";

type Props = {
  label: string;
  title: string;
  description?: string;
};

export default function AppHeader({ label, title, description }: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white/80 px-8 py-6 shadow-[0_20px_80px_-50px_rgba(36,27,14,0.4)]">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#a7652d]">
          {label}
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[#1f1811]">{title}</h1>
        {description ? (
          <p className="mt-2 text-sm text-[#6b645a]">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm text-[#6b645a]">
        <nav className="flex flex-wrap items-center gap-2">
          <a
            href="/"
            className="rounded-full border border-[#eadfce] bg-[#fbf7f0] px-3 py-1"
          >
            仪表盘
          </a>
          <a
            href="/products/new"
            className="rounded-full border border-[#eadfce] bg-[#fbf7f0] px-3 py-1"
          >
            商品录入
          </a>
          <a
            href="/inventory"
            className="rounded-full border border-[#eadfce] bg-[#fbf7f0] px-3 py-1"
          >
            库存总览
          </a>
          <a
            href="/sales/new"
            className="rounded-full border border-[#eadfce] bg-[#fbf7f0] px-3 py-1"
          >
            销售开单
          </a>
          <a
            href="/sales"
            className="rounded-full border border-[#eadfce] bg-[#fbf7f0] px-3 py-1"
          >
            销售记录
          </a>
          <a
            href="/returns/new"
            className="rounded-full border border-[#eadfce] bg-[#fbf7f0] px-3 py-1"
          >
            退换货
          </a>
          <a
            href="/returns"
            className="rounded-full border border-[#eadfce] bg-[#fbf7f0] px-3 py-1"
          >
            退货记录
          </a>
          <a
            href="/inventory/stock-in"
            className="rounded-full border border-[#eadfce] bg-[#fbf7f0] px-3 py-1"
          >
            进货入库
          </a>
          <a
            href="/inventory/movements"
            className="rounded-full border border-[#eadfce] bg-[#fbf7f0] px-3 py-1"
          >
            库存流水
          </a>
        </nav>
        <LogoutButton />
      </div>
    </header>
  );
}
