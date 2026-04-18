# 构建并打包为「局域网可访问」目录：release\market-portal-lan
# 在任意 Windows 电脑上解压/拷贝该文件夹后，双击 start-lan.bat（需已安装 Node 18+）

$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))

Write-Host "==> npm run build" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$out = Join-Path (Get-Location) "release\market-portal-lan"
$standalone = Join-Path (Get-Location) ".next\standalone"

if (-not (Test-Path $standalone)) {
  Write-Error "未找到 .next\standalone，请确认 next.config.mjs 中 output 为 standalone"
}

if (Test-Path $out) { Remove-Item -Recurse -Force $out }
New-Item -ItemType Directory -Path $out | Out-Null

Write-Host "==> 复制 standalone + static + public -> $out" -ForegroundColor Cyan
Copy-Item -Recurse -Force (Join-Path $standalone "*") $out
$staticDest = Join-Path $out ".next\static"
New-Item -ItemType Directory -Path (Split-Path $staticDest -Parent) -Force | Out-Null
Copy-Item -Recurse -Force (Join-Path (Get-Location) ".next\static") $staticDest

$pub = Join-Path (Get-Location) "public"
if (Test-Path $pub) {
  Copy-Item -Recurse -Force $pub (Join-Path $out "public")
}

$envLocal = Join-Path (Get-Location) ".env.local"
if (Test-Path $envLocal) {
  Copy-Item -Force $envLocal (Join-Path $out ".env.local")
  Write-Host "Copied .env.local" -ForegroundColor Yellow
} else {
  Write-Host "No .env.local found; create one in output folder with MONGODB_URI." -ForegroundColor Yellow
}

$bat = @"
@echo off
chcp 65001 >nul
cd /d "%~dp0"
set HOSTNAME=0.0.0.0
set PORT=3010
echo 监听 http://0.0.0.0:%PORT%  ^(局域网请用本机 IP 访问^)
node server.js
"@
$bat | Out-File -Encoding utf8 (Join-Path $out "start-lan.bat")

$readme = @"
market-portal (LAN)

1. Install Node.js 18+ on this machine.
2. Double-click start-lan.bat, or run: node server.js
   (HOSTNAME=0.0.0.0 PORT=3010)
3. On another PC in the same LAN open: http://<this-PC-LAN-IP>:3010
4. If blocked, allow inbound TCP 3010 in Windows Firewall on the host.

MongoDB: edit .env.local MONGODB_URI. Browsers do not connect to Mongo;
only this Node process connects to the database.
"@
$readme | Out-File -Encoding utf8 (Join-Path $out "LAN_DEPLOY.txt")

Write-Host ""
Write-Host "Done. Output folder: $out" -ForegroundColor Green
Write-Host "Zip release\market-portal-lan and copy to any PC on LAN (Node 18+ required)." -ForegroundColor Green
