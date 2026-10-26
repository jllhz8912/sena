@echo off
chcp 65001 >nul
title Detener VetCompras
cd /d "%~dp0"
set PUERTO_APP=3000
for /f "tokens=2 delims==" %%p in ('findstr /b /i "PUERTO=" .env 2^>nul') do set PUERTO_APP=%%p
powershell -NoProfile -Command "$c = Get-NetTCPConnection -LocalPort %PUERTO_APP% -State Listen -ErrorAction SilentlyContinue; if ($c) { $c | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }; Write-Host 'VetCompras se detuvo.' } else { Write-Host 'VetCompras no estaba funcionando.' }"
timeout /t 3 >nul
