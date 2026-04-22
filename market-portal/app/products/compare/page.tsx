import Link from "next/link";
import { getProductsByIds } from "@/lib/products";
import { formatSpecValue } from "@/lib/formatSpecValue";
import { formatDateTimeBeijing } from "@/lib/formatDate";
import { COMPARE_MAX } from "@/lib/compareSelectionShared";
import type { MarketProductDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = { searchParams: Record<string, string | string[] | undefined> };

function parseIdsFromSearchParams(sp: Record<string, string | string[] | undefined>): string[] {
  const rawIds = sp.ids;
  const chunks: string[] = [];
  if (typeof rawIds === "string") chunks.push(rawIds);
  else if (Array.isArray(rawIds)) chunks.push(...rawIds);
  const rawId = sp.id;
  if (typeof rawId === "string") chunks.push(rawId);
  else if (Array.isArray(rawId)) chunks.push(...rawId);
  const flat = chunks
    .join(",")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set(flat)).slice(0, COMPARE_MAX);
}

const META_ROWS: { key: keyof MarketProductDoc | "__warn"; label: string }[] = [
  { key: "型号", label: "型号" },
  { key: "品牌", label: "品牌" },
  { key: "品牌中文名", label: "品牌中文名" },
  { key: "产品线", label: "产品线" },
  { key: "来源文件", label: "来源文件" },
  { key: "导入时间", label: "数据录入时间（北京）" },
  { key: "__warn", label: "解析提示" },
];

function metaCell(doc: MarketProductDoc, rowKey: (typeof META_ROWS)[number]["key"]): string {
  if (rowKey === "__warn") {
    const w = doc.解析警告;
    if (!w?.length) return "";
    return w.join("；");
  }
  if (rowKey === "导入时间") return formatDateTimeBeijing(doc.导入时间);
  const v = doc[rowKey];
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return formatDateTimeBeijing(v);
  return String(v);
}

function collectSpecKeys(docs: MarketProductDoc[]): string[] {
  const keys = new Set<string>();
  for (const d of docs) {
    const spec = d.规格参数 || {};
    for (const k of Object.keys(spec)) {
      if (typeof spec[k] === "boolean" && spec[k] === false) continue;
      keys.add(k);
    }
  }
  return Array.from(keys).sort((a, b) => a.localeCompare(b, "zh"));
}

export default async function ComparePage({ searchParams }: Props) {
  const idList = parseIdsFromSearchParams(searchParams);
  let error: string | null = null;
  let docs: MarketProductDoc[] = [];

  try {
    docs = await getProductsByIds(idList, COMPARE_MAX);
  } catch (e) {
    error = e instanceof Error ? e.message : "加载失败";
  }

  if (error) {
    return (
      <div className="fs-panel-interactive max-w-xl border-red-900/45 bg-red-950/20 p-5">
        <p className="fs-kicker text-red-300/90">对比加载失败</p>
        <p className="mt-2 text-sm leading-relaxed text-red-100/90">{error}</p>
        <p className="mt-3 text-sm">
          <Link href="/products" className="fs-link">
            返回竞品目录
          </Link>
        </p>
      </div>
    );
  }

  if (idList.length < 2) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-2">
          <p className="fs-kicker">对比</p>
          <h1 className="fs-h1 fs-h1-accent">多产品参数对比</h1>
          <p className="text-sm leading-relaxed text-zinc-500">
            在「竞品目录」中勾选多款产品（最多 {COMPARE_MAX} 款），点击底部「参数对比」打开本页；或在产品详情页使用「加入对比栏」后再从目录继续选择。
          </p>
        </header>
        <div className="fs-panel-interactive fs-panel-rise p-5 text-sm text-zinc-400">
          <p>当前链接中有效产品不足 2 款。请从目录勾选至少 2 条记录，或使用下方链接返回。</p>
          <p className="mt-4">
            <Link href="/products" className="fs-link">
              前往竞品目录
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const missing = idList.filter((id) => !docs.some((d) => d._id.toString() === id));
  const specKeys = collectSpecKeys(docs);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <header className="space-y-2">
          <p className="fs-kicker">对比</p>
          <h1 className="fs-h1 fs-h1-accent">参数对比</h1>
          <p className="max-w-xl text-sm text-zinc-500">
            共 <span className="tabular-nums text-zinc-300">{docs.length}</span> 款；主档信息与规格参数并排对照。
          </p>
        </header>
        <Link href="/products" className="fs-btn-ghost shrink-0 text-sm">
          ← 返回目录
        </Link>
      </div>

      {missing.length > 0 ? (
        <div className="fs-panel-interactive border-amber-900/40 bg-amber-950/15 p-4 text-sm text-amber-100/95">
          以下 ID 未找到记录（可能已删除或无效）：{" "}
          <span className="font-mono text-xs text-amber-200/90">{missing.join(", ")}</span>
        </div>
      ) : null}

      {docs.length < 2 ? (
        <div className="fs-panel-interactive p-6 text-sm text-zinc-400">可对比的产品少于 2 款。</div>
      ) : (
        <div className="fs-panel-interactive fs-panel--sticky-table p-0">
          <div className="fs-table-wrap fs-table-wrap--allow-sticky">
            <table className="fs-table fs-table-compare fs-thead-sticky text-sm">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 min-w-[8.5rem] bg-zinc-950/95 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.65)] backdrop-blur-sm"
                  >
                    参数
                  </th>
                  {docs.map((d) => (
                    <th
                      key={d._id.toString()}
                      scope="col"
                      className="min-w-[10.5rem] align-bottom bg-gradient-to-b from-zinc-900/95 to-zinc-950/90 font-semibold normal-case tracking-normal text-white"
                    >
                      <div className="space-y-1">
                        <div>{d.型号}</div>
                        <div className="font-mono text-xs font-normal text-zinc-500">{d.品牌}</div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {META_ROWS.map((row) => (
                  <tr key={String(row.key)}>
                    <th
                      scope="row"
                      className="sticky left-0 z-20 bg-zinc-950/95 font-mono text-xs font-normal text-red-200/80 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.65)] backdrop-blur-sm"
                    >
                      {row.label}
                    </th>
                    {docs.map((d) => (
                      <td
                        key={d._id.toString()}
                        className="relative z-0 whitespace-pre-wrap break-words bg-zinc-950/40 text-zinc-200"
                      >
                        {metaCell(d, row.key) || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
                {specKeys.length === 0 ? (
                  <tr>
                    <td colSpan={docs.length + 1} className="py-10 text-center text-zinc-500">
                      所选产品均无规格参数字段
                    </td>
                  </tr>
                ) : (
                  specKeys.map((k) => (
                    <tr key={k}>
                      <th
                        scope="row"
                        className="sticky left-0 z-20 bg-zinc-950/95 font-mono text-xs font-normal text-red-200/75 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.65)] backdrop-blur-sm"
                      >
                        {k}
                      </th>
                      {docs.map((d) => {
                        const raw = (d.规格参数 || {})[k];
                        if (raw === undefined)
                          return (
                            <td key={d._id.toString()} className="relative z-0 bg-zinc-950/40 text-zinc-600">
                              —
                            </td>
                          );
                        if (typeof raw === "boolean" && raw === false)
                          return (
                            <td key={d._id.toString()} className="relative z-0 bg-zinc-950/40 text-zinc-600">
                              —
                            </td>
                          );
                        return (
                          <td
                            key={d._id.toString()}
                            className="relative z-0 whitespace-pre-wrap break-words bg-zinc-950/40 text-zinc-200"
                          >
                            {formatSpecValue(raw)}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
