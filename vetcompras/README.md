# VetCompras 2.0 — instalación local

Control de compras, gastos, ventas e informes tributarios (IVA F300, retenciones F350)
para veterinarias en Colombia. **Se instala en el PC de la veterinaria y toda la
información queda guardada en ese mismo equipo**: no depende de servicios en la nube.

## Dónde quedan los datos

| Qué | Dónde (Windows) |
|---|---|
| Base de datos (facturas, ventas, proveedores, configuración, PDF/XML anexos) | `C:\Users\<usuario>\VetCompras\datos\vetcompras.db` |
| Respaldos automáticos | `C:\Users\<usuario>\VetCompras\datos\respaldos\` |
| Copias hechas al actualizar | `C:\Users\<usuario>\VetCompras\copias-antes-de-actualizar\` |

La carpeta de datos está **fuera** de la carpeta del programa, así que reinstalar o
actualizar el programa no la toca. Se puede cambiar con `VETCOMPRAS_DATOS` en el `.env`.

Respaldos que el sistema hace solo:

- **Diario**: al abrir el programa por primera vez en el día (se guardan los últimos 30).
- **Antes de actualizar** la estructura de la base de datos (nunca se borran solos).
- **Antes de cualquier operación masiva**: limpiar compras o ventas, cargar datos de
  demostración, restablecer catálogos o importar un respaldo.

Además, desde **Datos y Respaldo** se puede crear un respaldo en el PC en cualquier
momento o exportar un archivo JSON completo para llevarlo a otro equipo o a una USB.

## Versión portable (USB o disco, sin instalar nada)

`npm run build:portable -- <ruta-a-node.exe>` genera `dist-portable/VetCompras-<versión>-portable-windows.zip`
(≈32 MB) con Node.js incluido. Se descomprime en una USB o en el disco y:

- **Instalar en este PC.bat**: copia el programa a `%LOCALAPPDATA%\VetCompras\programa`, crea el icono del
  escritorio y (opcional) el arranque con Windows. Los datos quedan en `C:\Users\<usuario>\VetCompras\datos`.
  Para actualizar se repite con el zip nuevo: los datos no se tocan y la base se migra sola.
- **Usar desde la USB.bat**: ejecuta el sistema desde la USB con los datos en la carpeta `datos` de la misma USB.

El node.exe debe ser el oficial de nodejs.org (win-x64, 22.13 o superior); verifique su SHA-256 con `SHASUMS256.txt`.

## Instalación con Node.js (Windows)

1. Instale **Node.js LTS** (versión 22.13 o superior) desde <https://nodejs.org>.
2. Copie la carpeta `vetcompras` al PC (por ejemplo `C:\VetCompras`).
3. Doble clic en **`instalar.bat`**. Instala los componentes, prepara la aplicación,
   crea el icono **VetCompras** en el escritorio y pregunta si debe arrancar solo al
   encender el PC.
4. Doble clic en el icono **VetCompras**: abre el navegador en `http://localhost:3000`
   sin ventanas técnicas. Si el programa ya estaba abierto, solo abre el navegador.
5. La primera vez, un asistente pide el nombre de la veterinaria y crea el usuario
   **administrador**.

| Archivo | Para qué |
|---|---|
| Icono **VetCompras** (`VetCompras.vbs`) | Uso diario |
| `detener.bat` | Apagar el programa (también desde *Seguridad y Respaldos → Apagar*) |
| `actualizar.bat` | Instalar una versión nueva conservando los datos |
| `recuperar-acceso.bat` | Si se olvidó la contraseña de administrador |
| `iniciar.bat` | Abrir mostrando la ventana del servidor (soporte técnico) |

Para usarlo desde varios equipos de la misma red: en el `.env` ponga `HOST=0.0.0.0`
y abra `http://IP-DEL-PC-PRINCIPAL:3000` en los demás. Todos comparten la misma base
de datos y la pantalla se refresca sola cuando otro equipo registra algo.

### Lectura de facturas

- **XML / ZIP de la DIAN** (UBL 2.1, incluido el `AttachedDocument`): se procesan en el
  PC, sin internet. Un ZIP puede traer varias facturas.
- **PDF o foto**: opcional, con Gemini (requiere internet y `GEMINI_API_KEY` en el `.env`).
  Si no se configura, el resto del sistema funciona igual.

## Seguridad

| Medida | Detalle |
|---|---|
| Usuarios y contraseñas | Todos ingresan con usuario propio. Contraseñas de mínimo 8 caracteres con letras y números, guardadas cifradas (scrypt); nadie puede verlas, ni el administrador. |
| Roles | **Administrador**: todo. **Auxiliar**: registra y edita compras, facturas y ventas y consulta reportes; no puede borrar, restaurar, importar/exportar la base completa, ni cambiar configuración, catálogos o usuarios. El servidor hace cumplir los permisos aunque alguien manipule la pantalla. |
| Contraseña temporal | Los usuarios nuevos o con contraseña restablecida deben cambiarla al primer ingreso. |
| Cierre por inactividad | La sesión se cierra tras 60 minutos sin uso (`MINUTOS_INACTIVIDAD` en `.env`). |
| Intentos fallidos | 5 intentos fallidos bloquean ese usuario en ese equipo durante 10 minutos. |
| Bitácora | Ingresos, intentos fallidos, creaciones, modificaciones, eliminaciones, respaldos y cambios de usuarios quedan registrados con fecha, usuario y equipo. No se puede editar desde la aplicación. |
| Red | Por defecto solo responde en el propio PC (`HOST=127.0.0.1`). Cookies `HttpOnly` + `SameSite=Strict`, cabecera anti-CSRF y política de contenido (CSP). |
| Respaldos | Diarios, antes de cada operación delicada y, si se configura, copia automática a otra carpeta (otro disco, USB u OneDrive). Se pueden descargar y restaurar desde *Seguridad y Respaldos*. |
| Olvido de contraseña | Un administrador asigna una temporal. Si se olvidó la del único administrador, `recuperar-acceso.bat` (solo en el PC servidor) crea un acceso de emergencia y lo deja en la bitácora. |

Recomendaciones del entorno, fuera del alcance del programa: usuario de Windows con
contraseña para cada persona, cifrado del disco con BitLocker y antivirus actualizado.
La base de datos no va cifrada dentro del disco: quien tenga acceso a los archivos del
PC con la sesión de Windows abierta podría copiarla, por eso es importante BitLocker.

## Actualizar a una versión nueva

Doble clic en **`actualizar.bat`**. El script:

1. Copia la base de datos a `copias-antes-de-actualizar`.
2. Descarga la versión nueva (`git pull`) o le pide descomprimir el `.zip` nuevo encima
   de la carpeta del programa.
3. Reinstala componentes y vuelve a preparar la aplicación.

Al abrir el programa actualizado, la base de datos se adapta sola a la nueva versión
(con respaldo previo). Si alguien abre una base de datos con un programa **más antiguo**
que ella, el programa se detiene sin modificar nada y pide instalar la versión reciente.

## Cómo se hacen cambios en el futuro

El código fuente vive en GitHub (`jllhz8912/sena`, carpeta `vetcompras`). La USB o el PC solo
tienen el programa compilado; **nunca se edita el programa instalado**. El ciclo es:

1. **Pedir el cambio**: describirlo (por ejemplo, a Claude Code sobre este repositorio o a un
   desarrollador). Las observaciones exportadas desde la versión de prueba sirven de insumo.
2. **Desarrollar y probar**: se modifica el código, se ejecutan `npm test` y `npm run lint`, y
   si el cambio toca la estructura de datos se agrega una migración (ver abajo).
3. **Subir la versión**: aumentar `version` en `package.json` (2.1.0 → 2.1.1 para arreglos,
   2.2.0 para funciones nuevas) y anotar el cambio en `CHANGELOG.md`.
4. **Empaquetar**:
   - Para probadores: `npm run build && node scripts/empaquetarPortable.mjs <node.exe> --prueba`
   - Versión final: `npm run build:portable -- <node.exe>`
5. **Instalar**: en el PC, "Instalar en este PC.bat" del zip nuevo; en la USB, descomprimir
   encima. Los datos no se tocan; al abrir se hace una copia y la base se migra sola.

Si algo sale mal tras actualizar: en **Copias de Seguridad** se restaura la copia
"Antes de actualizar el programa", o se reinstala el zip de la versión anterior (el sistema
no abre una base de una versión más nueva, para no dañarla).

## Para quien desarrolle mejoras

```bash
npm install
npm run dev      # servidor + Vite con recarga en caliente (http://localhost:3000)
npm test         # pruebas: lector XML UBL, base de datos, seguridad, ventas, cartera
npm run build:demo   # demostración sin servidor (dist-demo/)
npm run lint     # verificación de tipos
npm run build    # compila la interfaz en dist/
npm start        # modo instalado
```

Estructura:

```
server.ts               arranque del servidor local
server/basedatos.ts     SQLite (node:sqlite), migraciones y respaldos
server/api.ts           API REST /api/...
server/seguridad.ts     usuarios, contraseñas, sesiones y permisos
server/gemini.ts        extracción opcional de PDF
scripts/                recuperación de acceso de emergencia
src/                    interfaz React (los componentes usan src/services/dataService.ts)
tests/                  pruebas con Vitest
ejemplos/               XML de factura de prueba (datos ficticios)
```

### Regla de oro para no perder información

Cada registro se guarda como JSON en la tabla `registros`, así que **agregar campos
nuevos a una factura, venta o proveedor no requiere migración**: los registros viejos
simplemente no traen el campo y el código debe tolerarlo (`valor ?? defecto`).

Cuando una mejora necesite cambiar la estructura (tablas nuevas, transformar datos
existentes, renombrar un campo):

1. Agregue una entrada **al final** de `MIGRACIONES` en `server/basedatos.ts` con el
   número de versión siguiente. **Nunca** edite ni borre una migración ya publicada.
2. Transforme los datos dentro de la migración; no los borre.
3. Agregue una prueba en `tests/basedatos.test.ts` que cree la base con la versión
   anterior y verifique que los datos sobreviven a la migración.

El servidor aplica las migraciones pendientes al arrancar, dentro de una transacción y
después de crear el respaldo `antes-de-actualizar-vN-a-vM`.

### Pasar datos desde la versión anterior (navegador / Firebase)

En la versión anterior use **Datos y Respaldo → Exportar respaldo completo** para
descargar el JSON, y en esta versión **Importar respaldo JSON**. La importación combina
por `id` y nunca borra registros existentes. (El respaldo de la versión anterior no
incluía las ventas: expórtelas a Excel antes de dejar de usarla.)
