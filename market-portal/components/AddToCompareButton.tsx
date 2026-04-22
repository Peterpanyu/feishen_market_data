"use client";

import { useCallback, useState } from "react";
import { addCompareIdToStorage, COMPARE_MAX } from "@/lib/compareSelectionShared";

export function AddToCompareButton({ productId }: { productId: string }) {
  const [hint, setHint] = useState<string | null>(null);

  const onClick = useCallback(() => {
    const r = addCompareIdToStorage(productId);
    if (r.ok) setHint("已加入对比栏");
    else if (r.reason === "duplicate") setHint("已在对比栏中");
    else if (r.reason === "full") setHint(`对比栏已满（最多 ${COMPARE_MAX} 款）`);
    else setHint("无法加入");
    window.setTimeout(() => setHint(null), 2200);
  }, [productId]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={onClick} className="fs-btn-ghost text-sm">
        加入对比栏
      </button>
      {hint ? <span className="text-xs text-zinc-500">{hint}</span> : null}
    </div>
  );
}
