@echo off
setlocal

echo ============================================
echo   daily-scraper - register scheduled tasks
echo ============================================
echo.

powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0install-task.ps1"
if errorlevel 1 (
  echo.
  echo [FAIL] registration returned %errorlevel%
)
endlocal
pause
