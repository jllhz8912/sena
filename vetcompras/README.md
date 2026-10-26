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

## Instalación (Windows)

1. Instale **Node.js LTS** (versión 22.13 o superior) desde <https://nodejs.org>.
2. Copie la carpeta `vetcompras` al PC (por ejemplo `C:\VetCompras`).
3. Doble clic en **`instalar.bat`**. Instala los componentes, prepara la aplicación y
   crea el icono **VetCompras** en el escritorio.
4. Para usar el sistema: doble clic en el icono **VetCompras** (o `iniciar.bat`).
   Se abre una ventana negra (el servidor local; no la cierre mientras trabaja) y el
   navegador en `http://localhost:3000`.

Para usarlo desde varios equipos de la misma red: en el `.env` ponga `HOST=0.0.0.0`
y abra `http://IP-DEL-PC-PRINCIPAL:3000` en los demás. Todos comparten la misma base
de datos y la pantalla se refresca sola cuando otro equipo registra algo.

### Lectura de facturas

- **XML / ZIP de la DIAN** (UBL 2.1, incluido el `AttachedDocument`): se procesan en el
  PC, sin internet. Un ZIP puede traer varias facturas.
- **PDF o foto**: opcional, con Gemini (requiere internet y `GEMINI_API_KEY` en el `.env`).
  Si no se configura, el resto del sistema funciona igual.

## Actualizar a una versión nueva

Doble clic en **`actualizar.bat`**. El script:

1. Copia la base de datos a `copias-antes-de-actualizar`.
2. Descarga la versión nueva (`git pull`) o le pide descomprimir el `.zip` nuevo encima
   de la carpeta del programa.
3. Reinstala componentes y vuelve a preparar la aplicación.

Al abrir el programa actualizado, la base de datos se adapta sola a la nueva versión
(con respaldo previo). Si alguien abre una base de datos con un programa **más antiguo**
que ella, el programa se detiene sin modificar nada y pide instalar la versión reciente.

## Para quien desarrolle mejoras

```bash
npm install
npm run dev      # servidor + Vite con recarga en caliente (http://localhost:3000)
npm test         # pruebas: lector XML UBL, base de datos, formateadores
npm run lint     # verificación de tipos
npm run build    # compila la interfaz en dist/
npm start        # modo instalado
```

Estructura:

```
server.ts               arranque del servidor local
server/basedatos.ts     SQLite (node:sqlite), migraciones y respaldos
server/api.ts           API REST /api/...
server/gemini.ts        extracción opcional de PDF
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
