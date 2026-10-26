@echo off
chcp 65001 >nul
title VetCompras (modo con ventana, para soporte) - NO CIERRE ESTA VENTANA
rem Uso normal: icono VetCompras del escritorio (VetCompras.vbs), que no muestra esta ventana.
cd /d "%~dp0"

if not exist "dist\index.html" (
  echo La aplicacion no esta instalada. Ejecute primero instalar.bat
  pause
  exit /b 1
)

set PUERTO_APP=3000
for /f "tokens=2 delims==" %%p in ('findstr /b /i "PUERTO=" .env 2^>nul') do set PUERTO_APP=%%p

rem Abre el navegador unos segundos despues de iniciar el servidor
start "" /b powershell -NoProfile -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:%PUERTO_APP%'"

call npm start
echo.
echo VetCompras se detuvo. Puede cerrar esta ventana.
pause
