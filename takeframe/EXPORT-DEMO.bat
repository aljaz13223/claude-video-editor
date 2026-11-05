@echo off
cd /d "%~dp0"
"node_modules\electron\dist\electron.exe" . --export "%~dp0..\takeframe-projects\Takeframe Launch\project.takeframe.json" --res 1080x1920,1920x1080 --audio --stems
pause
