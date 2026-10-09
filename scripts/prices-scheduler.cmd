@echo off
REM ============================================================
REM scripts\prices-scheduler.cmd
REM Worker-only mode: run the price fetch scheduler without
REM the web UI. Good for a background machine, Raspberry Pi,
REM or as a separate Fly.io worker.
REM
REM Env vars (optional):
REM   PRICES_CRON  default "0 */6 * * *"
REM   PRICES_TZ    default "Asia/Taipei"
REM   TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID / DISCORD_WEBHOOK_URL
REM   (.env is also read automatically)
REM ============================================================
chcp 65001 >nul
setlocal EnableExtensions
pushd "%~dp0\.."

echo === prices scheduler (worker mode) ===
echo CWD: %CD%
echo CRON: %PRICES_CRON%   TZ: %PRICES_TZ%
echo Press Ctrl+C to stop.
echo.

if not exist "node_modules" call npm install
node web\prices\scheduler.js

popd
pause