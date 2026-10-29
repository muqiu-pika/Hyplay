@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules\vuepress" (
  echo [1/2] Installing dependencies, please wait...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :failed
)

echo.
echo [2/2] Starting dev server: http://127.0.0.1:8080
echo Press Ctrl+C to stop.
echo.
call npm run dev -- --open
goto :end

:failed
echo.
echo Dependency installation failed.
echo Please check your network and Node.js version ^(requires 20.19+ or 22.12+^).
pause

:end
endlocal
