"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "概览" },
  { href: "/products", label: "竞品目录" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg)]/70 backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--bg)]/50">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2 font-semibold tracking-tight text-white transition-transform duration-200 hover:scale-[1.02]"
        >
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/30 bg-gradient-to-br from-cyan-500/20 to-violet-600/20 text-sm font-mono text-cyan-300 shadow-glow transition-all duration-300 group-hover:border-cyan-400/50 group-hover:shadow-glow"
            aria-hidden
          >
            ◈
          </span>
          <span className="bg-gradient-to-r from-white via-cyan-100 to-cyan-300/90 bg-clip-text text-transparent">
            市场洞察门户
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {links.map(({ href, label }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`relative rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  active
                    ? "text-cyan-200 shadow-[inset_0_0_20px_-8px_rgba(34,211,238,0.35)]"
                    : "text-[var(--muted)] hover:text-cyan-100"
                }`}
              >
                {active ? (
                  <span
                    className="absolute inset-0 -z-10 rounded-lg border border-cyan-500/25 bg-cyan-500/10"
                    aria-hidden
                  />
                ) : null}
                <span className="relative">{label}</span>
                {active ? (
                  <span
                    className="absolute bottom-1 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
                    aria-hidden
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
