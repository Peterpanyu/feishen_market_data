import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "市场洞察 | 飞神 FEISHEN",
  description: "飞神集团 · 竞品参数与市场数据",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${outfit.variable} ${jetbrains.variable}`}>
      <body className="font-sans antialiased fs-scanline">
        <div className="fs-shell relative">
          <div className="fs-ambient" aria-hidden>
            <div
              className="fs-ambient-orb -left-20 top-0 h-[min(55vw,420px)] w-[min(55vw,420px)] bg-red-600/20"
              style={{ animationDelay: "-3s" }}
            />
            <div
              className="fs-ambient-orb bottom-0 right-[-10%] h-[min(60vw,480px)] w-[min(60vw,480px)] bg-zinc-600/15"
              style={{ animationDelay: "-8s" }}
            />
          </div>
          <div className="pointer-events-none fixed inset-0 -z-10 fs-grid-bg opacity-50" aria-hidden />
          <SiteHeader />
          <main className="fs-main-enter relative mx-auto max-w-6xl px-4 py-9 sm:px-6 sm:py-14">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
