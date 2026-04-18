import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { TechBackdrop } from "@/components/TechBackdrop";

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
  title: "市场洞察门户",
  description: "竞品参数与市场数据浏览",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${outfit.variable} ${jetbrains.variable}`}>
      <body className="font-sans antialiased min-h-screen bg-[var(--bg-deep)] text-[var(--text)] tech-scanline">
        <TechBackdrop />
        <Nav />
        <main className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
