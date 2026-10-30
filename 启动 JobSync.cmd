@echo off
setlocal
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 24 LTS including npm, then try again.
  pause
  exit /b 1
)
node.exe "%~dp0scripts\local\cli.mjs" start
if errorlevel 1 (
  echo.
  echo JobSync could not start. Keep this message and check the log path above.
  pause
  exit /b 1
)
