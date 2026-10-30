@echo off
setlocal
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Please restore Node.js before stopping JobSync.
  pause
  exit /b 1
)
node.exe "%~dp0scripts\local\cli.mjs" stop
if errorlevel 1 (
  echo.
  echo JobSync could not stop safely. No other Node.js process was stopped.
  pause
  exit /b 1
)
