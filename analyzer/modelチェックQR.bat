@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

REM ============================================================
REM  model チェックアプリ（/check）をスマホで開くための QR を表示。
REM  スマホを PC と同じ Wi-Fi に繋いで QR を読み取ってください。
REM ============================================================

REM --- 依存関係の確認 ---
if not exist "node_modules\.bin\expo.cmd" (
  echo node_modules が見つかりません。npm install を実行します...
  call npm.cmd install
  if errorlevel 1 (
    echo npm install に失敗しました。
    pause
    exit /b 1
  )
)

REM --- LAN の IPv4 を取得（デフォルトゲートウェイを持つ稼働中アダプタ）---
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-NetIPConfiguration ^| Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } ^| Select-Object -First 1).IPv4Address.IPAddress"`) do set "IP=%%i"

if "%IP%"=="" (
  echo LAN IP を取得できませんでした。Wi-Fi / 有線に接続されているか確認してください。
  pause
  exit /b 1
)

set "URL=http://%IP%:8081/check"

echo.
echo ============================================================
echo  model チェックアプリ URL:
echo    %URL%
echo  スマホを同じ Wi-Fi に繋ぎ、下の QR を読み取ってください。
echo ============================================================
echo.

REM --- QR をコンソールに表示（ローカル優先、無ければ npx）---
if exist "node_modules\.bin\qrcode-terminal.cmd" (
  echo %URL%| "node_modules\.bin\qrcode-terminal.cmd"
) else (
  echo %URL%| npx --yes qrcode-terminal
)

echo.

REM --- 既に 8081 で開発サーバが動いていれば起動せず QR だけ表示 ---
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://localhost:8081' -UseBasicParsing -TimeoutSec 3 ^| Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo Expo Web を起動します（QR の URL が有効になるまで数十秒かかります）...
  echo 終了するには このウィンドウで Ctrl+C を押してください。
  echo.
  call "%~dp0node_modules\.bin\expo.cmd" start --web
) else (
  echo 開発サーバは既に起動済みです。上の QR をそのまま読み取れます。
  echo （このウィンドウは閉じても QR の URL は有効なままです）
)

echo.
pause
endlocal
