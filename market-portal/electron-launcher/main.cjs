const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");

const PORT = process.env.MARKET_PORTAL_PORT || "3010";
const START_URL = `http://127.0.0.1:${PORT}`;

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

function waitForHttp(url, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) {
          reject(new Error(`无法在 ${timeoutMs / 1000}s 内连上 ${url}`));
        } else {
          setTimeout(tryOnce, 350);
        }
      });
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: "飞神市场洞察",
    backgroundColor: "#030303",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadURL(START_URL);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      startNextServer();
      await waitForHttp(START_URL);
      createWindow();
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
