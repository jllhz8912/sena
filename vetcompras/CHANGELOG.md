# Novedades de VetCompras

Cada versión nueva se instala encima de la anterior sin perder datos: el sistema
hace una copia de seguridad y adapta la base de datos al abrir.

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
