const { app, BrowserWindow, dialog } = require("electron");
const { spawn, spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");
const os = require("os");

/**
 * 默认开启硬件加速（页面更流畅）。
 * 若遇「窗口已打开但内容全黑」，可在启动前设置环境变量 FEISHEN_DISABLE_GPU=1 关闭 GPU 加速作为规避。
 */
if (process.env.FEISHEN_DISABLE_GPU === "1") {
  app.disableHardwareAcceleration();
}

/** 减轻切后台/遮挡检测带来的渲染节流与卡顿（Chromium 开关） */
app.commandLine.appendSwitch("disable-renderer-backgrounding");
if (process.platform === "win32") {
  app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");
}

const PORT = process.env.MARKET_PORTAL_PORT || "3010";
const START_URL = `http://127.0.0.1:${PORT}`;

/** Next 子进程日志（仅用于排查启动失败）；可在 app.ready 之前使用 */
function nextLogPath() {
  try {
    if (app.isReady()) return path.join(app.getPath("temp"), "FeiShenMarketInsight-next.log");
  } catch {
    /* ignore */
  }
  return path.join(os.tmpdir(), "FeiShenMarketInsight-next.log");
}

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
          const logHint = fs.existsSync(nextLogPath())
            ? `\n\n详细日志：\n${nextLogPath()}`
            : "";
          reject(
            new Error(`无法在 ${timeoutMs / 1000}s 内连上 ${url}${logHint}`),
          );
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

  const logFile = nextLogPath();
  let logStream;
  try {
    logStream = fs.createWriteStream(logFile, { flags: "a" });
    logStream.write(
      `\n---- ${new Date().toISOString()} 启动 Next ----\n资源目录: ${resourceRoot()}\n工作目录: ${nextApp}\n`,
    );
  } catch {
    logStream = null;
  }

  serverProcess = spawn(nodeExe, ["server.js"], {
    cwd: nextApp,
    env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const pipeToLog = (buf, label) => {
    if (!logStream) return;
    try {
      logStream.write(`[${label}] ${buf.toString("utf8")}`);
    } catch {
      /* ignore */
    }
  };

  serverProcess.stdout?.on("data", (d) => pipeToLog(d, "out"));
  serverProcess.stderr?.on("data", (d) => pipeToLog(d, "err"));

  serverProcess.on("error", (err) => {
    dialog.showErrorBox(
      "启动失败",
      `${String(err?.message || err)}\n\n日志：${logFile}`,
    );
  });

  serverProcess.on("exit", (code) => {
    if (logStream) {
      try {
        logStream.write(`---- 进程退出 code=${code} ----\n`);
        logStream.end();
      } catch {
        /* ignore */
      }
    }
    if (code !== 0 && code !== null && !isQuiting) {
      dialog.showErrorBox(
        "服务退出",
        `Next 进程异常退出，代码 ${code}\n\n日志：${logFile}`,
      );
    }
  });
}

function stopNextServer() {
  if (!serverProcess) return;
  const proc = serverProcess;
  const pid = proc.pid;
  serverProcess = null;

  try {
    if (process.platform === "win32" && pid) {
      /** /T 结束整棵进程树，关闭 exe 时一并结束内置 Node 与 Next 监听（避免 3010 残留） */
      spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
        shell: false,
      });
    } else if (!proc.killed) {
      proc.kill("SIGTERM");
    }
  } catch {
    /* ignore */
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
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      /** 避免后台节流导致首屏绘制异常 */
      backgroundThrottling: false,
    },
  });

  mainWindow.webContents.on("did-fail-load", (_event, code, desc, url, isMainFrame) => {
    if (!isMainFrame) return;
    dialog.showErrorBox(
      "页面加载失败",
      `${desc}（代码 ${code}）\n${url}\n\n可查看日志：${nextLogPath()}`,
    );
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
  /**
   * 与 Chromium 并行启动 Next：窗口仍须在 whenReady 后创建，但本地服务可提前拉起，
   * 缩短「界面已出现 → 页面可点」的等待（无法缩短 portable 自解压本身耗时）。
   */
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
        await mainWindow.loadURL(START_URL, {
          extraHeaders: "pragma: no-cache\ncache-control: no-cache\n",
        });
      }
    } catch (e) {
      const logFile = nextLogPath();
      const extra = fs.existsSync(logFile) ? `\n\n日志：${logFile}` : "";
      dialog.showErrorBox("市场洞察", String(e?.message || e) + extra);
      app.quit();
    }
  });

  app.on("window-all-closed", () => {
    isQuiting = true;
    stopNextServer();
    app.quit();
  });

  app.on("before-quit", () => {
    isQuiting = true;
    stopNextServer();
  });

  /** 最后兜底：确保退出时子进程已结束 */
  app.on("will-quit", () => {
    isQuiting = true;
    stopNextServer();
  });
}
