/** @type {import('next').NextConfig} */
const nextConfig = {
  /** 生成可拷贝到任意目录运行的最小 Node 包（配合 scripts/lan-release.ps1） */
  output: "standalone",
};

export default nextConfig;
