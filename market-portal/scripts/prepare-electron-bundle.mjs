/**
 * 1) next build (standalone)
 * 2) 复制 standalone + static + public + .env.local 到 electron-launcher/bundle/next-app
 * 3) 从国内镜像下载 Windows 便携 Node 并解压到 electron-launcher/bundle/node
 * 4) 在 electron-launcher 执行 npm install（registry / electron 镜像见该目录 .npmrc）
 *
 * 环境变量：
 *   NODE_MIRROR   默认 https://npmmirror.com/mirrors/node
 *   NODE_PORTABLE_VERSION  默认 20.11.1
 */

import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const launcher = path.join(root, "electron-launcher");
const bundle = path.join(launcher, "bundle");
const nodeDir = path.join(bundle, "node");
const nextApp = path.join(bundle, "next-app");

const NODE_VER = process.env.NODE_PORTABLE_VERSION || "20.11.1";
const NODE_MIRROR = (process.env.NODE_MIRROR || "https://npmmirror.com/mirrors/node").replace(/\/$/, "");

/** 打包脚本内 npm / node-gyp / Electron 下载一律走国内镜像（可被环境变量覆盖） */
function mirrorEnv() {
  return {
    ...process.env,
    npm_config_registry: process.env.npm_config_registry || "https://registry.npmmirror.com",
    /** Electron / electron-builder 二进制走 npmmirror（勿写入 .npmrc，避免 npm 警告） */
    ELECTRON_MIRROR: process.env.ELECTRON_MIRROR || "https://npmmirror.com/mirrors/electron/",
    ELECTRON_BUILDER_BINARIES_MIRROR:
      process.env.ELECTRON_BUILDER_BINARIES_MIRROR ||
      "https://npmmirror.com/mirrors/electron-builder-binaries/",
  };
}
const ZIP_NAME = `node-v${NODE_VER}-win-x64.zip`;
const ZIP_URL = `${NODE_MIRROR}/v${NODE_VER}/${ZIP_NAME}`;
const INNER = `node-v${NODE_VER}-win-x64`;

function run(cmd, args, cwd = root, extraEnv = {}) {
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    shell: true,
    env: {
      ...mirrorEnv(),
      ...extraEnv,
    },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

/** Windows 大目录用 robocopy，避免 fs.cpSync 偶发崩溃 */
function copyDirRobust(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  if (process.platform === "win32") {
    const r = spawnSync("robocopy", [src, dest, "/E", "/MT:8", "/R:2", "/W:2", "/NFL", "/NDL", "/NJH", "/NJS"], {
      stdio: "inherit",
      shell: false,
    });
    const code = r.status ?? 0;
    if (code >= 8) {
      console.error(`[pack] robocopy 失败，退出码 ${code}`);
      process.exit(1);
    }
  } else {
    fs.cpSync(src, dest, { recursive: true });
  }
}

async function downloadFile(url, dest) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`下载失败 HTTP ${res.status}: ${url}\n可检查 NODE_MIRROR / NODE_PORTABLE_VERSION。`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  console.log(`[pack] 已下载 ${(buf.length / 1024 / 1024).toFixed(1)} MB -> ${dest}`);
}

function extractZip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  try {
    execFileSync("tar", ["-xf", zipPath, "-C", destDir], { stdio: "inherit" });
  } catch {
    console.log("[pack] tar 解压失败，改用 PowerShell Expand-Archive …");
    const ps = `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`;
    execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], { stdio: "inherit" });
  }
}

async function main() {
  console.log("[pack] 1/4  Next.js production build …");
  run("npm", ["run", "build"], root);

  const standalone = path.join(root, ".next", "standalone");
  if (!fs.existsSync(path.join(standalone, "server.js"))) {
    console.error("[pack] 缺少 .next/standalone/server.js，请确认 next.config.mjs 含 output: \"standalone\"");
    process.exit(1);
  }

  console.log("[pack] 2/4  复制 Next standalone -> electron-launcher/bundle/next-app …");
  let savedNodeDir = null;
  const existingNodeExe = path.join(nodeDir, "node.exe");
  if (process.env.NODE_SKIP_DOWNLOAD === "1" && fs.existsSync(existingNodeExe)) {
    savedNodeDir = path.join(os.tmpdir(), `feishen-node-save-${Date.now()}`);
    fs.cpSync(nodeDir, savedNodeDir, { recursive: true });
    console.log("[pack] 已暂存已有 Node 目录（NODE_SKIP_DOWNLOAD=1）");
  }
  fs.rmSync(bundle, { recursive: true, force: true });
  fs.mkdirSync(bundle, { recursive: true });
  if (savedNodeDir) {
    copyDirRobust(savedNodeDir, nodeDir);
    fs.rmSync(savedNodeDir, { recursive: true, force: true });
  }
  copyDirRobust(standalone, nextApp);

  const staticSrc = path.join(root, ".next", "static");
  const staticDest = path.join(nextApp, ".next", "static");
  fs.mkdirSync(path.dirname(staticDest), { recursive: true });
  copyDirRobust(staticSrc, staticDest);

  const pub = path.join(root, "public");
  if (fs.existsSync(pub)) {
    copyDirRobust(pub, path.join(nextApp, "public"));
  }

  const envLocal = path.join(root, ".env.local");
  if (fs.existsSync(envLocal)) {
    fs.copyFileSync(envLocal, path.join(nextApp, ".env.local"));
    console.log("[pack] 已复制 .env.local");
  } else {
    console.warn("[pack] 未找到 .env.local，exe 内需在 next-app 旁自行配置数据库（见 dist 说明）");
  }

  const nodeExe = path.join(nodeDir, "node.exe");
  if (fs.existsSync(nodeExe)) {
    console.log("[pack] 3/4  已存在 bundle/node/node.exe，跳过 Node 下载");
  } else {
    console.log("[pack] 3/4  下载 Node 便携版（国内镜像）…");
    console.log(`[pack] URL: ${ZIP_URL}`);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "feishen-node-"));
    const zipPath = path.join(tmp, ZIP_NAME);
    await downloadFile(ZIP_URL, zipPath);
    extractZip(zipPath, tmp);
    const extracted = path.join(tmp, INNER);
    if (!fs.existsSync(extracted)) {
      console.error(`[pack] 解压后未找到目录: ${extracted}`);
      process.exit(1);
    }
    fs.rmSync(nodeDir, { recursive: true, force: true });
    fs.mkdirSync(nodeDir, { recursive: true });
    copyDirRobust(extracted, nodeDir);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`[pack] Node 已就绪: ${nodeExe}`);
  }

  console.log("[pack] 4/4  electron-launcher 依赖安装（npmmirror registry + electron_mirror）…");
  /** 全局 npm 若设置 omit=dev，必须显式包含 devDependencies */
  run("npm", ["install", "--include=dev", "--no-fund", "--no-audit"], launcher);

  console.log("\n[pack] 准备完成。在 market-portal 根目录执行:\n  npm run pack:exe:dist\n将生成 dist-exe 下的 Windows portable exe。\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
