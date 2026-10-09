@echo off
setlocal

set "PORT=3000"

echo Looking for process on port %PORT% ...
set "FOUND=0"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT% " 2^>nul ^| findstr LISTENING 2^>nul') do (
  if not "%%P"=="" (
    echo   found PID %%P
    taskkill /F /PID %%P 2>nul
    if not errorlevel 1 (
      echo   killed %%P
      set "FOUND=1"
    ) else (
      echo   failed to kill %%P
    )
  )
)
if "%FOUND%"=="0" echo   no listener on port %PORT%.
endlocal
pause
