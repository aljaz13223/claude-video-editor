@echo off
rem Installs premiere-pro-mcp (MIT, github.com/leancoderkavy/premiere-pro-mcp) and registers it with Claude Code.
rem Close Premiere Pro first. Log: logs\premiere-mcp-install.log
setlocal
set LOG=%~dp0logs\premiere-mcp-install.log
if not exist "%~dp0logs" mkdir "%~dp0logs"
echo ===== %date% %time% ===== > "%LOG%"
node -v >> "%LOG%" 2>&1 || (echo Node.js is not installed. & pause & exit /b 1)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>20||(a===20&&b>=19)?0:1)" || (echo Node.js 20.19+ required. & pause & exit /b 1)
call npm install -g premiere-pro-mcp@1.15.1 >> "%LOG%" 2>&1 || (echo npm install failed - see log. & pause & exit /b 1)
call npx -y premiere-pro-mcp@1.15.1 --install-cep >> "%LOG%" 2>&1
for %%v in (9 10 11 12 13 14) do reg add "HKCU\Software\Adobe\CSXS.%%v" /v PlayerDebugMode /t REG_SZ /d 1 /f >> "%LOG%" 2>&1
call claude mcp remove premiere-pro -s user >> "%LOG%" 2>&1
call claude mcp add premiere-pro -s user -- cmd /c premiere-pro-mcp >> "%LOG%" 2>&1
call premiere-pro-mcp --doctor >> "%LOG%" 2>&1
call claude mcp list >> "%LOG%" 2>&1
type "%LOG%"
echo Done. Open Premiere Pro, a project, Window ^> Extensions ^> MCP for Adobe Premiere Pro, then start Claude Code.
pause
