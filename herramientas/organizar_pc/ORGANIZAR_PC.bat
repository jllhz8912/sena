@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo   ORGANIZADOR DE PC
echo   1 = Simular (solo reporte, no mueve nada)  [RECOMENDADO primero]
echo   2 = Ejecutar (mueve archivos, duplicados a cuarentena)
echo   3 = Deshacer la ultima ejecucion
echo ============================================================
set /p OP=Elija opcion:

if "%OP%"=="1" python organizar_pc.py
if "%OP%"=="2" python organizar_pc.py --ejecutar --limpiar-vacias
if "%OP%"=="3" (
  for /f "delims=" %%F in ('dir /b /o-d "%USERPROFILE%\PC_ORGANIZADO\_REPORTES\log_movimientos_*.csv" 2^>nul') do (
    python organizar_pc.py --deshacer "%USERPROFILE%\PC_ORGANIZADO\_REPORTES\%%F"
    goto :fin
  )
  echo No hay ejecuciones para deshacer.
)
:fin
if exist "%USERPROFILE%\PC_ORGANIZADO\_REPORTES" start "" "%USERPROFILE%\PC_ORGANIZADO\_REPORTES"
pause
