@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules\vuepress" (
  echo [1/2] Installing dependencies, please wait...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :failed
)

echo.
echo [2/2] Building static site...
call npm run build
if errorlevel 1 goto :failed

echo.
echo Build finished: docs\.vuepress\dist
echo Upload that folder to your web server.
pause
goto :end

:failed
echo.
echo Build failed. See the messages above.
pause

:end
endlocal
