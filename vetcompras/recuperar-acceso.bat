@echo off
chcp 65001 >nul
title Recuperar acceso a VetCompras
cd /d "%~dp0"
echo Este programa crea un acceso de emergencia de administrador.
echo Uselo solo si olvido la contrasena de administrador.
echo.
pause
call npm run --silent recuperar-acceso
pause
