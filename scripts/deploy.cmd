@echo off
REM ============================================================
REM scripts\deploy.cmd
REM One-shot: git init -> commit -> push to GitHub, then show
REM the next steps for Render / Railway / Fly.io.
REM
REM Usage:
REM   1) Create an empty repo on GitHub (no README/.gitignore)
REM   2) setx GITHUB_REPO_URL "https://github.com/<user>/<repo>.git"
REM   3) Double-click this file, or in cmd.exe: scripts\deploy.cmd
REM ============================================================
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

pushd "%~dp0\.."
set "ROOT=%CD%"

echo.
echo === daily-scraper deploy helper ===
echo Project root: %ROOT%
echo.

REM --- 1. check GITHUB_REPO_URL ---
if "%GITHUB_REPO_URL%"=="" (
  echo [X] GITHUB_REPO_URL environment variable is not set.
  echo.
  echo Please create an empty repo on GitHub first, then run:
  echo   setx GITHUB_REPO_URL "https://github.com/^<user^>/^<repo^>.git"
  echo   scripts\deploy.cmd
  echo.
  popd
  pause
  exit /b 1
)
echo [OK] GITHUB_REPO_URL=%GITHUB_REPO_URL%

REM --- 2. check git ---
where git >nul 2>nul
if errorlevel 1 (
  echo [X] git not found. Install from https://git-scm.com/download/win
  popd
  pause
  exit /b 1
)

REM --- 3. git init (if not yet) ---
if not exist ".git" (
  echo [*] git init ...
  call git init
  call git checkout -b main 2>nul
  if errorlevel 1 call git symbolic-ref HEAD refs/heads/main
) else (
  echo [OK] .git already exists
)

REM --- 4. ensure remote ---
git remote get-url origin >nul 2>nul
if errorlevel 1 (
  echo [*] adding origin -^> %GITHUB_REPO_URL%
  call git remote add origin %GITHUB_REPO_URL%
) else (
  echo [OK] remote origin already set
)

REM --- 5. add + commit ---
echo [*] git add .
call git add .
if errorlevel 1 (
  echo [X] git add failed
  popd
  pause
  exit /b 1
)

git diff --cached --quiet
if not errorlevel 1 (
  echo [i] nothing new to commit
) else (
  for /f "tokens=1-3 delims=/" %%a in ("%date%") do set "D=%%a-%%b-%%c"
  set "T=%time:~0,2%%time:~3,2%"
  set "MSG=deploy: %D% %T%"
  echo [*] git commit -m "%MSG%"
  call git commit -m "%MSG%"
  if errorlevel 1 (
    echo [X] git commit failed
    popd
    pause
    exit /b 1
  )
)

REM --- 6. push ---
echo [*] git push -u origin main
call git push -u origin main
if errorlevel 1 (
  echo.
  echo [X] push failed. Common causes:
  echo   1) GitHub repo not yet created, or wrong URL
  echo   2) First push needs auth — browser will pop up, or pre-configure a Personal Access Token
  echo   3) Default branch is not main — change the branch in this script
  popd
  pause
  exit /b 1
)

echo.
echo [OK] Pushed to GitHub.
echo.
echo =============== Next: pick a PaaS to deploy ===============
echo.
echo [Render] (recommended, ~1 min)
echo   1. Open https://dashboard.render.com/connect
echo   2. Select the repo you just pushed
echo   3. Render auto-reads render.yaml and creates the Web Service
echo   4. Wait 3-5 min for build, then visit https://^<repo^>.onrender.com
echo   5. (optional) Set secrets in Dashboard -^> Environment:
echo        TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID / DISCORD_WEBHOOK_URL
echo.
echo [Railway]
echo   npm i -g @railway/cli
echo   railway login
echo   railway up
echo.
echo [Fly.io]
echo   iwr https://fly.io/install.ps1 -useb ^| iex
echo   fly auth signup
echo   fly launch
echo   fly deploy
echo.
popd
pause