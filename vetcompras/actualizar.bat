@echo off
chcp 65001 >nul
title Actualizar VetCompras
cd /d "%~dp0"

echo ============================================================
echo   ACTUALIZACION DE VETCOMPRAS
echo   Su informacion NO se borra: esta en %USERPROFILE%\VetCompras\datos
echo   (fuera de la carpeta del programa). Igualmente se hace una copia.
echo ============================================================
echo.
echo Cierre la ventana negra de VetCompras si esta abierta y luego
pause

set DATOS=%VETCOMPRAS_DATOS%
if "%DATOS%"=="" set DATOS=%USERPROFILE%\VetCompras\datos
for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set ESTAMPA=%%t
set COPIA=%USERPROFILE%\VetCompras\copias-antes-de-actualizar\%ESTAMPA%

if exist "%DATOS%\vetcompras.db" (
  echo [..] Copiando la base de datos a %COPIA%
  mkdir "%COPIA%" >nul 2>nul
  copy "%DATOS%\vetcompras.db*" "%COPIA%\" >nul
  echo [OK] Copia de seguridad creada.
)

git rev-parse --is-inside-work-tree >nul 2>nul
if not errorlevel 1 (
  echo [..] Descargando la version mas reciente...
  git pull --ff-only
  if errorlevel 1 goto error
) else (
  echo [i] Esta carpeta no es un repositorio git.
  echo     Si recibio la nueva version en un .zip, descomprimala ENCIMA de esta carpeta
  echo     ^(reemplazando archivos^) antes de continuar.
  pause
)

echo [..] Actualizando componentes...
call npm install --no-audit --no-fund
if errorlevel 1 goto error
call npm run build
if errorlevel 1 goto error

echo.
echo ============================================================
echo   ACTUALIZACION TERMINADA
echo   Al abrir VetCompras, la base de datos se adapta sola a la nueva
echo   version (se crea antes un respaldo automatico en datos\respaldos).
echo ============================================================
pause
exit /b 0

:error
echo.
echo [X] La actualizacion no termino. Sus datos no fueron modificados.
pause
exit /b 1
