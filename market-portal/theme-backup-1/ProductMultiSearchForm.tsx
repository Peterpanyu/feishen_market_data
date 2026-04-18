"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  SEARCH_FIELD_OPTIONS,
  SEARCH_OP_OPTIONS,
  productsListQueryString,
  type SearchRuleRow,
} from "@/lib/listSearchParams";

type Props = {
  brands: string[];
  initialBrand: string;
  initialRules: SearchRuleRow[];
  initialQ: string;
  rulesVersion: string;
};

export function ProductMultiSearchForm({
  brands,
  initialBrand,
  initialRules,
  initialQ,
  rulesVersion,
}: Props) {
  const router = useRouter();
  const [brand, setBrand] = useState(initialBrand);
  const [rules, setRules] = useState<SearchRuleRow[]>(() =>
    initialRules.length ? initialRules : [{ sf: "", so: "contains", sv: "" }],
  );
  const [qText, setQText] = useState(initialQ);

  useEffect(() => {
    setBrand(initialBrand);
    setRules(initialRules.length ? initialRules : [{ sf: "", so: "contains", sv: "" }]);
    setQText(initialQ);
  }, [rulesVersion, initialBrand, initialQ, initialRules]);

  const addRule = () => {
    setRules((r) => [...r, { sf: "", so: "contains", sv: "" }]);
  };

  const removeRule = (i: number) => {
    setRules((r) => (r.length <= 1 ? r : r.filter((_, j) => j !== i)));
  };

  const patchRule = (i: number, patch: Partial<SearchRuleRow>) => {
    setRules((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  };

  const runSearch = () => {
    const qs = productsListQueryString(rules, {
      brand: brand.trim() || undefined,
      q: qText.trim() || undefined,
    });
    router.push(qs ? `/products?${qs}` : "/products");
  };

  return (
    <div className="glass-panel p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2 border-b border-cyan-500/10 pb-3">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
        <span className="font-mono text-xs uppercase tracking-wider text-cyan-400/80">Query builder</span>
      </div>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
      >
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="mb-1 block text-xs text-cyan-200/50">品牌</label>
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="input-tech min-w-[160px]"
            >
              <option value="">全部</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-xs text-cyan-100/40">检索条件（多条为 AND）</div>
          {rules.map((row, i) => (
            <div
              key={i}
              className="flex flex-wrap items-end gap-2 rounded-xl border border-cyan-500/10 bg-slate-950/40 p-3 transition-all duration-300 hover:border-cyan-500/25"
            >
              <span className="w-7 shrink-0 self-center text-center font-mono text-[10px] text-cyan-500/50">
                {i + 1}
              </span>
              <div className="min-w-[180px] flex-1">
                <label className="mb-0.5 block text-[10px] text-slate-500">字段</label>
                <select
                  value={row.sf}
                  onChange={(e) => patchRule(i, { sf: e.target.value })}
                  className="input-tech w-full"
                >
                  {SEARCH_FIELD_OPTIONS.map((opt) => (
                    <option key={opt.value || "__none"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[130px]">
                <label className="mb-0.5 block text-[10px] text-slate-500">条件</label>
                <select
                  value={row.so}
                  onChange={(e) => patchRule(i, { so: e.target.value })}
                  className="input-tech w-full"
                >
                  {SEARCH_OP_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[120px] max-w-[240px] flex-1">
                <label className="mb-0.5 block text-[10px] text-slate-500">比较值 / 子串</label>
                <input
                  type="text"
                  value={row.sv}
                  onChange={(e) => patchRule(i, { sv: e.target.value })}
                  placeholder="数值或文字"
                  className="input-tech w-full"
                />
              </div>
              <button
                type="button"
                onClick={() => removeRule(i)}
                disabled={rules.length <= 1}
                className="shrink-0 rounded-lg border border-white/10 px-2.5 py-2 text-xs text-slate-400 transition-all hover:border-red-400/40 hover:bg-red-950/30 hover:text-red-300 disabled:pointer-events-none disabled:opacity-25"
              >
                删除
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={addRule}
            className="rounded-xl border border-cyan-500/25 bg-slate-950/50 px-4 py-2.5 text-sm text-cyan-100 transition-all duration-200 hover:border-cyan-400/50 hover:bg-cyan-950/40 active:scale-[0.98]"
          >
            + 添加检索字段
          </button>
          <button type="submit" className="btn-tech">
            查询
          </button>
        </div>

        <div>
          <label className="mb-1 block text-xs text-cyan-200/50">补充全文（可选）</label>
          <input
            type="search"
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder="例如 轻蜂、液压；可与字段条件 AND"
            className="input-tech w-full"
          />
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
            地址栏参数 <span className="font-mono text-cyan-600/80">r0_sf</span> 等；补充框支持高级表达式（如{" "}
            <code className="font-mono text-cyan-500/80">价格_RMB&gt;=5000</code>）。
          </p>
        </div>
      </form>
    </div>
  );
}
