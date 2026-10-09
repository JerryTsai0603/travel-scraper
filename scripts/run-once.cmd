@echo off
setlocal

set "PROJECT_ROOT=%~dp0.."

echo ============================================
echo   daily-scraper - run scraper once
echo ============================================
echo Project root: %PROJECT_ROOT%
echo.

node "%PROJECT_ROOT%\src\index.js" --once
if errorlevel 1 (
  echo.
  echo [FAIL] scraper exited with error code %errorlevel%
)
endlocal
pause
