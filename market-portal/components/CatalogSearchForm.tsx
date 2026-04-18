"use client";

import { useCallback, useEffect, useState } from "react";
import type { ListSortKey } from "@/lib/listSortKey";
import {
  SEARCH_FIELD_OPTIONS,
  SEARCH_OP_OPTIONS,
  productsListQueryString,
  type SearchRuleRow,
} from "@/lib/listSearchParams";

type Props = {
  brands: string[];
  productLines: string[];
  initialBrands: string[];
  initialProductLines: string[];
  initialRules: SearchRuleRow[];
  initialQ: string;
  rulesVersion: string;
  /** 表头排序状态，查询时保留在 URL */
  listSort?: { key: ListSortKey; dir: "asc" | "desc" };
};

function cloneRules(rules: SearchRuleRow[]): SearchRuleRow[] {
  return rules.map((r) => ({ ...r }));
}

/** 复选框多选 + 全选/清空，避免原生 multi-select 在部分环境下不跟手 */
function MultiPickBlock({
  title,
  options,
  selected,
  onChange,
  hint,
}: {
  title: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  hint: string;
}) {
  const selectAll = useCallback(() => {
    onChange([...options]);
  }, [options, onChange]);

  const clearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const toggle = (value: string, checked: boolean) => {
    if (checked) {
      if (selected.includes(value)) return;
      onChange([...selected, value]);
    } else {
      onChange(selected.filter((x) => x !== value));
    }
  };

  return (
    <div className="fs-multi-pick rounded-lg border border-zinc-800/90 bg-zinc-950/40">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 px-3 py-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-xs font-medium text-zinc-300">{title}</span>
          <span className="font-mono text-[10px] text-zinc-600">
            已选 {selected.length}/{options.length}
          </span>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={selectAll}
            disabled={options.length === 0}
            className="rounded-md border border-red-900/40 bg-red-950/30 px-2 py-1 text-[11px] font-medium text-red-200 transition-colors hover:border-red-500/50 hover:bg-red-900/40 disabled:opacity-30"
          >
            全选
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={selected.length === 0}
            className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-30"
          >
            清空
          </button>
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto overscroll-contain px-2 py-2">
        {options.length === 0 ? (
          <p className="px-1 py-3 text-center text-xs text-zinc-600">暂无选项</p>
        ) : (
          <ul className="fs-multi-pick-list space-y-0.5">
            {options.map((opt) => {
              const on = selected.includes(opt);
              return (
                <li key={opt}>
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                      on ? "bg-red-950/35 text-red-100" : "text-zinc-300 hover:bg-zinc-900/80"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 shrink-0 rounded border-zinc-600 bg-zinc-900 text-red-600 focus:ring-red-500/40"
                      checked={on}
                      onChange={(e) => toggle(opt, e.target.checked)}
                    />
                    <span className="min-w-0 flex-1 break-words">{opt}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="border-t border-zinc-800/60 px-3 py-1.5 text-[10px] leading-relaxed text-zinc-600">{hint}</p>
    </div>
  );
}

export function CatalogSearchForm({
  brands,
  productLines,
  initialBrands,
  initialProductLines,
  initialRules,
  initialQ,
  rulesVersion,
  listSort,
}: Props) {
  const [selBrands, setSelBrands] = useState<string[]>(() => [...initialBrands]);
  const [selLines, setSelLines] = useState<string[]>(() => [...initialProductLines]);
  const [rules, setRules] = useState<SearchRuleRow[]>(() =>
    initialRules.length ? cloneRules(initialRules) : [{ sf: "", so: "contains", sv: "" }],
  );
  const [qText, setQText] = useState(initialQ);
  const [searchBusy, setSearchBusy] = useState(false);

  useEffect(() => {
    setSelBrands([...initialBrands]);
    setSelLines([...initialProductLines]);
    setRules(initialRules.length ? cloneRules(initialRules) : [{ sf: "", so: "contains", sv: "" }]);
    setQText(initialQ);
  }, [rulesVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const addRule = () => {
    setRules((r) => [...r, { sf: "", so: "contains", sv: "" }]);
  };

  const removeRule = (i: number) => {
    setRules((r) => (r.length <= 1 ? r : r.filter((_, j) => j !== i)));
  };

  const patchRule = (i: number, patch: Partial<SearchRuleRow>) => {
    setRules((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  };

  const applySearch = () => {
    const qs = productsListQueryString(rules, {
      brands: selBrands.length ? selBrands : undefined,
      productLines: selLines.length ? selLines : undefined,
      q: qText.trim() || undefined,
      page: undefined,
      sort: listSort?.key,
      dir: listSort?.dir,
    });
    const path = qs ? `/products?${qs}` : "/products";
    setSearchBusy(true);
    window.setTimeout(() => {
      window.location.assign(path);
    }, 120);
  };

  return (
    <div className="fs-panel-interactive fs-panel-rise overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800/80 bg-gradient-to-r from-red-950/20 via-zinc-950/40 to-transparent px-4 py-3.5 sm:px-5">
        <span className="flex items-center gap-2.5 fs-kicker">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400/40 opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 shadow-fs-glow-sm" />
          </span>
          检索条件
        </span>
        <span className="hidden text-right sm:block">
          <span className="block fs-mono-muted">多字段 AND</span>
          <span className="mt-0.5 block text-[10px] text-zinc-600">全文 q 与下方结果联动</span>
        </span>
        <span className="fs-mono-muted sm:hidden">AND · q</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="space-y-4">
          <div className="fs-form-stagger grid gap-4 sm:grid-cols-2">
            <MultiPickBlock
              title="品牌"
              options={brands}
              selected={selBrands}
              onChange={setSelBrands}
              hint="勾选表示仅看所选品牌；不勾选任何项表示「全部品牌」。选项已按字母顺序排列。"
            />
            <MultiPickBlock
              title="产品线"
              options={productLines}
              selected={selLines}
              onChange={setSelLines}
              hint="勾选表示仅看所选产品线；不勾选任何项表示「全部产品线」。"
            />
          </div>

        <div className="space-y-3">
          <p className="text-xs text-zinc-500">字段条件（至少填「字段」；多条为 AND）</p>
          {rules.map((row, i) => (
            <div
              key={i}
              className="fs-panel-inner fs-rule-row flex flex-wrap items-end gap-2 p-3 sm:gap-3"
            >
              <span className="w-6 shrink-0 text-center font-mono text-[10px] text-zinc-600">{i + 1}</span>
              <div className="min-w-[160px] flex-1">
                <label className="mb-0.5 block text-[10px] text-zinc-600">字段</label>
                <select
                  value={row.sf}
                  onChange={(e) => patchRule(i, { sf: e.target.value })}
                  className="fs-select"
                >
                  {SEARCH_FIELD_OPTIONS.map((opt) => (
                    <option key={opt.value || "__none"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[120px]">
                <label className="mb-0.5 block text-[10px] text-zinc-600">条件</label>
                <select
                  value={row.so}
                  onChange={(e) => patchRule(i, { so: e.target.value })}
                  className="fs-select"
                >
                  {SEARCH_OP_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[100px] max-w-[220px] flex-1">
                <label className="mb-0.5 block text-[10px] text-zinc-600">值</label>
                <input
                  type="text"
                  value={row.sv}
                  onChange={(e) => patchRule(i, { sv: e.target.value })}
                  placeholder="子串或数值"
                  className="fs-input"
                />
              </div>
              <button
                type="button"
                onClick={() => removeRule(i)}
                disabled={rules.length <= 1}
                className="fs-btn shrink-0 border border-zinc-700 bg-transparent px-2 py-2 text-xs text-zinc-500 hover:border-red-900/60 hover:text-red-300 disabled:opacity-30"
              >
                删
              </button>
            </div>
          ))}
        </div>

        <div>
          <label className="mb-1 block text-xs text-zinc-500">补充全文（可选，与字段 AND）</label>
          <input
            type="search"
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder="如：轻蜂、液压；或 价格_RMB>=5000"
            className="fs-input"
          />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-zinc-800/60 pt-4">
          <button type="button" onClick={addRule} className="fs-btn-ghost text-sm">
            + 添加条件行
          </button>
          <button
            type="button"
            disabled={searchBusy}
            onClick={applySearch}
            className="fs-btn-primary min-w-[5.5rem] px-6"
          >
            {searchBusy ? (
              <span className="inline-flex items-center gap-2">
                <span
                  className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  aria-hidden
                />
                加载
              </span>
            ) : (
              "查询"
            )}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
