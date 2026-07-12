@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules" (
  echo node_modules not found. Running npm install...
  call npm.cmd install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

if not exist "node_modules\.bin\expo.cmd" (
  echo Expo CLI not found in node_modules. Running npm install...
  call npm.cmd install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Starting Expo Web (analyzer)...
call "%~dp0node_modules\.bin\expo.cmd" start --web
set EXITCODE=%ERRORLEVEL%
echo.
echo Expo finished (exit code %EXITCODE%). Press any key to close...
pause >nul
endlocal
exit /b %EXITCODE%