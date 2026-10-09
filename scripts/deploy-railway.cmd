@echo off
REM ============================================================
REM scripts\deploy-railway.cmd
REM One-shot: install Railway CLI, login (browser), init, deploy.
REM
REM Usage: double-click scripts\deploy-railway.cmd
REM ============================================================
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

pushd "%~dp0\.."

echo.
echo === deploy to Railway (one-shot) ===
echo.

REM 1. node check
where node >nul 2>nul
if errorlevel 1 (
  echo [X] node not found. Install Node.js ^>=18 first.
  popd
  pause
  exit /b 1
)

REM 2. install Railway CLI if missing
where railway >nul 2>nul
if errorlevel 1 (
  echo [*] Installing Railway CLI globally...
  call npm install -g @railway/cli
  if errorlevel 1 (
    echo [X] npm install failed
    popd
    pause
    exit /b 1
  )
) else (
  echo [OK] railway CLI already installed
)
for /f "tokens=*" %%v in ('railway --version 2^>nul') do echo [OK] %%v

REM 3. login (opens browser — user must confirm)
echo.
echo ============================================================
echo  About to open your browser for Railway login.
echo  Sign in / sign up, then come back here and press any key.
echo ============================================================
echo.
pause
railway login
if errorlevel 1 (
  echo [X] railway login failed
  popd
  pause
  exit /b 1
)
echo [OK] logged in

REM 4. init project (idempotent — skip if already in a Railway project)
railway status >nul 2>nul
if errorlevel 1 (
  echo.
  echo [*] Initializing new Railway project "travel-scraper"...
  railway init --name travel-scraper
  if errorlevel 1 (
    echo [X] railway init failed
    popd
    pause
    exit /b 1
  )
) else (
  echo [OK] already inside a Railway project
)

REM 5. deploy
echo.
echo [*] Deploying... (this may take 1-3 minutes)
railway up --detach
if errorlevel 1 (
  echo [X] railway up failed. Check the URL Railway gave you.
  popd
  pause
  exit /b 1
)

REM 6. assign a public domain
echo.
echo [*] Assigning public domain...
railway domain
if errorlevel 1 (
  echo [i] If no domain was assigned, run: railway domain
)

echo.
echo ============================================================
echo  [OK] Deploy complete!
echo  Run "railway open" to open the dashboard, or visit the
echo  domain URL printed above (usually https://travel-scraper.up.railway.app).
echo ============================================================
echo.

popd
pause