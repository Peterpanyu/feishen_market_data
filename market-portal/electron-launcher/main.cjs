const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");

const PORT = process.env.MARKET_PORTAL_PORT || "3010";
const START_URL = `http://127.0.0.1:${PORT}`;

/** 先显示窗口，避免白屏等待（感知启动更快） */
const LOADING_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'unsafe-inline';"><style>body{margin:0;background:#030303;color:#a1a1aa;font:14px system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:18px}.s{width:36px;height:36px;border:3px solid #27272a;border-top-color:#f87171;border-radius:50%;animation:r .75s linear infinite}@keyframes r{to{transform:rotate(360deg)}}small{opacity:.65;font-size:12px}</style></head><body><div class="s"></div><div>正在启动本地服务…</div><small>首次启动可能需数秒</small></body></html>`;

function resourceRoot() {
  if (app.isPackaged) {
    return process.resourcesPath;
  }
  return path.join(__dirname, "bundle");
}

function nodePaths() {
  const root = resourceRoot();
  const nodeExe = path.join(root, "node", "node.exe");
  const nextApp = path.join(root, "next-app");
  return { nodeExe, nextApp };
}

/**
 * 与 Next 进程并行：前段高频探测（默认 60ms），之后略放缓，尽快在端口就绪时连上。
 */
function waitForHttp(url, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(url, { timeout: 1500 }, (res) => {
        res.resume();
        resolve();
      });
      req.on("timeout", () => {
        try {
          req.destroy();
        } catch {
          /* ignore */
        }
        scheduleRetry();
      });
      req.on("error", scheduleRetry);

      function scheduleRetry() {
        if (Date.now() > deadline) {
          reject(new Error(`无法在 ${timeoutMs / 1000}s 内连上 ${url}`));
          return;
        }
        const delay = attempt < 45 ? 60 : attempt < 100 ? 120 : 200;
        attempt += 1;
        setTimeout(tryOnce, delay);
      }
    };
    tryOnce();
  });
}

let serverProcess = null;
let mainWindow = null;
let isQuiting = false;

function startNextServer() {
  const { nodeExe, nextApp } = nodePaths();
  if (!fs.existsSync(nodeExe)) {
    throw new Error(`未找到内置 Node：\n${nodeExe}\n请使用 npm run pack:exe 重新打包。`);
  }
  if (!fs.existsSync(path.join(nextApp, "server.js"))) {
    throw new Error(`未找到 Next 独立服务：\n${path.join(nextApp, "server.js")}`);
  }

  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT,
    HOSTNAME: "127.0.0.1",
    NEXT_TELEMETRY_DISABLED: "1",
  };

  serverProcess = spawn(nodeExe, ["server.js"], {
    cwd: nextApp,
    env,
    windowsHide: true,
    stdio: "ignore",
  });

  serverProcess.on("error", (err) => {
    dialog.showErrorBox("启动失败", String(err?.message || err));
  });

  serverProcess.on("exit", (code) => {
    if (code !== 0 && code !== null && !isQuiting) {
      dialog.showErrorBox("服务退出", `Next 进程异常退出，代码 ${code}`);
    }
  });
}

function stopNextServer() {
  if (serverProcess && !serverProcess.killed) {
    try {
      serverProcess.kill();
    } catch {
      /* ignore */
    }
    serverProcess = null;
  }
}

function createLoadingWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: "飞神市场洞察",
    backgroundColor: "#030303",
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const loading =
    "data:text/html;charset=utf-8," + encodeURIComponent(LOADING_HTML);
  mainWindow.loadURL(loading);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  /** 与 Electron 图形栈并行：尽早拉起 Next，缩短「进程已开但端口未就绪」的空窗 */
  let serverBootPromise = Promise.resolve();
  let bootSyncError = null;
  try {
    startNextServer();
    serverBootPromise = waitForHttp(START_URL);
  } catch (e) {
    bootSyncError = e;
    serverBootPromise = Promise.reject(e);
  }

  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    if (bootSyncError) {
      dialog.showErrorBox("市场洞察", String(bootSyncError?.message || bootSyncError));
      app.quit();
      return;
    }

    createLoadingWindow();

    try {
      await serverBootPromise;
      if (mainWindow && !mainWindow.isDestroyed()) {
        await mainWindow.loadURL(START_URL);
      }
    } catch (e) {
      dialog.showErrorBox("市场洞察", String(e?.message || e));
      app.quit();
    }
  });

  app.on("window-all-closed", () => {
    stopNextServer();
    app.quit();
  });

  app.on("before-quit", () => {
    isQuiting = true;
    stopNextServer();
  });
}
