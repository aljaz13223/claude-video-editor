@echo off
title Takeframe - Claude API key
echo Paste your Anthropic API key here (it is saved only on this PC, as the user variable ANTHROPIC_API_KEY).
echo The key is hidden while you paste. Press Enter when done.
powershell -NoProfile -Command "$k = Read-Host -AsSecureString 'API key'; $p = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($k)); if ($p.Length -gt 20) { [Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', $p, 'User'); 'Saved. Restart Takeframe.' } else { 'Nothing saved.' }"
pause
