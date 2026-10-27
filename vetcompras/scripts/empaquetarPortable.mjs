/**
 * Arma la versión PORTABLE de VetCompras para Windows: una carpeta (y un .zip)
 * que funciona en cualquier PC sin instalar Node.js, desde una USB o copiada al disco.
 *
 *   npm run build
 *   node scripts/empaquetarPortable.mjs <ruta-a-node.exe> [carpeta-salida]
 *
 * El node.exe debe ser el oficial de nodejs.org (win-x64), versión 22.13 o superior.
 */
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import JSZip from 'jszip';

const [nodeExe, salidaArg] = process.argv.slice(2);
if (!nodeExe || !fs.existsSync(nodeExe)) {
  console.error('Uso: node scripts/empaquetarPortable.mjs <ruta-a-node.exe> [carpeta-salida]');
  process.exit(1);
}
if (!fs.existsSync('dist/index.html')) {
  console.error('Falta la carpeta dist: ejecute primero "npm run build".');
  process.exit(1);
}
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const salida = salidaArg || path.join('dist-portable', 'VetCompras');
fs.rmSync(salida, { recursive: true, force: true });
fs.mkdirSync(path.join(salida, 'node'), { recursive: true });

// 1. Servidor y herramienta de recuperación en un solo archivo cada uno
const comun = {
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['vite'],
  banner: { js: "import { createRequire as __vcRequire } from 'node:module'; const require = __vcRequire(import.meta.url);" },
  logLevel: 'warning',
};
await build({ ...comun, entryPoints: ['server.ts'], outfile: path.join(salida, 'servidor.mjs') });
await build({ ...comun, entryPoints: ['scripts/recuperarAcceso.ts'], outfile: path.join(salida, 'recuperar.mjs') });

// 2. Interfaz compilada, Node.js y licencia
fs.cpSync('dist', path.join(salida, 'dist'), { recursive: true });
fs.copyFileSync(nodeExe, path.join(salida, 'node', 'node.exe'));
const licencia = path.join(path.dirname(nodeExe), 'LICENSE');
if (fs.existsSync(licencia)) fs.copyFileSync(licencia, path.join(salida, 'node', 'LICENSE-nodejs.txt'));
fs.copyFileSync('.env.example', path.join(salida, '.env'));

const crlf = (t) => t.replace(/\r?\n/g, '\r\n');
const escribir = (nombre, texto) => fs.writeFileSync(path.join(salida, nombre), crlf(texto));

// 3. Lanzador sin ventana. Con /usb los datos quedan en la carpeta "datos" junto al programa.
escribir(
  'VetCompras.vbs',
  `' Abre VetCompras sin ventana negra. Si ya está abierto, solo abre el navegador.
' Uso: VetCompras.vbs            -> datos en C:\\Users\\<usuario>\\VetCompras\\datos
'      VetCompras.vbs /usb       -> datos en la carpeta "datos" junto a este archivo
Option Explicit
Dim shell, fso, carpeta, puerto, url, i, enUsb, entorno, abrirNavegador, a

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
carpeta = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = carpeta
enUsb = False
abrirNavegador = True
For Each a In WScript.Arguments
  If LCase(a) = "/usb" Then enUsb = True
  If LCase(a) = "/sinnavegador" Then abrirNavegador = False
Next

puerto = LeerPuerto()
url = "http://localhost:" & puerto

If Not EstaFuncionando() Then
  Set entorno = shell.Environment("Process")
  entorno("VETCOMPRAS_LOG") = carpeta & "\\registro.log"
  If enUsb Then entorno("VETCOMPRAS_DATOS") = carpeta & "\\datos"
  shell.Run """" & carpeta & "\\node\\node.exe"" """ & carpeta & "\\servidor.mjs""", 0, False
  For i = 1 To 60
    WScript.Sleep 500
    If EstaFuncionando() Then Exit For
  Next
  If Not EstaFuncionando() Then
    MsgBox "VetCompras no pudo iniciar." & vbCrLf & "Revise el archivo registro.log en " & carpeta, vbCritical, "VetCompras"
    WScript.Quit 1
  End If
End If
If abrirNavegador Then shell.Run url

Function EstaFuncionando()
  Dim http
  EstaFuncionando = False
  On Error Resume Next
  Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  http.setTimeouts 1000, 1000, 1000, 1000
  http.Open "GET", url & "/api/sesion", False
  http.Send
  If Err.Number = 0 Then
    If http.Status = 200 Then EstaFuncionando = True
  End If
  On Error GoTo 0
End Function

Function LeerPuerto()
  Dim archivo, linea
  LeerPuerto = "3000"
  If fso.FileExists(carpeta & "\\.env") Then
    Set archivo = fso.OpenTextFile(carpeta & "\\.env", 1)
    Do Until archivo.AtEndOfStream
      linea = Trim(archivo.ReadLine)
      If LCase(Left(linea, 7)) = "puerto=" Then LeerPuerto = Trim(Mid(linea, 8))
    Loop
    archivo.Close
  End If
End Function
`
);

escribir(
  'Usar desde la USB.bat',
  `@echo off
rem Abre VetCompras con los datos guardados en esta misma USB (carpeta "datos").
start "" wscript.exe "%~dp0VetCompras.vbs" /usb
`
);

escribir(
  'Instalar en este PC.bat',
  `@echo off
chcp 65001 >nul
title Instalar VetCompras en este PC
set ORIGEN=%~dp0
set DESTINO=%LOCALAPPDATA%\\VetCompras\\programa

echo ============================================================
echo   INSTALAR VETCOMPRAS EN ESTE PC
echo   Programa: %DESTINO%
echo   Datos:    %USERPROFILE%\\VetCompras\\datos
echo   Si ya estaba instalado, se actualiza y los datos se conservan.
echo ============================================================
pause

rem Detener VetCompras si está abierto (para poder reemplazar archivos)
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }" >nul 2>nul

if exist "%DESTINO%\\.env" copy /y "%DESTINO%\\.env" "%TEMP%\\vetcompras.env" >nul
robocopy "%ORIGEN%." "%DESTINO%" /E /NFL /NDL /NJH /NJS /XD datos /XF registro.log "Usar desde la USB.bat" >nul
if exist "%TEMP%\\vetcompras.env" move /y "%TEMP%\\vetcompras.env" "%DESTINO%\\.env" >nul

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\\VetCompras.lnk');" ^
  "$s.TargetPath='wscript.exe';$s.Arguments='\\"%DESTINO%\\VetCompras.vbs\\"';$s.WorkingDirectory='%DESTINO%';$s.IconLocation='shell32.dll,43';$s.Save()"

set /p AUTO="Desea que VetCompras arranque solo al encender el PC? (S/N): "
if /i "%AUTO%"=="S" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\\VetCompras.lnk');" ^
    "$s.TargetPath='wscript.exe';$s.Arguments='\\"%DESTINO%\\VetCompras.vbs\\" /sinNavegador';$s.WorkingDirectory='%DESTINO%';$s.Save()"
)

if exist "%ORIGEN%datos\\vetcompras.db" (
  echo.
  echo Esta USB tiene datos propios en la carpeta "datos".
  echo Para pasarlos a este PC: abra VetCompras en la USB, Datos y Respaldo,
  echo "Exportar respaldo completo", y luego importelo en la version instalada.
)

echo.
echo LISTO. Abra VetCompras con el icono del escritorio.
pause
`
);

escribir(
  'Detener VetCompras.bat',
  `@echo off
powershell -NoProfile -Command "$c = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if ($c) { $c | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }; Write-Host 'VetCompras se detuvo.' } else { Write-Host 'VetCompras no estaba abierto.' }"
timeout /t 3 >nul
`
);

escribir(
  'Recuperar acceso.bat',
  `@echo off
chcp 65001 >nul
echo Crea un acceso de emergencia de administrador (si olvidó la contraseña).
echo Si usa VetCompras desde la USB, escriba U; si está instalado en este PC, escriba P.
set /p MODO="(U/P): "
if /i "%MODO%"=="U" set VETCOMPRAS_DATOS=%~dp0datos
"%~dp0node\\node.exe" "%~dp0recuperar.mjs"
pause
`
);

escribir(
  'LEEME.txt',
  `VETCOMPRAS ${pkg.version} - VERSION PORTABLE PARA WINDOWS
=====================================================

No necesita instalar nada más: Node.js ya viene incluido (carpeta "node").

OPCION A - INSTALAR EN UN PC (recomendado para el equipo de la veterinaria)
  1. Copie esta carpeta a una USB o al PC.
  2. Doble clic en "Instalar en este PC.bat".
  3. Use el icono "VetCompras" del escritorio.
  Los datos quedan en C:\\Users\\<usuario>\\VetCompras\\datos (con respaldos diarios).
  Para ACTUALIZAR: repita el paso 2 con la versión nueva. Los datos no se tocan.

OPCION B - USAR DESDE LA USB (llevar el sistema y los datos a cualquier PC)
  1. Copie esta carpeta a la USB.
  2. Doble clic en "Usar desde la USB.bat".
  Los datos quedan en la carpeta "datos" de la USB.
  IMPORTANTE: si la USB se pierde o se daña, se pierden los datos. Configure en
  "Seguridad y Respaldos" una copia en otra carpeta (disco del PC u OneDrive).

La primera vez el sistema pide crear el usuario administrador.
Para cerrar el programa: "Detener VetCompras.bat" o Seguridad y Respaldos > Apagar.
Si algo falla, revise el archivo registro.log de esta carpeta.
`
);

// 4. ZIP para descargar
const zip = new JSZip();
const agregar = (dir, base) => {
  for (const nombre of fs.readdirSync(dir)) {
    const ruta = path.join(dir, nombre);
    const enZip = base ? `${base}/${nombre}` : nombre;
    if (fs.statSync(ruta).isDirectory()) agregar(ruta, enZip);
    else zip.file(enZip, fs.readFileSync(ruta));
  }
};
agregar(salida, 'VetCompras');
const archivoZip = path.join(path.dirname(salida), `VetCompras-${pkg.version}-portable-windows.zip`);
fs.writeFileSync(archivoZip, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } }));
console.log(`Portable listo:\n  carpeta: ${salida}\n  zip:     ${archivoZip} (${(fs.statSync(archivoZip).size / 1048576).toFixed(1)} MB)`);
