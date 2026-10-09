@echo off
REM ============================================================
REM scripts\start-prices.cmd
REM One-shot: start web server + price monitor (flight + hotel).
REM Double-click to run, or in cmd.exe: scripts\start-prices.cmd
REM ============================================================
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

pushd "%~dp0\.."
set "ROOT=%CD%"

echo.
echo === daily-scraper web + prices monitor ===
echo Project root: %ROOT%
echo.

REM 1. node check
where node >nul 2>nul
if errorlevel 1 (
  echo [X] node not found. Install Node.js ^>=18 from https://nodejs.org/
  popd
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do echo [OK] node %%v

REM 2. npm install (only first time)
if not exist "node_modules" (
  echo [*] First run, installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [X] npm install failed
    popd
    pause
    exit /b 1
  )
) else (
  echo [OK] node_modules present
)

REM 3. default env vars (only if not set)
if "%PORT%"=="" set "PORT=3000"
if "%HOST%"=="" set "HOST=127.0.0.1"
if "%PRICES_SCHEDULER%"=="" set "PRICES_SCHEDULER=true"
if "%AUTO_PORT%"=="" set "AUTO_PORT=true"

echo.
echo Starting: http://%HOST%:%PORT%/prices
echo Scheduler: %PRICES_SCHEDULER%  (set PRICES_SCHEDULER=false to disable)
echo Press Ctrl+C to stop.
echo.

REM 4. bypass any PowerShell ExecutionPolicy issues
node web\server.js

popd
pause