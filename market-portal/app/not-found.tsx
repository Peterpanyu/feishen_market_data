import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[42vh] flex-col items-center justify-center gap-6 py-20 text-center">
      <p className="font-mono text-6xl font-bold tabular-nums text-red-600/20 animate-fs-pulse-soft sm:text-7xl">
        404
      </p>
      <div className="fs-panel max-w-sm px-6 py-5">
        <h1 className="fs-h1 fs-h1-accent text-xl">页面不存在</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">链接可能已失效，或资源已被移除。</p>
      </div>
      <Link href="/products" className="fs-btn-primary">
        竞品目录
      </Link>
    </div>
  );
}
