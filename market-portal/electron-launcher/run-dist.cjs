/**
 * 为 electron-builder 设置国内镜像（Electron、app-builder、7za 等二进制），再执行打包。
 */
const { spawnSync } = require("child_process");

process.env.npm_config_registry =
  process.env.npm_config_registry || "https://registry.npmmirror.com";
process.env.ELECTRON_MIRROR =
  process.env.ELECTRON_MIRROR || "https://npmmirror.com/mirrors/electron/";
process.env.ELECTRON_BUILDER_BINARIES_MIRROR =
  process.env.ELECTRON_BUILDER_BINARIES_MIRROR ||
  "https://npmmirror.com/mirrors/electron-builder-binaries/";

const r = spawnSync("npx electron-builder --win portable --x64", {
  stdio: "inherit",
  shell: true,
  env: process.env,
  cwd: __dirname,
});

if (r.status !== 0) process.exit(r.status ?? 1);
