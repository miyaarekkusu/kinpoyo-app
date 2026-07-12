@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-expo.ps1" %*
set EXITCODE=%ERRORLEVEL%
echo.
echo Expo finished (exit code %EXITCODE%). Press any key to close...
pause >nul
endlocal
exit /b %EXITCODE%
