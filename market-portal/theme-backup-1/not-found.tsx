import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 py-16 text-center">
      <div className="font-mono text-6xl font-bold tabular-nums text-cyan-500/30">404</div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-white">未找到该页面</h1>
        <p className="max-w-sm text-sm text-[var(--muted)]">链接可能已失效，或资源已被移动。</p>
      </div>
      <Link
        href="/products"
        className="btn-tech inline-flex items-center gap-2 !text-slate-950 no-underline"
      >
        返回竞品目录
      </Link>
    </div>
  );
}
