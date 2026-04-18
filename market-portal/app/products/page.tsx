import Link from "next/link";
import { listProducts, listDistinctBrands, listDistinctProductLines } from "@/lib/products";
import type { ListSortKey } from "@/lib/listSortKey";
import {
  buildProductsListPath,
  composeListSearchQFromRules,
  cycleListSort,
  parseListSortFromParams,
  parseMultiValues,
  parseSearchRulesFromParams,
  productsListQueryString,
} from "@/lib/listSearchParams";
import { CatalogSearchForm } from "@/components/CatalogSearchForm";
import { formatDateTimeBeijing } from "@/lib/formatDate";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function ProductsPage({ searchParams: sp }: Props) {
  const brandsFilter = parseMultiValues(sp, "brand");
  const linesFilter = parseMultiValues(sp, "line");
  const qFree =
    typeof sp.q === "string"
      ? sp.q.trim()
      : (Array.isArray(sp.q) ? sp.q[0] : "")?.trim() || undefined;
  const page = Math.max(
    1,
    parseInt(typeof sp.page === "string" ? sp.page : (Array.isArray(sp.page) ? sp.page[0] : "") || "1", 10) || 1,
  );

  const rules = parseSearchRulesFromParams(sp);
  const q = composeListSearchQFromRules(rules, qFree);
  const listSort = parseListSortFromParams(sp);

  let brands: string[] = [];
  let productLines: string[] = [];
  let items: Awaited<ReturnType<typeof listProducts>>["items"] = [];
  let total = 0;
  let error: string | null = null;

  try {
    brands = await listDistinctBrands();
    productLines = await listDistinctProductLines();
    const r = await listProducts({
      page,
      pageSize: PAGE_SIZE,
      brands: brandsFilter.length ? brandsFilter : undefined,
      productLines: linesFilter.length ? linesFilter : undefined,
      q,
      sort: listSort,
    });
    items = r.items;
    total = r.total;
  } catch (e) {
    error = e instanceof Error ? e.message : "加载失败";
  }

  if (error) {
    return (
      <div className="fs-panel-interactive max-w-xl border-red-900/45 bg-red-950/20 p-5">
        <p className="fs-kicker text-red-300/90">加载失败</p>
        <p className="mt-2 text-sm leading-relaxed text-red-100/90">{error}</p>
        <p className="mt-3 text-xs text-zinc-500">
          请检查 <code className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-red-200/90">.env.local</code>{" "}
          中的 Mongo 配置。
        </p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const listReturnPath = buildProductsListPath({
    brands: brandsFilter,
    productLines: linesFilter,
    rules,
    q: qFree,
    page,
    sort: listSort?.key,
    dir: listSort?.dir,
  });

  const rulesVersion = JSON.stringify({
    b: [...brandsFilter].sort((a, z) => a.localeCompare(z, "en", { sensitivity: "base" })),
    l: [...linesFilter].sort((a, z) => a.localeCompare(z, "en", { sensitivity: "base" })),
    q: qFree ?? "",
    p: page,
    r: rules,
    s: listSort?.key,
    sd: listSort?.dir,
  });

  const listExtrasBase = {
    brands: brandsFilter.length ? brandsFilter : undefined,
    productLines: linesFilter.length ? linesFilter : undefined,
    q: qFree || undefined,
    sort: listSort?.key,
    dir: listSort?.dir,
  };

  const sortHeaderHref = (column: ListSortKey) => {
    const next = cycleListSort(column, listSort);
    const qs = productsListQueryString(rules, {
      ...listExtrasBase,
      page: undefined,
      sort: next?.key,
      dir: next?.dir,
    });
    return qs ? `/products?${qs}` : "/products";
  };

  const sortHeaderTitle = "点击切换：降序 → 升序 → 恢复默认（录入时间降序）";

  const buildQuery = (over: Partial<{ q: string; page: string }>) => {
    const nextQ = over.q !== undefined ? over.q : qFree ?? "";
    const nextPage = over.page !== undefined ? Math.max(1, parseInt(over.page, 10) || 1) : page;
    const qs = productsListQueryString(rules, {
      brands: brandsFilter.length ? brandsFilter : undefined,
      productLines: linesFilter.length ? linesFilter : undefined,
      q: nextQ || undefined,
      page: nextPage > 1 ? nextPage : undefined,
      sort: listSort?.key,
      dir: listSort?.dir,
    });
    return qs ? `?${qs}` : "";
  };

  return (
    <div className="space-y-9">
      <header className="fs-page-enter relative flex flex-wrap items-end justify-between gap-5 overflow-hidden rounded-2xl border border-zinc-800/70 bg-gradient-to-br from-zinc-950/80 via-zinc-950/40 to-black/30 p-5 shadow-lg shadow-black/40 sm:p-6">
        <div
          className="pointer-events-none absolute -right-20 -top-28 h-56 w-56 rounded-full bg-red-600/12 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent"
          aria-hidden
        />
        <div className="relative space-y-2">
          <p className="fs-kicker">Catalog</p>
          <h1 className="fs-h1 fs-h1-accent">竞品目录</h1>
          <p className="max-w-md text-sm leading-relaxed text-zinc-500">支持品牌 / 产品线、多字段与全文检索；结果表头可排序。</p>
        </div>
        <div className="relative fs-stat-pill fs-mono-muted tabular-nums text-zinc-400">
          <span className="fs-stat-pill__dot" aria-hidden />
          <span>
            <span className="text-lg font-semibold text-red-200/95">{total}</span>
            <span className="mx-1.5 text-zinc-600">·</span>
            第 <span className="text-zinc-200">{page}</span>/{totalPages} 页
          </span>
        </div>
      </header>

      <CatalogSearchForm
        brands={brands}
        productLines={productLines}
        initialBrands={brandsFilter}
        initialProductLines={linesFilter}
        initialRules={rules}
        initialQ={qFree ?? ""}
        rulesVersion={rulesVersion}
        listSort={listSort}
      />

      <div className="fs-panel-interactive fs-panel-rise overflow-hidden p-0">
        <div className="fs-catalog-toolbar">
          <div>
            <p className="fs-catalog-toolbar-title">查询结果</p>
            <p className="mt-0.5 text-xs text-zinc-600">表头可排序 · 默认按录入时间从新到旧</p>
          </div>
        </div>
        <div className="fs-table-wrap rounded-none">
          <table className="fs-table fs-table-catalog">
            <thead>
              <tr>
                <th
                  scope="col"
                  aria-sort={
                    listSort?.key === "model"
                      ? listSort.dir === "desc"
                        ? "descending"
                        : "ascending"
                      : "none"
                  }
                >
                  <Link
                    href={sortHeaderHref("model")}
                    title={sortHeaderTitle}
                    className={`group fs-sort-link ${listSort?.key === "model" ? "fs-sort-link--active" : ""}`}
                  >
                    型号
                    <span className="fs-sort-link__glyph" aria-hidden>
                      {listSort?.key === "model" ? (listSort.dir === "desc" ? "↓" : "↑") : "⇅"}
                    </span>
                  </Link>
                </th>
                <th
                  scope="col"
                  aria-sort={
                    listSort?.key === "brand"
                      ? listSort.dir === "desc"
                        ? "descending"
                        : "ascending"
                      : "none"
                  }
                >
                  <Link
                    href={sortHeaderHref("brand")}
                    title={sortHeaderTitle}
                    className={`group fs-sort-link ${listSort?.key === "brand" ? "fs-sort-link--active" : ""}`}
                  >
                    品牌
                    <span className="fs-sort-link__glyph" aria-hidden>
                      {listSort?.key === "brand" ? (listSort.dir === "desc" ? "↓" : "↑") : "⇅"}
                    </span>
                  </Link>
                </th>
                <th
                  scope="col"
                  aria-sort={
                    listSort?.key === "productLine"
                      ? listSort.dir === "desc"
                        ? "descending"
                        : "ascending"
                      : "none"
                  }
                >
                  <Link
                    href={sortHeaderHref("productLine")}
                    title={sortHeaderTitle}
                    className={`group fs-sort-link ${listSort?.key === "productLine" ? "fs-sort-link--active" : ""}`}
                  >
                    产品线
                    <span className="fs-sort-link__glyph" aria-hidden>
                      {listSort?.key === "productLine" ? (listSort.dir === "desc" ? "↓" : "↑") : "⇅"}
                    </span>
                  </Link>
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap"
                  aria-sort={
                    listSort?.key === "importedAt"
                      ? listSort.dir === "desc"
                        ? "descending"
                        : "ascending"
                      : "none"
                  }
                >
                  <Link
                    href={sortHeaderHref("importedAt")}
                    title={sortHeaderTitle}
                    className={`group fs-sort-link ${listSort?.key === "importedAt" ? "fs-sort-link--active" : ""}`}
                  >
                    数据录入时间
                    <span className="fs-sort-link__glyph" aria-hidden>
                      {listSort?.key === "importedAt" ? (listSort.dir === "desc" ? "↓" : "↑") : "⇅"}
                    </span>
                  </Link>
                </th>
                <th className="w-28 text-right">
                  <span className="sr-only">操作</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="fs-empty-hint">
                    无匹配记录 — 可放宽品牌 / 产品线或调整检索条件
                  </td>
                </tr>
              ) : (
                items.map((row, i) => (
                  <tr
                    key={row._id.toString()}
                    className="fs-reveal-child"
                    style={{ animationDelay: `${Math.min(i, 12) * 0.03}s` }}
                  >
                    <td className="font-medium text-white">{row.型号}</td>
                    <td>
                      {row.品牌}
                      {row.品牌中文名 ? (
                        <span className="ml-1 text-xs text-zinc-500">({row.品牌中文名})</span>
                      ) : null}
                    </td>
                    <td className="text-zinc-500">{row.产品线}</td>
                    <td className="whitespace-nowrap font-mono text-xs text-zinc-400" title="北京时间">
                      {formatDateTimeBeijing(row.导入时间)}
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/products/${row._id.toString()}?return=${encodeURIComponent(listReturnPath)}`}
                        className="group/c fs-pill-link"
                      >
                        详情
                        <span
                          aria-hidden
                          className="transition-transform duration-200 group-hover/c:translate-x-0.5"
                        >
                          →
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

      {totalPages > 1 ? (
        <div className="fs-pagination">
          {page > 1 ? (
            <Link href={`/products${buildQuery({ page: String(page - 1) })}`} className="fs-btn-ghost">
              上一页
            </Link>
          ) : null}
          {page < totalPages ? (
            <Link href={`/products${buildQuery({ page: String(page + 1) })}`} className="fs-btn-ghost">
              下一页
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
