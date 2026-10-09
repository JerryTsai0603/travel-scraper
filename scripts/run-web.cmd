@echo off
setlocal

set "PROJECT_ROOT=%~dp0.."
set "PORT=3000"
set "HOST=127.0.0.1"

echo ============================================
echo   daily-scraper web frontend
echo ============================================
echo Project root: %PROJECT_ROOT%
echo.

REM Pre-check whether port is busy
set "FOUND_PID="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT% " 2^>nul ^| findstr LISTENING 2^>nul') do (
  if not "%%P"=="" set "FOUND_PID=%%P"
)
if defined FOUND_PID (
  echo [WARN] port %PORT% is in use by PID %FOUND_PID%
  echo        auto-fallback will shift to next free port.
) else (
  echo [OK]   port %PORT% is free.
)
echo.

REM Launch node in background via plain cmd start (no PowerShell needed)
set "LOG_OUT=%TEMP%\ds-web-out-%RANDOM%.log"
set "LOG_ERR=%TEMP%\ds-web-err-%RANDOM%.log"
echo Starting server in background ...
start "ds-web" /B cmd /c "node ""%PROJECT_ROOT%\web\server.js"" 1>""%LOG_OUT%"" 2>""%LOG_ERR%"""

REM Find the node PID by checking which node process has our log as stdout
REM (or just wait and probe)
ping -n 6 127.0.0.1 >nul

REM Read the actual listening URL from the log (handles auto-port fallback)
set "URL=http://%HOST%:%PORT%/"
for /f "tokens=4 delims= " %%U in ('findstr /C:"listening on" "%LOG_OUT%" 2^>nul') do set "URL=%%U"

echo.
echo Server URL:  %URL%
echo Stdout log:  %LOG_OUT%
echo Stderr log:  %LOG_ERR%
echo.

REM Sanity-check: probe the URL once before opening browser
echo Probing %URL% ...
powershell -NoProfile -Command "try { (Invoke-WebRequest '%URL%' -UseBasicParsing -TimeoutSec 3).StatusCode; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  echo [WARN] probe failed - server may still be starting. Opening browser anyway.
) else (
  echo [OK] probe succeeded.
)

echo.
echo Opening browser at %URL% ...
start "" "%URL%"
echo.
echo ============================================
echo   Server is running. To stop it:
echo     scripts\kill-port.cmd
echo ============================================
echo.
echo === Server stdout ===
type "%LOG_OUT%" 2>nul
echo.
echo === Server stderr (if any) ===
type "%LOG_ERR%" 2>nul
echo.

endlocal
pause
