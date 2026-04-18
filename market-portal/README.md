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

## 页面

- `/` — 总条数、按品牌统计、快捷入口  
- `/products` — 筛选品牌、关键词搜索、分页  
- `/products/[id]` — 单条详情与全部规格参数表  

数据库仅在 **服务端** 访问（Server Components），浏览器不直连 Mongo。
