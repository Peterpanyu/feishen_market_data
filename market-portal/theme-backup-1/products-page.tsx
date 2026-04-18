import Link from "next/link";
import { listProducts, listDistinctBrands } from "@/lib/products";
import {
  buildProductsListPath,
  composeListSearchQFromRules,
  parseSearchRulesFromParams,
  productsListQueryString,
} from "@/lib/listSearchParams";
import { ProductMultiSearchForm } from "@/components/ProductMultiSearchForm";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function ProductsPage({ searchParams: sp }: Props) {
  const brand = typeof sp.brand === "string" ? sp.brand.trim() : (Array.isArray(sp.brand) ? sp.brand[0] : "") || undefined;
  const qFree =
    typeof sp.q === "string" ? sp.q.trim() : (Array.isArray(sp.q) ? sp.q[0] : "")?.trim() || undefined;
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : (Array.isArray(sp.page) ? sp.page[0] : "") || "1", 10) || 1);

  const rules = parseSearchRulesFromParams(sp);
  const q = composeListSearchQFromRules(rules, qFree);

  let brands: string[] = [];
  let items: Awaited<ReturnType<typeof listProducts>>["items"] = [];
  let total = 0;
  let error: string | null = null;

  try {
    brands = await listDistinctBrands();
    const r = await listProducts({ page, pageSize: PAGE_SIZE, brand, q });
    items = r.items;
    total = r.total;
  } catch (e) {
    error = e instanceof Error ? e.message : "加载失败";
  }

  if (error) {
    return (
      <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
        {error} — 请检查 <code className="font-mono text-cyan-300">.env.local</code> 中的 Mongo 配置。
      </p>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const listReturnPath = buildProductsListPath({ brand, rules, q: qFree, page });

  const rulesVersion = JSON.stringify({
    b: brand ?? "",
    q: qFree ?? "",
    p: page,
    r: rules,
  });

  const buildQuery = (over: Partial<{ brand: string; q: string; page: string }>) => {
    const nextBrand = over.brand !== undefined ? over.brand : brand ?? "";
    const nextQ = over.q !== undefined ? over.q : qFree ?? "";
    const nextPage = over.page !== undefined ? Math.max(1, parseInt(over.page, 10) || 1) : page;
    const qs = productsListQueryString(rules, {
      brand: nextBrand || undefined,
      q: nextQ || undefined,
      page: nextPage > 1 ? nextPage : undefined,
    });
    return qs ? `?${qs}` : "";
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400/70">Catalog · 检索</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="heading-tech text-2xl font-bold sm:text-3xl">竞品目录</h1>
          <div className="font-mono text-xs text-cyan-500/60 tabular-nums">
            TOTAL <span className="text-cyan-200/90">{total}</span> · PAGE{" "}
            <span className="text-cyan-200/90">
              {page}/{totalPages}
            </span>
          </div>
        </div>
      </header>

      <ProductMultiSearchForm
        brands={brands}
        initialBrand={brand ?? ""}
        initialRules={rules}
        initialQ={qFree ?? ""}
        rulesVersion={rulesVersion}
      />

      <div className="glass-panel overflow-hidden !rounded-xl p-0">
        <div className="overflow-x-auto">
          <table className="table-tech w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-cyan-500/10 bg-slate-950/50 text-left text-xs uppercase tracking-wider text-cyan-200/55">
                <th className="px-5 py-3 font-medium">型号</th>
                <th className="px-5 py-3 font-medium">品牌</th>
                <th className="px-5 py-3 font-medium">产品线</th>
                <th className="px-5 py-3 font-medium">来源文件</th>
                <th className="w-28 px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-[var(--muted)]">
                    无匹配记录
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row._id.toString()} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-5 py-3.5 font-medium text-white">{row.型号}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-white">{row.品牌}</span>
                      {row.品牌中文名 ? (
                        <span className="ml-1 text-xs text-[var(--muted)]">({row.品牌中文名})</span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--muted)]">{row.产品线}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-400">{row.来源文件}</td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/products/${row._id.toString()}?return=${encodeURIComponent(listReturnPath)}`}
                        className="link-glow font-mono text-xs text-cyan-300"
                      >
                        详情 →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-3 text-sm">
          {page > 1 ? (
            <Link
              href={`/products${buildQuery({ page: String(page - 1) })}`}
              className="glass-panel rounded-xl px-5 py-2 text-[var(--muted)] transition-all hover:border-cyan-500/35 hover:text-cyan-100"
            >
              ← 上一页
            </Link>
          ) : null}
          {page < totalPages ? (
            <Link
              href={`/products${buildQuery({ page: String(page + 1) })}`}
              className="glass-panel rounded-xl px-5 py-2 text-[var(--muted)] transition-all hover:border-cyan-500/35 hover:text-cyan-100"
            >
              下一页 →
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
