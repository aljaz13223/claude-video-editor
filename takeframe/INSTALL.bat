@echo off
title Takeframe - install
cd /d "%~dp0"
echo [1/3] Electron (app shell)...
set NODE_OPTIONS=--use-system-ca
call npm install --no-audit --no-fund || goto :err
if not exist "node_modules\electron\dist\electron.exe" node node_modules\electron\install.js
set NODE_OPTIONS=
echo [2/3] Audio engine (Python 3.12 venv in %USERPROFILE%\.takeframe)...
set "TF=%USERPROFILE%\.takeframe"
if not exist "%TF%\venv\Scripts\python.exe" (
  py -3.12 -m venv "%TF%\venv" 2>nul || "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" -m venv "%TF%\venv" || goto :err
)
"%TF%\venv\Scripts\python.exe" -m pip install -q --upgrade pip
"%TF%\venv\Scripts\python.exe" -c "import torch" 2>nul || "%TF%\venv\Scripts\pip" install torch==2.5.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cu124
"%TF%\venv\Scripts\pip" install -q demucs soundfile pyloudnorm scipy faster-whisper || goto :err
echo [3/3] DeepFilterNet3 (speech enhancement)...
if not exist "%TF%\bin" mkdir "%TF%\bin"
if not exist "%TF%\bin\deep-filter.exe" curl.exe -sSL -o "%TF%\bin\deep-filter.exe" https://github.com/Rikorose/DeepFilterNet/releases/download/v0.5.6/deep-filter-0.5.6-x86_64-pc-windows-msvc.exe
echo.
echo Done. Next: SET-API-KEY.bat (once), then START-TAKEFRAME.bat
pause
exit /b 0
:err
echo Install failed - see messages above.
pause
exit /b 1
