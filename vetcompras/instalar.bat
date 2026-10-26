@echo off
chcp 65001 >nul
title Instalar VetCompras
cd /d "%~dp0"

echo ============================================================
echo   INSTALACION DE VETCOMPRAS (se ejecuta una sola vez)
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [X] No se encontro Node.js.
  echo     Descarguelo e instalelo desde https://nodejs.org  ^(version LTS 22 o superior^)
  echo     y vuelva a ejecutar este instalador.
  pause
  exit /b 1
)

node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"
if errorlevel 1 (
  echo [X] Su version de Node.js es muy antigua. Se requiere 22.13 o superior.
  echo     Actualicela desde https://nodejs.org
  pause
  exit /b 1
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo [OK] Archivo de configuracion .env creado.
)

echo [..] Instalando componentes (puede tardar unos minutos)...
call npm install --no-audit --no-fund
if errorlevel 1 goto error

echo [..] Preparando la aplicacion...
call npm run build
if errorlevel 1 goto error

echo [..] Creando acceso directo en el escritorio...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\VetCompras.lnk');" ^
  "$s.TargetPath='%~dp0iniciar.bat';$s.WorkingDirectory='%~dp0';$s.IconLocation='shell32.dll,43';$s.Save()"

echo.
echo ============================================================
echo   INSTALACION TERMINADA
echo   Abra VetCompras con el icono "VetCompras" del escritorio.
echo   Sus datos se guardan en: %USERPROFILE%\VetCompras\datos
echo ============================================================
pause
exit /b 0

:error
echo.
echo [X] La instalacion no termino. Revise el mensaje anterior o su conexion a internet.
pause
exit /b 1
