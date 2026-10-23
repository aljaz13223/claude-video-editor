@echo off
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  echo Takeframe is not installed yet - running INSTALL.bat first.
  call INSTALL.bat
)
start "" "node_modules\electron\dist\electron.exe" .
