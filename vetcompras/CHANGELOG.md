# Novedades de VetCompras

Cada versión nueva se instala encima de la anterior sin perder datos: el sistema
hace una copia de seguridad y adapta la base de datos al abrir.

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
