@echo off
setlocal

echo ============================================
echo   daily-scraper - remove scheduled tasks
echo ============================================
echo.

powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0uninstall-task.ps1"
if errorlevel 1 (
  echo.
  echo [FAIL] uninstall returned %errorlevel%
)
endlocal
pause
