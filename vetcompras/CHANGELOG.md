# Novedades de Sistema de Control

Cada versión nueva se instala encima de la anterior sin perder datos: el sistema
hace una copia de seguridad y adapta la base de datos al abrir.

## 2.0.0 — Aplicativo Sistema de Control 2.0
Primera versión comercial y genérica (basada en VetCompras 2.14).
- **Licencia por equipo**: al instalar, el programa muestra el *código de equipo*; el
  proveedor emite una clave firmada digitalmente para ese código y el cliente la activa una
  sola vez (pegándola o con el archivo `.lic`). Sin licencia válida no se puede ingresar. La
  clave no sirve en otro computador, no se puede alterar (firma Ed25519) y puede tener fecha
  de vencimiento. Se guarda aparte de la base de datos: restaurar copias o "borrar todo" no la
  quita.
- **Marca genérica**: sin logo ni nombre de ningún negocio. Cada empresa carga en
  Configuración su razón social, NIT, logo y color; el color elegido se aplica a toda la
  interfaz y a los recibos.
- **Dato adicional de la venta configurable** (antes "Mascota"): Referencia, Placa,
  Paciente, Mesa… según el negocio.
- Instalaciones nuevas: categorías de venta neutras (Productos, Servicios, Otros ingresos),
  subcategorías y centros de costo genéricos, sin proveedores de ejemplo. Todo editable en
  Catálogos.
- Datos en `C:\Users\<usuario>\SistemaControl\datos` (si ya existía una instalación de
  VetCompras, se sigue usando su carpeta y sus datos).
- La demostración en un solo archivo no pide licencia, pero permite hasta 60 ventas y 60
  compras.
- Instalador sin VBScript ni PowerShell (algunos antivirus lo bloqueaban como sospechoso):
  lanzadores `.cmd` legibles, el servidor queda en una ventana minimizada "Sistema de Control -
  servidor" y abre el navegador solo. El arranque automático al encender el PC ahora es opcional
  y manual (carpeta shell:startup).
- "Recuperar acceso" también quita el PIN olvidado del perfil Administración.

## 2.14.0
- **Subcategorías en las categorías de compras y gastos** (Catálogos → Categorías de compras y
  gastos): cada categoría puede tener sus subcategorías; se crean, renombran y eliminan desde
  la misma ventana de la categoría. Vienen de fábrica, por ejemplo Servicios públicos →
  Energía eléctrica, Acueducto y alcantarillado, Gas natural, Internet y telefonía,
  Recolección de residuos biológicos y Aseo; también para Mercancía, Arriendos, Personal y
  Gastos varios. Al eliminar una, los documentos que ya la usan conservan su nombre.
- La subcategoría se elige al registrar la compra o gasto (sencilla y detallada) y al
  revisar facturas XML/PDF; aparece en el detalle del documento, en la exportación a Excel
  y en Reportes de Compras y Gastos (columna, filtro y agrupación "Por subcategoría").
- **Cambiar la forma de pago de una compra ya guardada**: al editarla se puede pasar de
  contado a crédito, a crédito-contado o al revés; el saldo y el estado se recalculan. El
  pago de contado o el abono inicial del registro se reemplazan y los abonos hechos después
  en Cuentas por Pagar se conservan.
- Las instalaciones existentes reciben las subcategorías de fábrica al actualizar
  (sin tocar las categorías propias ni subcategorías ya creadas).

## 2.13.0
- **Reportes por perfil**, con periodo (hoy, semana, mes, año o rango), filtros, agrupaciones,
  columnas a elección (se recuerdan en el equipo), orden por columna, fila de totales y
  **exportación a Excel**:
  - **Reportes de Ventas** (perfil Ventas): por venta, por producto o servicio, por categoría,
    por cliente, por día y por medio de pago; filtros por texto (recibo, cliente, mascota,
    producto), categoría, medio de pago y pagadas / con saldo por cobrar.
  - **Reportes de Compras y Gastos** (perfil Compras): por documento, proveedor, categoría,
    mes, producto (líneas), **IVA descontable por tarifa (F300)** y **retenciones por tercero
    (F350)**; filtros por texto (número, CUFE, proveedor, producto), proveedor, categoría,
    compra o gasto, estado de pago y forma de pago.
- **Editables**: en el detalle por venta o por documento, el lápiz abre el registro para
  corregirlo; al guardar se vuelve al mismo reporte con los datos actualizados.
- Los reportes son módulos con permiso propio en "Perfiles y permisos"; los perfiles
  guardados antes los reciben automáticamente.

## 2.12.0
- **Panel propio por perfil**, con selector de periodo (hoy, esta semana, este mes, este año
  o rango de fechas):
  - **Panel de Ventas** (pantalla inicial del perfil Ventas): total vendido, ticket promedio,
    cobrado, por cobrar y cartera total; **cuadre de caja** por medio de pago (efectivo,
    Nequi, Daviplata, transferencia, tarjeta y crédito); ventas por categoría; lo más
    vendido; ventas a crédito por cobrar; últimas ventas para validar y ventas mes a mes.
  - **Panel de Compras y Gastos** (pantalla inicial del perfil Compras): compras, gastos,
    total, IVA descontable, retenciones y compras que sumaron al inventario; control de
    facturas (por pagar, con saldo, vencidas, pagadas); vencidas y por vencer en 7 días;
    categorías; proveedores; mes a mes y últimos documentos para validar.
- Los paneles son módulos con permiso propio en "Perfiles y permisos". Los perfiles guardados
  en la 2.11 reciben su panel automáticamente. Administración conserva el Dashboard general
  y puede abrir ambos paneles.

## 2.11.0
- **Perfiles de ingreso**: después de "Ingresar" se elige **Ventas**, **Compras y Gastos** o
  **Administración**. Cada perfil ve solo sus módulos en el menú, en "Nuevo registro", en el
  botón flotante y en la barra del celular:
  - Ventas: Módulo de Ventas, Precios de Venta y Catálogos.
  - Compras y Gastos: Compras y Gastos, Cuentas por Pagar, Cargar Compras, Inventario y Catálogos.
  - Administración: todos los módulos.
- **Perfiles y permisos** (Perfiles y Bitácora): Administración marca qué módulos ve cada
  perfil, cambia nombres y descripciones, crea o elimina perfiles y asigna un **PIN** (4 a 8
  números, guardado cifrado). Botón para restaurar los de fábrica. Cada ingreso con perfil
  queda en la bitácora. "Cambiar de perfil" desde el menú del usuario.
- **Compras y Gastos**: registro **Sencilla** (datos básicos) o **Detallada** (tipo, prefijo,
  CUFE, centro de costo, retenciones, soporte). Pregunta "¿Es compra de mercancía?" y
  "¿Desea que afecte el inventario?"; si afecta, los productos se cargan a mano o con una
  **plantilla de Excel** (descargar, diligenciar y subir). Si no afecta, solo datos básicos.
- **Formas de pago**: contado (uno o varios medios), crédito y **crédito-contado** (abono
  inicial y saldo con vencimiento).
- **Control de facturas** en Compras y Gastos: todas, por pagar, con saldo, vencidas y
  pagadas, con cantidad, valor y saldo; clic para filtrar.
- **Inventario** solo administra (consultar, validar, bajas, ajustes, saldo inicial): las
  entradas salen de las compras que afectan inventario y las salidas de las ventas, aunque
  no haya saldo.
- Se quita el menú "Registro Manual": el registro está en Compras y Gastos y en Ventas.

## 2.10.0
- **Alerta semanal obligatoria de copia de seguridad**: cada 7 días aparece un aviso rojo a
  pantalla completa, "HAGA LA COPIA DE SEGURIDAD Y SÚBALA A LA NUBE (DRIVE)", con los pasos
  (Copias de Seguridad → "Copiar y descargar", subir el archivo a Google Drive u OneDrive y
  verificar). No deja ingresar ni trabajar hasta pulsar **Aceptar**; Escape no la cierra.
- Aparece en la pantalla de inicio y también con el sistema abierto (se revisa cada 15
  minutos y al volver a la ventana). "Aceptar e ir a Copias de Seguridad" abre ese módulo.
- Cada aceptación queda en la bitácora (Ingreso y Bitácora).

## 2.9.0
- **Panel Central sin gráficas**: ahora muestra tarjetas como las de Reportes, con valor,
  participación (%), cantidad y barra de avance:
  - **Ventas por categoría** del año (todas las categorías vigentes, ordenadas por valor).
  - **Compras y gastos por categoría**, diferenciando compra y gasto.
  - **Ventas y compras mes a mes**: ventas, compras, gastos y resultado de cada mes, con el
    mes actual resaltado.
  - **Proveedores con más compras** y **compras y gastos por centro de costo**.
- Clic en una tarjeta de ventas abre Ventas; en una de compras abre Compras y Gastos.
- El demo descargable abre con doble clic en Windows (declara UTF-8).

## 2.8.0
- **Catálogo único** (Catálogos > Productos, servicios y gastos): crear, editar, desactivar y
  eliminar productos, servicios y conceptos de gasto en un solo lugar. Cada uno indica para
  qué sirve (ventas, compras, gastos), su categoría de venta y subcategoría, su categoría de
  compra o gasto y centro de costo, precio de venta, último costo, tarifa de IVA, unidad,
  grupo, otros nombres y si lleva existencias.
- Lo creado allí aparece **al vender** (buscador rápido), **al registrar compras y gastos**
  (sugerencias de cada ítem, que traen código, unidad, IVA, último costo, categoría y centro
  de costo), en **Inventario** (solo productos) y en **Precios de Venta**.
- Los servicios y conceptos de gasto no mueven el inventario.
- **Traer de las ventas**: crea en el catálogo, con su categoría y último precio, lo que se ha
  vendido escribiéndolo a mano. En la venta, un concepto nuevo se puede guardar en el
  catálogo con una casilla.
- **Categorías de venta editables**: crear, renombrar, ordenar, cambiar subcategorías y
  eliminar. Las ventas ya registradas conservan su categoría y su nombre; los reportes y el
  buscador usan las categorías vigentes. Botón para restaurar las de fábrica.

## 2.7.0
- **Buscador rápido en la venta** (F2): busca productos y servicios por palabras sueltas en
  cualquier orden y sin tildes (nombre, código, otros nombres, grupo, categoría), con filtros
  por categoría, Productos / Servicios y Más vendidos. Muestra precio, existencia y veces
  vendido; ↑ ↓ y Enter agregan; "3*nombre" agrega 3 unidades; repetir un ítem suma cantidad.
- **Plantilla de compras con productos**: una fila por producto (código, cantidad, costo
  unitario, tarifa de IVA y precio de venta sugerido). Las filas de una misma factura forman
  una compra; los productos entran al inventario con su precio de venta y aparecen en
  Precios de Venta con su margen. El precio se puede editar después y no se pisa al
  recalcular. Bases e IVA por tarifa (5 % / 19 %) correctos para el Formulario 300.
- Corrección tributaria: una fila con solo "Valor facturado" ya no supone un IVA del 19 %
  (inflaba el IVA descontable); se toma sin IVA salvo que se indique.
- Las importaciones de Excel sin productos ya no crean productos en el inventario.
- Descargas de Excel (plantillas, exportaciones) y anexos funcionan también en la demo en línea.

## 2.6.0
- **Precios de Venta** (nuevo módulo): ficha por producto o servicio con sus costos
  (compra traída del inventario, insumos, mano de obra por minutos, desechables, flete…),
  gastos generales en %, ganancia deseada (margen sobre el precio o % sobre el costo),
  comisión de datáfono o plataforma, IVA y redondeo. Calcula el precio sugerido y la
  rentabilidad real del precio que usted decida (ganancia, margen, % sobre costo y precio
  mínimo para no perder), con avisos de pérdida o margen bajo.
- Todo es editable y cada cambio de precio queda en el historial con su motivo. Avisa cuando
  el costo del producto en el inventario cambió.
- **Facturar** desde el módulo (uno o varios seleccionados) abre la venta con los ítems y
  precios; en la venta, al escribir el concepto se trae el precio calculado. El precio
  aplicado se actualiza también en el inventario. Exportación a Excel.

## 2.5.0
- **Inventario** (nuevo módulo, informativo y no restrictivo): existencias por producto,
  kárdex de movimientos, costo promedio y valor del inventario. Las compras con detalle de
  productos (XML, PDF, foto, registro manual o Excel) suman; las ventas restan; se registran
  bajas (daño, pérdida, vencimiento) y ajustes por conteo físico. El saldo puede quedar en
  negativo y nunca impide vender. Todo movimiento se puede editar o eliminar.
- Importación del inventario inicial o de movimientos desde Excel (con plantilla) y
  exportación de existencias y kárdex.
- En la venta, el concepto sugiere los productos del inventario, trae el precio de venta y
  muestra la existencia como información.
- **Lectura de PDF y fotos de facturas sin internet**: código QR de la DIAN, texto del PDF y
  reconocimiento de imagen (OCR) para documentos escaneados. Toma emisor, NIT, número,
  fechas, forma de pago, valor sin IVA, IVA, retenciones, total y el detalle de productos.
  Sirve para facturas electrónicas, de papel, cuentas de cobro y cotizaciones.
- Menú unificado: "Cargar Compras" recibe XML/ZIP, PDF, fotos y matrices de Excel.

## 2.4.1
- Reportes F300/F350 en pantalla, corrección de la diferencia falsa con retenciones
  y archivo de prueba que abre con doble clic en Windows.

## 2.4.0
- **Marca Los Criollos Vet**: el logo viene incluido con el programa y aparece en la
  pantalla de inicio, el menú, la barra superior y los recibos (no hay que cargarlo).
  En Configuración se puede poner otro y volver al de Los Criollos con un clic.
- **Colores del logo** en todo el sistema: morado (botones, menú, encabezados), verde
  azulado y azul marino; también en las gráficas y en los recibos PDF.
- **Vista previa del recibo corregida**: antes dependía del visor de PDF del navegador
  (no existe en celulares Android y se bloquea en la demostración en línea). Ahora el
  recibo se dibuja como imagen y se ve siempre. Nuevo botón "Abrir PDF / imprimir".
- Al actualizar, si la veterinaria seguía como "Mi Veterinaria" toma el nombre Los
  Criollos Vet; un nombre o un color ya elegidos no se cambian.
- **Reportes para la DIAN**: botones "IVA · Form. 300" (bases e IVA descontable por
  tarifa con detalle de facturas) y "Retenciones · Form. 350" (ReteFuente, ReteIVA y
  ReteICA practicadas por proveedor) para el período elegido.
- Corrección: al revisar una factura electrónica con retenciones aparecía una
  "Diferencia" falsa; el total de la factura ya no se compara restando retenciones.
- Archivo de prueba (.html): corregido el error "VetCompras no está abierto en este PC"
  al abrirlo con doble clic en Windows.

## 2.3.0
- **Borrar todo**: botón en *Datos y Respaldo* y en *Copias de Seguridad* para empezar
  de cero. Borra compras, ventas, proveedores y catálogos; conserva los datos y el logo
  de la veterinaria, la forma de ingreso, la bitácora y las copias de seguridad.
- **Antes de cualquier borrado pregunta "¿Desea hacer una copia de seguridad?"**
  (hacer copia, hacer copia y descargarla, o continuar sin copia). Aplica a Borrar todo,
  Limpiar compras, Borrar todas las ventas y Cargar datos de demostración. Para Borrar todo
  además hay que escribir BORRAR. Aunque se elija no hacer copia, el sistema deja una
  copia automática interna.

## 2.2.0
- **Pantalla de inicio sin usuario ni contraseña**: muestra el logo y el nombre de la
  veterinaria y un botón grande "Ingresar" (también con la tecla Enter).
- La contraseña queda como opción: *Ingreso y Bitácora → Forma de ingreso* permite
  activarla (y volver a quitarla). Los usuarios ya creados se conservan.
- Al instalar sobre una versión anterior, la empresa de ejemplo se reemplaza por
  "Mi Veterinaria" para que la pantalla de inicio no muestre datos ajenos; los datos
  reales ya configurados no se tocan.
- La bitácora sigue registrando cada ingreso, y en la versión de prueba la observación
  pide el nombre de quien prueba.

## 2.1.0
- **Copias de Seguridad**: módulo propio para hacer copias, descargarlas, cargarlas
  desde un archivo (.db o .json), restaurarlas y abrir la carpeta donde se guardan.
- **Recordatorio de copias**: alerta en la campana, en el menú y al ingresar cuando
  pasan los días configurados (1, 3, 7, 15 o 30) sin copia de seguridad.
- **Versión de prueba**: aviso visible, botón "Observación" para los probadores y
  revisión/exportación de observaciones. Los datos de prueba van en una carpeta aparte.
- **Cuentas por pagar**: vencimientos con semáforo, abonos parciales, pago total,
  anulación de abonos y alertas (vencidas, hoy y un día antes).
- **Versión portable** para Windows: Node.js incluido; se instala desde USB o se usa
  directamente desde la USB.
- Corrección: las fechas de "hoy" se tomaban en hora UTC (después de las 7 p. m. en
  Colombia quedaba el día siguiente).

## 2.0.0
- Instalación local con base de datos SQLite en el PC, respaldos automáticos y
  actualizaciones sin pérdida de datos.
- Usuarios, roles (administrador / auxiliar), bitácora de auditoría.
- Ventas con varios ítems y formas de pago, recibo PDF (carta y tirilla).
- Lector XML UBL 2.1 corregido (IVA duplicado, retenciones, notas crédito).
