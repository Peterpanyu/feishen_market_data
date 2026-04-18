# 市场洞察门户（market-portal）

独立 Next.js 前端：只读浏览 `market-data` 导入的 MongoDB **竞品产品** 数据。

## 准备

1. 已用 `../market-data` 将 CSV 导入 Mongo（库名、集合名与下方环境变量一致）。
2. 复制环境变量：

```powershell
cd market-portal
copy .env.local.example .env.local
```

按需修改 `MONGODB_URI`、`MONGODB_DB_NAME`（默认 `市场洞察库`）、`MONGODB_COLLECTION`（默认 `竞品产品`）。

## 运行

```powershell
npm.cmd install
npm.cmd run dev
```

浏览器打开 **http://localhost:3010**（与 PLM 的 3000 端口错开）。

## 局域网访问

- **开发**：在本机执行 `npm run dev:lan`，监听 `0.0.0.0:3010`，其它电脑用 `http://<本机局域网IP>:3010` 打开。
- **生产**：先 `npm run build`，再 `npm run start`（已绑定 `0.0.0.0:3010`）。仅本机访问可用 `npm run start:local`。
- **封包拷贝到其它电脑**：在项目根执行 `npm run release:lan`，生成目录 `release/market-portal-lan/`（内含 `start-lan.bat`、`LAN_DEPLOY.txt`、`.env.local` 若存在）。目标机需安装 **Node.js 18+**，解压后双击 `start-lan.bat`。若打不开，在运行机上放行防火墙 **入站 TCP 3010**。

### Windows 单文件 exe（用户无需安装 Node / npm）

在**已安装 Node.js 的打包机**上（仅打包需要），于 `market-portal` 根目录执行：

```powershell
npm run pack:exe
```

- **准备阶段**（`scripts/prepare-electron-bundle.mjs`）：`next build`；从 **npmmirror** 下载 Windows 便携 Node（可用环境变量 `NODE_MIRROR`、`NODE_PORTABLE_VERSION` 覆盖）；复制 standalone 与 `.env.local`（若有）；在 `electron-launcher` 使用 **npmmirror registry**；安装与打包时通过环境变量使用 **Electron** 与 **electron-builder 二进制** 国内镜像（`ELECTRON_MIRROR`、`ELECTRON_BUILDER_BINARIES_MIRROR`，见 `electron-launcher/run-dist.cjs` 与 prepare 脚本）。
- **产物**：`dist-exe/` 下 **portable** 可执行文件（文件名形如 `FeiShen-MarketInsight-0.1.0-portable.exe`）。双击即可打开内置浏览器窗口访问本机 `127.0.0.1:3010` 上的 Next 服务；**Mongo 连接仍读打包时带入的 `.env.local`**（若当时无此文件，需在源码根补全后重新 `pack:exe`）。
- **二次打包加速**：若已下载过 Node，可设 `NODE_SKIP_DOWNLOAD=1` 再执行 `npm run pack:exe:prepare`，将复用 `electron-launcher/bundle/node`（仍会重新 `next build` 并刷新 `next-app`）。

> 说明：exe 体积较大（含 Chromium + Node + 站点资源）。仅支持 **Windows x64**。

## 页面

- `/` — 总条数、按品牌统计、快捷入口  
- `/products` — 筛选品牌、关键词搜索、分页  
- `/products/[id]` — 单条详情与全部规格参数表  

数据库仅在 **服务端** 访问（Server Components），浏览器不直连 Mongo。
