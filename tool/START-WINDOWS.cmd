@echo off
setlocal DisableDelayedExpansion
cd /d "%~dp0"
set "NODE_OPTIONS="
set "NODE_PATH="
"%~dp0runtime\node.exe" "%~dp0tool\portable-launch.js"
if errorlevel 1 pause
endlocal
