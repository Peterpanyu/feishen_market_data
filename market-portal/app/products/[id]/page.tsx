import { notFound } from "next/navigation";
import { getProductById } from "@/lib/products";
import { formatDateTimeBeijing } from "@/lib/formatDate";
import { formatSpecValue } from "@/lib/formatSpecValue";
import { AddToCompareButton } from "@/components/AddToCompareButton";
import { DetailBackToCatalog } from "@/components/DetailBackToCatalog";

export const dynamic = "force-dynamic";

type Props = { params: { id: string }; searchParams: { return?: string } };

export default async function ProductDetailPage({ params, searchParams }: Props) {
  const { id } = params;
  let doc = null;
  try {
    doc = await getProductById(id);
  } catch {
    doc = null;
  }
  if (!doc) notFound();

  const 录入时间北京 = formatDateTimeBeijing(doc.导入时间);

  const entries = Object.entries(doc.规格参数 || {})
    .filter(([, v]) => !(typeof v === "boolean" && v === false))
    .sort(([a], [b]) => a.localeCompare(b, "zh"));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <DetailBackToCatalog
          returnRaw={searchParams.return}
          className="group/back fs-link inline-flex items-center gap-2 rounded-lg py-1 text-sm"
        >
          <span
            className="inline-block transition-transform duration-200 group-hover/back:-translate-x-0.5"
            aria-hidden
          >
            ←
          </span>
          返回目录
        </DetailBackToCatalog>
        <AddToCompareButton productId={id} />
      </div>

      <header className="space-y-3 border-b border-zinc-800/60 pb-6">
        <p className="fs-kicker">详情</p>
        <h1 className="fs-h1 fs-h1-accent">{doc.型号}</h1>
        <p className="flex flex-wrap gap-x-2 gap-y-1 text-sm text-zinc-400">
          <span className="font-medium text-white">{doc.品牌}</span>
          {doc.品牌中文名 ? <span>· {doc.品牌中文名}</span> : null}
          <span className="fs-meta-chip">{doc.产品线}</span>
        </p>
        <p className="fs-mono-muted border-l-2 border-red-900/50 pl-3 text-zinc-500">
          来源 {doc.来源文件} · 数据录入时间（北京时间）{录入时间北京}
        </p>
      </header>

      {doc.解析警告 && doc.解析警告.length > 0 ? (
        <div className="fs-panel-interactive fs-panel-rise border-amber-900/35 p-4 text-sm text-amber-100">
          <p className="fs-kicker text-amber-400">解析提示</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {doc.解析警告.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="fs-h2">规格参数</h2>
        <div className="fs-panel-interactive fs-panel--sticky-table p-0">
          <div className="fs-table-wrap fs-table-wrap--allow-sticky">
            <table className="fs-table fs-thead-sticky fs-table-spec">
              <thead>
                <tr>
                  <th scope="col" className="w-[40%] bg-zinc-950/95 font-mono text-xs text-red-200/80 backdrop-blur-sm">
                    参数项
                  </th>
                  <th scope="col" className="bg-zinc-950/95 text-zinc-400 backdrop-blur-sm">参数值</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-10 text-center text-zinc-500">
                      无参数表
                    </td>
                  </tr>
                ) : (
                  entries.map(([k, v]) => (
                    <tr key={k}>
                      <td className="w-[40%] font-mono text-xs text-red-200/75">{k}</td>
                      <td className="whitespace-pre-wrap break-words text-zinc-200">{formatSpecValue(v)}</td>
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
