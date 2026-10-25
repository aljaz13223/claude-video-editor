@echo off
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" call INSTALL.bat
set NODE_OPTIONS=
start "" "node_modules\electron\dist\electron.exe" . --lite
