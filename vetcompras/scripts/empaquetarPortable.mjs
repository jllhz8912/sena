/**
 * Arma la versión PORTABLE de Sistema de Control 2.0 para Windows: una carpeta (y un .zip)
 * que funciona en cualquier PC sin instalar Node.js, desde una USB o copiada al disco.
 *
 *   npm run build
 *   node scripts/empaquetarPortable.mjs <ruta-a-node.exe> [carpeta-salida] [--prueba]
 *
 * Con --prueba se arma el paquete para probadores: aviso de "versión de prueba",
 * botón de observaciones y datos en una carpeta aparte (datos-prueba).
 *
 * El node.exe debe ser el oficial de nodejs.org (win-x64), versión 22.13 o superior.
 */
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import JSZip from 'jszip';

const argumentos = process.argv.slice(2);
const esPrueba = argumentos.includes('--prueba');
const [nodeExe, salidaArg] = argumentos.filter((a) => !a.startsWith('--'));
if (!nodeExe || !fs.existsSync(nodeExe)) {
  console.error('Uso: node scripts/empaquetarPortable.mjs <ruta-a-node.exe> [carpeta-salida]');
  process.exit(1);
}
if (!fs.existsSync('dist/index.html')) {
  console.error('Falta la carpeta dist: ejecute primero "npm run build".');
  process.exit(1);
}
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const salida = salidaArg || path.join('dist-portable', esPrueba ? 'SistemaControl-PRUEBA' : 'SistemaControl');
// Solo se reemplaza una carpeta vacía o un paquete anterior: nunca otra carpeta con archivos
if (fs.existsSync(salida) && fs.readdirSync(salida).length && !fs.existsSync(path.join(salida, 'servidor.mjs'))) {
  console.error(`La carpeta "${salida}" tiene otros archivos. Indique una carpeta nueva o vacía para el paquete.`);
  process.exit(1);
}
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
  // Código legible (sin ofuscar): el código compactado hace que algunos antivirus marquen el paquete
};
await build({ ...comun, entryPoints: ['server.ts'], outfile: path.join(salida, 'servidor.mjs') });
await build({ ...comun, entryPoints: ['scripts/recuperarAcceso.ts'], outfile: path.join(salida, 'recuperar.mjs') });

// 2. Interfaz compilada, Node.js y licencia
fs.cpSync('dist', path.join(salida, 'dist'), { recursive: true });
fs.copyFileSync(nodeExe, path.join(salida, 'node', 'node.exe'));
const licencia = path.join(path.dirname(nodeExe), 'LICENSE');
if (fs.existsSync(licencia)) fs.copyFileSync(licencia, path.join(salida, 'node', 'LICENSE-nodejs.txt'));
fs.copyFileSync('.env.example', path.join(salida, '.env'));
if (esPrueba) fs.writeFileSync(path.join(salida, 'ETAPA_PRUEBA'), 'Paquete de prueba: los datos se guardan en datos-prueba.' + String.fromCharCode(13, 10));

const crlf = (t) => t.replace(/\r?\n/g, '\r\n');
const escribir = (nombre, texto) => fs.writeFileSync(path.join(salida, nombre), crlf(texto));

// 3. Lanzadores en archivos .cmd sencillos y legibles. Sin VBScript, sin PowerShell y sin
//    arranque automático oculto: esos patrones hacen que los antivirus marquen el paquete.
//    El servidor queda en una ventana minimizada con su nombre; cerrarla cierra el programa.
escribir(
  'Abrir Sistema de Control.cmd',
  `@echo off
rem Abre Sistema de Control. Si ya esta abierto, solo abre el navegador.
rem   Abrir Sistema de Control.cmd         datos en %USERPROFILE%\\SistemaControl\\datos
rem   Abrir Sistema de Control.cmd /usb    datos en la carpeta "datos" junto a este archivo
if not "%SC_MINIMIZADO%"=="1" (
  set SC_MINIMIZADO=1
  start "Sistema de Control - servidor" /min cmd /c ""%~f0" %*"
  exit /b
)
cd /d "%~dp0"
set ABRIR_NAVEGADOR=1
set VETCOMPRAS_LOG=%~dp0registro.log
if /i "%~1"=="/usb" (
  if exist "%~dp0ETAPA_PRUEBA" (set "SISTEMA_CONTROL_DATOS=%~dp0datos-prueba") else (set "SISTEMA_CONTROL_DATOS=%~dp0datos")
)
echo ============================================================
echo   SISTEMA DE CONTROL 2.0 esta funcionando.
echo   Deje esta ventana minimizada mientras usa el programa.
echo   Al cerrarla, el programa se detiene.
echo ============================================================
"%~dp0node\\node.exe" "%~dp0servidor.mjs"
if errorlevel 1 (
  echo.
  echo No fue posible iniciar. Revise el archivo registro.log de esta carpeta.
  pause
)
`
);

escribir(
  'Usar desde la USB.cmd',
  `@echo off
rem Abre Sistema de Control con los datos guardados en esta misma USB (carpeta "datos").
call "%~dp0Abrir Sistema de Control.cmd" /usb
`
);

escribir(
  'Instalar en este PC.cmd',
  `@echo off
chcp 65001 >nul
title Instalar Sistema de Control 2.0 en este PC
set "ORIGEN=%~dp0"
set "DESTINO=%LOCALAPPDATA%\\SistemaControl\\programa"

echo ============================================================
echo   INSTALAR SISTEMA DE CONTROL 2.0 EN ESTE PC
echo   Programa: %DESTINO%
if exist "%ORIGEN%ETAPA_PRUEBA" (
  echo   VERSION DE PRUEBA - datos de ensayo en: %USERPROFILE%\\SistemaControl\\datos-prueba
) else (
  echo   Datos:    %USERPROFILE%\\SistemaControl\\datos
)
echo   Al abrirlo por primera vez se pide la LICENCIA de este equipo.
echo   Si ya estaba instalado, se actualiza y los datos se conservan.
echo ============================================================
pause

rem Cerrar el programa si esta abierto (para poder reemplazar archivos)
taskkill /fi "WINDOWTITLE eq Sistema de Control - servidor*" /t /f >nul 2>nul

if exist "%DESTINO%\\ETAPA_PRUEBA" del /q "%DESTINO%\\ETAPA_PRUEBA"
robocopy "%ORIGEN%." "%DESTINO%" /E /NFL /NDL /NJH /NJS /XD datos datos-prueba /XF registro.log "Usar desde la USB.cmd" "Instalar en este PC.cmd" >nul
rem Lanzadores de versiones anteriores
if exist "%DESTINO%\\SistemaControl.vbs" del /q "%DESTINO%\\SistemaControl.vbs"
if exist "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\Sistema de Control.lnk" del /q "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\Sistema de Control.lnk"

rem Acceso en el escritorio (un .cmd que llama al programa instalado)
set "ESCRITORIO=%USERPROFILE%\\Desktop"
for /f "tokens=2,*" %%a in ('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders" /v Desktop 2^>nul ^| find "REG_"') do call set "ESCRITORIO=%%b"
if exist "%ESCRITORIO%\\Sistema de Control.lnk" del /q "%ESCRITORIO%\\Sistema de Control.lnk"
(
  echo @echo off
  echo call "%DESTINO%\\Abrir Sistema de Control.cmd"
) > "%ESCRITORIO%\\Sistema de Control.cmd"

if exist "%ORIGEN%datos\\vetcompras.db" (
  echo.
  echo Esta USB tiene datos propios en la carpeta "datos".
  echo Para pasarlos a este PC: en Copias de Seguridad de la USB use "Copiar y descargar"
  echo y luego "Cargar una copia de seguridad" en la version instalada.
)

echo.
echo LISTO. Abra "Sistema de Control" desde el escritorio.
pause
`
);

escribir(
  'Detener Sistema de Control.cmd',
  `@echo off
taskkill /fi "WINDOWTITLE eq Sistema de Control - servidor*" /t /f >nul 2>nul
echo Sistema de Control quedo cerrado.
timeout /t 3 >nul
`
);

escribir(
  'Recuperar acceso.cmd',
  `@echo off
chcp 65001 >nul
echo Crea un acceso de emergencia de administrador y quita el PIN del perfil Administracion.
echo Si usa Sistema de Control desde la USB, escriba U; si esta instalado en este PC, escriba P.
set /p MODO="(U/P): "
if /i "%MODO%"=="U" set "SISTEMA_CONTROL_DATOS=%~dp0datos"
"%~dp0node\\node.exe" "%~dp0recuperar.mjs"
pause
`
);

escribir(
  'LEEME.txt',
  `${esPrueba ? '*** VERSION DE PRUEBA ***  Use solo datos de ensayo.\n\n' : ''}APLICATIVO SISTEMA DE CONTROL ${pkg.version} - VERSION PORTABLE PARA WINDOWS
=========================================================================

No necesita instalar nada más: Node.js ya viene incluido (carpeta "node").

OPCION A - INSTALAR EN UN PC (recomendado)
  1. Copie esta carpeta al PC (o a una USB).
  2. Doble clic en "Instalar en este PC.cmd".
  3. Use "Sistema de Control" en el escritorio. El programa queda en una ventana
     minimizada llamada "Sistema de Control - servidor": no la cierre mientras trabaja.
  Los datos quedan en C:\\Users\\<usuario>\\SistemaControl\\${esPrueba ? 'datos-prueba' : 'datos'} (con respaldos diarios).

LICENCIA (primera vez)
  - Al abrir, el programa muestra el CODIGO DE EQUIPO (ej. 3F9A-21C0-7B44-E1D2).
  - Envíe ese código a su proveedor ("Copiar solicitud").
  - Pegue la clave que le envíen (empieza por SC2-) o cargue el archivo .lic y pulse Activar.
  - La licencia sirve solo para este computador. Si cambia de equipo o reinstala Windows,
    pida una licencia nueva a su proveedor.

OPCION B - USAR DESDE LA USB
  1. Copie esta carpeta a la USB.
  2. Doble clic en "Usar desde la USB.cmd".
  Los datos quedan en la carpeta "${esPrueba ? 'datos-prueba' : 'datos'}" de la USB.
  La licencia sigue ligada al computador: en otro PC el programa pedirá otra licencia.
  IMPORTANTE: si la USB se pierde o se daña, se pierden los datos. Configure en
  "Copias de Seguridad" una copia en otra carpeta (disco del PC u OneDrive).

PRIMEROS PASOS
  - Ingreso: botón grande "Ingresar" (sin contraseña). Para pedir usuario y contraseña:
    menu "Perfiles y Bitacora" > "Forma de ingreso".
  - Configuración: razón social, NIT, logo, color y textos del recibo de SU empresa.
  - Catálogos: categorías de venta, productos, servicios y gastos de su negocio.

ACTUALIZAR A UNA VERSION NUEVA (sin perder datos ni licencia)
  - Instalado en el PC: descomprima el zip nuevo y ejecute otra vez "Instalar en este PC.cmd".
  - En la USB: descomprima el zip nuevo ENCIMA de la carpeta de la USB y acepte reemplazar.
  Al abrir, el sistema hace una copia de seguridad y adapta la base de datos solo.
${esPrueba ? `
VERSION DE PRUEBA
  - Los datos de ensayo quedan en "datos-prueba", separados de los reales.
  - Use el botón amarillo "Observación" para reportar errores, sugerencias o dudas.
` : ''}
Para cerrar el programa: cierre la ventana "Sistema de Control - servidor",
use "Detener Sistema de Control.cmd" o Copias de Seguridad > Apagar.

ARRANQUE AUTOMATICO (opcional): copie el acceso "Sistema de Control" del escritorio
en la carpeta que abre Windows + R > shell:startup.
Si algo falla, revise el archivo registro.log de esta carpeta.

Software protegido por derechos de autor. Su uso está sujeto a la licencia otorgada
por el titular. Prohibida su copia, distribución o modificación sin autorización.
`
);

fs.copyFileSync('CHANGELOG.md', path.join(salida, 'NOVEDADES.txt'));

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
agregar(salida, 'SistemaControl');
const archivoZip = path.join(path.dirname(salida), `SistemaControl-${pkg.version}-${esPrueba ? 'PRUEBA-' : ''}portable-windows.zip`);
fs.writeFileSync(archivoZip, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } }));
console.log(`Portable listo:\n  carpeta: ${salida}\n  zip:     ${archivoZip} (${(fs.statSync(archivoZip).size / 1048576).toFixed(1)} MB)`);
