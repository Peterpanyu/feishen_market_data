import Link from "next/link";
import { countProducts, aggregateByBrand } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let total = 0;
  let brands: { 品牌: string; 数量: number }[] = [];
  let error: string | null = null;

  try {
    total = await countProducts();
    brands = await aggregateByBrand();
  } catch (e) {
    error = e instanceof Error ? e.message : "无法连接数据库";
  }

  if (error) {
    return (
      <div className="glass-panel max-w-2xl border-amber-500/30 p-8 animate-pulse-slow">
        <div className="mb-2 font-mono text-xs uppercase tracking-widest text-amber-400/90">System</div>
        <h1 className="text-xl font-semibold text-amber-100">需要先配置环境变量</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">{error}</p>
        <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
          请在 <code className="font-mono text-cyan-300/90">market-portal</code> 目录复制{" "}
          <code className="font-mono text-cyan-300/90">.env.local.example</code> 为{" "}
          <code className="font-mono text-cyan-300/90">.env.local</code>，填写{" "}
          <code className="font-mono text-cyan-300/90">MONGODB_URI</code> 等，与{" "}
          <code className="font-mono text-cyan-300/90">market-data</code> 导入目标一致。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-cyan-400/80">MongoDB · 竞品情报</p>
        <h1 className="heading-tech text-3xl font-bold sm:text-4xl">市场数据概览</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          数据来自集合「竞品产品」，由 market-data 导入脚本维护。实时聚合品牌分布与条目规模。
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div
          className="glass-panel group stagger-in relative overflow-hidden p-6"
          style={{ animationDelay: "0.05s" }}
        >
          <div className="pointer-events-none absolute inset-0 stat-shimmer opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          <div className="font-mono text-xs uppercase tracking-wider text-cyan-400/70">Total records</div>
          <div className="mt-2 bg-gradient-to-br from-white to-cyan-200 bg-clip-text text-4xl font-bold text-transparent tabular-nums">
            {total}
          </div>
          <div className="mt-2 text-sm text-[var(--muted)]">竞品条数</div>
        </div>

        <Link
          href="/products"
          className="glass-panel group stagger-in relative flex flex-col justify-center overflow-hidden p-6 transition-transform duration-300 hover:scale-[1.02] hover:shadow-glow"
          style={{ animationDelay: "0.12s" }}
        >
          <div className="absolute right-4 top-4 h-16 w-16 rounded-full bg-cyan-500/10 blur-2xl transition-all duration-500 group-hover:bg-cyan-400/25" />
          <span className="font-mono text-xs font-medium uppercase tracking-wider text-cyan-300">Navigate →</span>
          <span className="mt-2 text-lg font-semibold text-white">浏览全部竞品与参数</span>
          <span className="mt-3 text-sm text-[var(--muted)] group-hover:text-cyan-100/80">多字段检索 · 全文 · 结构化条件</span>
        </Link>

        <div
          className="glass-panel stagger-in hidden flex-col justify-center border-violet-500/20 p-6 lg:flex"
          style={{ animationDelay: "0.2s" }}
        >
          <div className="font-mono text-xs uppercase tracking-wider text-violet-400/80">Live</div>
          <p className="mt-2 text-sm text-[var(--muted)]">品牌维度已索引，支持一键筛选进入目录视图。</p>
        </div>
      </div>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="text-lg font-semibold text-white sm:text-xl">按品牌分布</h2>
          <span className="font-mono text-[10px] text-cyan-500/50">DISTINCT 品牌 · COUNT</span>
        </div>
        <div className="glass-panel overflow-hidden !rounded-xl p-0">
          <div className="overflow-x-auto">
            <table className="table-tech w-full min-w-[320px] text-sm">
              <thead>
                <tr className="border-b border-cyan-500/10 bg-slate-950/40 text-left text-xs uppercase tracking-wider text-cyan-200/60">
                  <th className="px-5 py-3 font-medium">品牌</th>
                  <th className="px-5 py-3 font-medium">数量</th>
                  <th className="w-36 px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {brands.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-12 text-center text-[var(--muted)]">
                      暂无数据，请先在 market-data 中执行导入
                    </td>
                  </tr>
                ) : (
                  brands.map((b) => (
                    <tr key={b.品牌} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-5 py-3.5 font-medium text-white">{b.品牌}</td>
                      <td className="px-5 py-3.5 font-mono text-cyan-100/90 tabular-nums">{b.数量}</td>
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/products?brand=${encodeURIComponent(b.品牌)}`}
                          className="group/link link-glow inline-flex items-center gap-1 font-mono text-xs text-cyan-300"
                        >
                          筛选查看
                          <span
                            aria-hidden
                            className="transition-transform duration-200 group-hover/link:translate-x-0.5"
                          >
                            ↗
                          </span>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
