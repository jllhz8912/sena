# Entregables — Aplicativo Sistema de Control 2.0

## Para el usuario final (cliente)

| Archivo | Para qué |
|---|---|
| `SistemaControl-2.0.0-portable-windows.zip` | Instalador para Windows, versión 2.6 (con **Nómina y Empleados**, **Industria y Comercio (ICA)** y **valores de ley por año**: salario mínimo, auxilio, UVT, jornada, recargo dominical y tarifas de IVA editables en Configuración). No necesita internet: abre en su propia ventana y guarda todo en el PC. Pide activar la licencia del equipo al abrir. Datos en `C:\Users\<usuario>\SistemaControl\datos`. |
| `Video-Instalacion-PC-desde-cero-usuario-final-Sistema-de-Control-2.0.mp4` | Video de 7½ min con voz en español latino y subtítulos: instalar en el PC, activar la licencia, ver el sistema **en ceros**, datos del negocio, PIN y primera copia. |
| `Guia-de-instalacion-Sistema-de-Control-2.0.pdf` | Guía del PC para el usuario final (10 páginas, pantallazos con círculos rojos numerados): instalar, activar, empezar en ceros, datos del negocio, PIN, valores de ley por año y primera copia. |
| `Manual-de-Usuario-Sistema-de-Control-2.0.pdf` | Manual detallado (88 páginas): instalación, licencia, marca, cada módulo, nómina (quincena, prima, cesantías, vacaciones, liquidación final y comprobante), ICA, inventario y capítulo del celular. |
| `Videos-PC-parte-1-Sistema-de-Control-2.0.zip` | Videos 00 a 09 con voz en español latino: instalar el PC desde cero, activación, perfiles, ventas, compras y cuentas por pagar. |
| `Videos-PC-parte-2-Sistema-de-Control-2.0.zip` | Videos 10 a 18: reportes, inventario, catálogos, precios, dashboard, perfiles, **nómina (16 y 17)** e **ICA (18)**. |
| `Videos-Celular-Sistema-de-Control-2.0.zip` | Videos verticales 19 a 21: instalar desde cero, vender con fotos y comprar con foto de la factura. |
| `Plantilla_Compras_SistemaControl.xlsx` | Plantilla Excel para Cargar Compras. |
| `SistemaControl-Movil-2.0.apk` | **App para celulares Android** (7 o superior), versión 2.6: valores de ley por año editables, nómina e ICA (solo Administración), inicio con mosaicos de colores, inventario (Saldo = Compras − Ventas ± Ajustes; ajusta solo Administración, consultan Ventas y Compras), caja con fotos de productos, ticket con autosuma y descuento, datos del cliente y recibo con membrete (Guardar / Cobrar con cambio), compras por foto de la factura o factura electrónica, y los demás módulos del PC; guarda todo en el celular, sin internet; copias diarias y manuales en *Documentos › SistemaControl*; "Copiar y compartir" a Drive/WhatsApp. Licencia por celular. |
| `SistemaControl-Movil-PRUEBA.apk` | **Versión de prueba del celular** (app aparte "SC Prueba"): no pide licencia, trae datos de ejemplo y permite hasta 60 ventas y 60 compras. Para revisarla o mostrarla; no reemplaza la definitiva. |
| `Guia-Sistema-de-Control-Movil-2.0.pdf` | Guía del celular para el usuario final (10 páginas): instalar el APK, activar, empezar en ceros, crear el primer producto con foto, primera venta, copia de seguridad, pasar datos PC ↔ celular y problemas frecuentes. |
| `Video-Instalacion-celular-desde-cero-usuario-final-Sistema-de-Control-2.0.mp4` | Video vertical de 4½ min con voz en español latino: instalar en Android, activar, datos del negocio, primer producto, primera venta y copia de seguridad. |
| `Sistema-de-Control-2.0-DEMO.html` | Demostración para prospectos, sin licencia (máx. 60 ventas y 60 compras). |

## Para el dueño del software (uso interno)

| Archivo | Para qué |
|---|---|
| `Guia-facil-claves-y-permisos-Sistema-de-Control-2.0.pdf` | Paso a paso con pantallazos: hacer la licencia, activarla y dar permisos y PIN. |
| `Guia-del-vendedor-Licencias-Sistema-de-Control-2.0.pdf` | Licenciamiento, casos frecuentes y protección jurídica. |
| `Videos-Duenio-Sistema-de-Control-2.0.zip` | 3 videos: control de licencias para PC y celular (nuevo), emitir licencias y entregar el sistema al cliente. |
| `Guia-del-dueno-Control-de-licencias-PC-y-celular-Sistema-de-Control-2.0.pdf` | Guía del dueño (10 páginas con pantallazos señalizados): hacer licencias de PC y de celular, control de vencimientos, renovar, respaldo, **entregar el sistema limpio** y proteger la clave privada. |
| `Video-Dueno-Control-de-licencias-PC-y-celular-Sistema-de-Control-2.0.mp4` | El mismo video del dueño, suelto (7½ min). |
| `Publicidad-Sistema-de-Control.zip` | Publicidad para redes: 5 publicaciones cuadradas, 2 historias, video promocional vertical de 32 s con voz y textos listos para Instagram, Facebook, TikTok y WhatsApp Business (cambie **[tu WhatsApp]** por su número). |

Herramienta: `../herramientas/Generador-de-licencias.html` — emite licencias para **PC o celular**, lleva el registro con vigentes, por vencer y vencidas, filtros, renovación por un año y exportación CSV (requiere `CLAVE-PRIVADA-Sistema-de-Control.json`, que **no** está en el repositorio).

Celular: abrir `SistemaControl-Movil-2.0.apk` en el teléfono → permitir esta fuente → Instalar → activar la licencia del celular (mismo Generador).

**Todo se entrega limpio:** el instalador y la app nacen sin ventas, compras ni datos. Si usaste el programa desde una USB, antes de entregarlo ejecuta `Dejar limpio para entregar.cmd`.

Instalación en PC: extraer el zip → doble clic en "Instalar en este PC.cmd" → "Sistema de Control" en el escritorio → activar la licencia.

SHA-256:
- Guia-Sistema-de-Control-Movil-2.0.pdf: `802bdc088176d6f244ef7b466836788d3ab967a49ec9e49bd415b8d948fb2e4b`
- Guia-de-instalacion-Sistema-de-Control-2.0.pdf: `5b4a60b77f85040df4daab3e2a9ac17c3dac2d23390f5d8186777d8b7ec85e22`
- Guia-del-dueno-Control-de-licencias-PC-y-celular-Sistema-de-Control-2.0.pdf: `816fdfc050769f0c5c52080b2e805ac19633d59c53ffbf5a508baf8b13f759c4`
- Guia-del-vendedor-Licencias-Sistema-de-Control-2.0.pdf: `351a18b52083db1c5908ac24e5c03681409681d633551c6c12c9c505eb622e85`
- Guia-facil-claves-y-permisos-Sistema-de-Control-2.0.pdf: `7b4b971e81b1e926d00b6f7caabfcf1aa65b1ec133f08a20f2601b4f575456af`
- Manual-de-Usuario-Sistema-de-Control-2.0.pdf: `6a7eeaa8f7eda86bdac26e79d46397b7c459ce158efc777f60f6f7994d350705`
- Plantilla_Compras_SistemaControl.xlsx: `f4006949f7de2d16ab5668fe4e3ba264d29eeefab48b56b524c516b0b4e129f0`
- Publicidad-Sistema-de-Control.zip: `773ba8f8866e05afd85ff5bbadf564d812b4e2622ea41b6a04646871a5bde276`
- Sistema-de-Control-2.0-DEMO.html: `d6b2a852608ca97ad8e1269d738492f317e818abfd03984c784f83f3041d0e5e`
- SistemaControl-2.0.0-portable-windows.zip: `fecbfe43541809aed3ba4d9398c1d8b76a721751b780b8fbea0ec8cb6afdf947`
- SistemaControl-Movil-2.0.apk: `c6e0c467a98a9c97de74fae11fce2d69e0d53980a626514fa9ae662980d66ed6`
- SistemaControl-Movil-PRUEBA.apk: `54ef176431f7251775d9d873abaa94cd974f63e5107638bca2b000bbd38fec95`
- Video-Dueno-Control-de-licencias-PC-y-celular-Sistema-de-Control-2.0.mp4: `ad57446428179f9ae0364ec8429350ed6e2e602fc0f08fee4cd593a327be7996`
- Video-Instalacion-PC-desde-cero-usuario-final-Sistema-de-Control-2.0.mp4: `dcd64628f4ba66d91ac7d642f99f47a919da8bfdb413d79418ebb6d9e026d768`
- Video-Instalacion-celular-desde-cero-usuario-final-Sistema-de-Control-2.0.mp4: `3b453b8450b3f0dce022ff06af9a3b27086fd996eeca620f47223341af33d58b`
- Videos-Celular-Sistema-de-Control-2.0.zip: `80fc70516198eb4989083dfbdb6cf9f691ffc18122d229d5a913359d7c8b481b`
- Videos-Duenio-Sistema-de-Control-2.0.zip: `2bd5f3965e62e1e0efc174d37f63694ca0ad367b357dfa31d7928b2742bd5d39`
- Videos-PC-parte-1-Sistema-de-Control-2.0.zip: `bfd6cfce0bfeaecbc730475e220a282a4fedc51440ca8c8dfdc3421afb8def54`
- Videos-PC-parte-2-Sistema-de-Control-2.0.zip: `e1ab4fa86e5787d6c86fd4cd623865a06b512715300f2b9d2f1d716c85f265a8`
