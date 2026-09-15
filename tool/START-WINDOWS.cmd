@echo off
setlocal DisableDelayedExpansion
cd /d "%~dp0"
set "NODE_OPTIONS="
set "NODE_PATH="
"%~dp0runtime\node.exe" "%~dp0tool\portable-launch.js"
set "MUTUAL_EXIT_CODE=%errorlevel%"
if not "%MUTUAL_EXIT_CODE%"=="0" pause
endlocal & exit /b %MUTUAL_EXIT_CODE%
