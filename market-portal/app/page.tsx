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
      <div className="fs-panel-interactive max-w-xl border-amber-900/40 p-6">
        <p className="fs-kicker text-amber-400">配置</p>
        <h1 className="mt-2 fs-h1">需要 MongoDB 环境</h1>
        <p className="mt-3 text-sm text-zinc-400">{error}</p>
        <p className="mt-4 text-sm leading-relaxed text-zinc-500">
          在 <code className="rounded bg-zinc-900 px-1 font-mono text-red-200/90">market-portal</code> 下复制{" "}
          <code className="rounded bg-zinc-900 px-1 font-mono text-red-200/90">.env.local.example</code> 为{" "}
          <code className="rounded bg-zinc-900 px-1 font-mono text-red-200/90">.env.local</code>，填写{" "}
          <code className="rounded bg-zinc-900 px-1 font-mono text-red-200/90">MONGODB_URI</code> 等与导入一致。
        </p>
      </div>
    );
  }

  return (
    <div className="fs-page-enter space-y-11">
      <header className="fs-stagger-2 relative space-y-3">
        <div
          className="pointer-events-none absolute -left-6 -top-10 h-32 w-32 rounded-full bg-red-600/10 blur-3xl"
          aria-hidden
        />
        <p className="fs-kicker fs-reveal-child">竞品数据</p>
        <h1 className="fs-h1 fs-h1-accent fs-reveal-child">市场概览</h1>
        <p className="relative max-w-xl text-sm leading-relaxed text-zinc-500 fs-reveal-child">
          集合「竞品产品」由 market-data 维护。下方为条数统计与品牌分布，可进入目录做多字段与全文检索。
        </p>
      </header>

      <div className="fs-stagger-2 grid gap-4 sm:grid-cols-2">
        <div className="fs-stat-card fs-reveal-child">
          <div className="fs-stat-shine" aria-hidden />
          <p className="fs-mono-muted relative flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.45)]" />
            TOTAL
          </p>
          <p className="relative mt-2 bg-gradient-to-br from-white to-zinc-400 bg-clip-text text-3xl font-semibold tabular-nums text-transparent">
            {total}
          </p>
          <p className="mt-2 text-sm text-zinc-500">竞品条数</p>
        </div>
        <Link href="/products" className="group fs-cta-card fs-reveal-child">
          <p className="fs-kicker transition-colors duration-300 group-hover:text-red-300">目录</p>
          <p className="relative mt-2 text-lg font-medium text-white">打开竞品目录</p>
          <p className="relative mt-1 text-sm text-zinc-500 transition-colors group-hover:text-zinc-400">
            检索、分页、详情
          </p>
          <span
            className="relative mt-4 inline-flex items-center gap-1 text-sm font-medium text-red-300/90 transition-all duration-300 group-hover:translate-x-1 group-hover:text-red-200"
            aria-hidden
          >
            进入
            <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
          </span>
        </Link>
      </div>

      <section className="fs-stagger-3 space-y-4">
        <div className="flex items-end justify-between gap-4 border-b border-zinc-800/40 pb-3 fs-reveal-child">
          <div>
            <h2 className="fs-h2">按品牌</h2>
            <p className="mt-1 text-xs text-zinc-600">点击「筛选」进入目录并带上该品牌</p>
          </div>
          <span className="fs-mono-muted hidden sm:inline">DISTINCT</span>
        </div>
        <div className="fs-panel-interactive overflow-hidden p-0 fs-reveal-child">
          <div className="fs-table-wrap">
            <table className="fs-table min-w-[300px]">
              <thead>
                <tr>
                  <th>品牌</th>
                  <th>数量</th>
                  <th className="w-28" />
                </tr>
              </thead>
              <tbody>
                {brands.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-zinc-500">
                      暂无数据，请先在 market-data 导入
                    </td>
                  </tr>
                ) : (
                  brands.map((b, i) => (
                    <tr
                      key={b.品牌}
                      className="fs-reveal-child"
                      style={{ animationDelay: `${Math.min(i, 10) * 0.035}s` }}
                    >
                      <td className="font-medium text-white">{b.品牌}</td>
                      <td className="font-mono tabular-nums text-zinc-400">{b.数量}</td>
                      <td>
                        <Link
                          href={`/products?brand=${encodeURIComponent(b.品牌)}`}
                          className="group/row fs-link inline-flex items-center gap-1 text-xs"
                        >
                          筛选
                          <span
                            aria-hidden
                            className="transition-transform duration-200 group-hover/row:translate-x-0.5"
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
