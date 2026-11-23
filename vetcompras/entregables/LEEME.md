# Entregables — Aplicativo Sistema de Control 2.0

## Para el usuario final (cliente)

| Archivo | Para qué |
|---|---|
| `SistemaControl-2.0.0-portable-windows.zip` | Instalador para Windows, versión 2.5 (con **Nómina y Empleados** e **Industria y Comercio (ICA)**). No necesita internet: abre en su propia ventana y guarda todo en el PC. Pide activar la licencia del equipo al abrir. Datos en `C:\Users\<usuario>\SistemaControl\datos`. |
| `Video-Instalacion-desde-cero-Sistema-de-Control-2.0.mp4` | Video de 3¾ min con voz en español latino y subtítulos: instalar, activar la licencia, marca de la empresa, PIN y primera copia. |
| `Guia-de-instalacion-Sistema-de-Control-2.0.pdf` | Guía de instalación paso a paso con pantallazos (14 páginas): instalar, activar, dejar listo y lista final. |
| `Manual-de-Usuario-Sistema-de-Control-2.0.pdf` | Manual detallado (88 páginas): instalación, licencia, marca, cada módulo, nómina (quincena, prima, cesantías, vacaciones, liquidación final y comprobante), ICA, inventario y capítulo del celular. |
| `Videos-PC-parte-1-Sistema-de-Control-2.0.zip` | Videos 01 a 09 con voz en español latino: instalación, activación, perfiles, ventas, compras y cuentas por pagar. |
| `Videos-PC-parte-2-Sistema-de-Control-2.0.zip` | Videos 10 a 18: reportes, inventario, catálogos, precios, dashboard, perfiles, **nómina (16 y 17)** e **ICA (18)**. |
| `Videos-Celular-Sistema-de-Control-2.0.zip` | Videos verticales 19 a 21: instalar en el celular, vender con fotos y compras por foto con inventario. |
| `Plantilla_Compras_SistemaControl.xlsx` | Plantilla Excel para Cargar Compras. |
| `SistemaControl-Movil-2.0.apk` | **App para celulares Android** (7 o superior), versión 2.5: nómina e ICA (solo Administración), inicio con mosaicos de colores, inventario (Saldo = Compras − Ventas ± Ajustes; ajusta solo Administración, consultan Ventas y Compras), caja con fotos de productos, ticket con autosuma y descuento, datos del cliente y recibo con membrete (Guardar / Cobrar con cambio), compras por foto de la factura o factura electrónica, y los demás módulos del PC; guarda todo en el celular, sin internet; copias diarias y manuales en *Documentos › SistemaControl*; "Copiar y compartir" a Drive/WhatsApp. Licencia por celular. |
| `SistemaControl-Movil-PRUEBA.apk` | **Versión de prueba del celular** (app aparte "SC Prueba"): no pide licencia, trae datos de ejemplo y permite hasta 60 ventas y 60 compras. Para revisarla o mostrarla; no reemplaza la definitiva. |
| `Guia-Sistema-de-Control-Movil-2.0.pdf` | Guía del celular (8 páginas con pantallazos): instalar el APK, activar, primer uso, copias, pasar datos PC ↔ celular, cambio de celular y problemas frecuentes. |
| `Video-Instalacion-celular-Sistema-de-Control-Movil.mp4` | Video vertical de 5½ min con voz en español latino: instalar en Android, activar, empresa, primera venta y copia de seguridad. |
| `Sistema-de-Control-2.0-DEMO.html` | Demostración para prospectos, sin licencia (máx. 60 ventas y 60 compras). |

## Para el dueño del software (uso interno)

| Archivo | Para qué |
|---|---|
| `Guia-facil-claves-y-permisos-Sistema-de-Control-2.0.pdf` | Paso a paso con pantallazos: hacer la licencia, activarla y dar permisos y PIN. |
| `Guia-del-vendedor-Licencias-Sistema-de-Control-2.0.pdf` | Licenciamiento, casos frecuentes y protección jurídica. |
| `Videos-Duenio-Sistema-de-Control-2.0.zip` | 2 videos: emitir licencias y entregar el sistema al cliente. |
| `Publicidad-Sistema-de-Control.zip` | Publicidad para redes: 5 publicaciones cuadradas, 2 historias, video promocional vertical de 32 s con voz y textos listos para Instagram, Facebook, TikTok y WhatsApp Business (cambie **[tu WhatsApp]** por su número). |

Herramienta: `../herramientas/Generador-de-licencias.html` — emite licencias para **PC o celular**, lleva el registro con vigentes, por vencer y vencidas, filtros, renovación por un año y exportación CSV (requiere `CLAVE-PRIVADA-Sistema-de-Control.json`, que **no** está en el repositorio).

Celular: abrir `SistemaControl-Movil-2.0.apk` en el teléfono → permitir esta fuente → Instalar → activar la licencia del celular (mismo Generador).

Instalación en PC: extraer el zip → doble clic en "Instalar en este PC.cmd" → "Sistema de Control" en el escritorio → activar la licencia.

SHA-256:
- Guia-Sistema-de-Control-Movil-2.0.pdf: `229de600435afafe4f6f2f70c564451e1e2084898974ad7636184180d289b428`
- Guia-de-instalacion-Sistema-de-Control-2.0.pdf: `447908db09cf595e80349e0d8d235cd14d3cb65776b1953c4debfa1ed3e8700a`
- Guia-del-vendedor-Licencias-Sistema-de-Control-2.0.pdf: `351a18b52083db1c5908ac24e5c03681409681d633551c6c12c9c505eb622e85`
- Guia-facil-claves-y-permisos-Sistema-de-Control-2.0.pdf: `7b4b971e81b1e926d00b6f7caabfcf1aa65b1ec133f08a20f2601b4f575456af`
- Manual-de-Usuario-Sistema-de-Control-2.0.pdf: `6a7eeaa8f7eda86bdac26e79d46397b7c459ce158efc777f60f6f7994d350705`
- Plantilla_Compras_SistemaControl.xlsx: `f4006949f7de2d16ab5668fe4e3ba264d29eeefab48b56b524c516b0b4e129f0`
- Publicidad-Sistema-de-Control.zip: `773ba8f8866e05afd85ff5bbadf564d812b4e2622ea41b6a04646871a5bde276`
- Sistema-de-Control-2.0-DEMO.html: `38818759d709514326c53704ca338d4a70087a41769a3d5dcfd48ed03c4f92d1`
- SistemaControl-2.0.0-portable-windows.zip: `52983bc14e539ffd576ad5b8a72fea7f56a6a358ebc3131e317549238b1ad00b`
- SistemaControl-Movil-2.0.apk: `3eeba3215a61dee282385cb25089db7c57eee6c86bb13786b67248522459d7aa`
- SistemaControl-Movil-PRUEBA.apk: `a57d0d5bfc8485279b9899d706fab262e123aae75d07d7de3461027399ddfa21`
- Video-Instalacion-celular-Sistema-de-Control-Movil.mp4: `d7616fe5ff5115d3cb983392bb54ec7b4eb8e390f0b8d5d045f14ba1ad6da5fc`
- Video-Instalacion-desde-cero-Sistema-de-Control-2.0.mp4: `0b59418cc1d9b79c2ad257d7bef65841c6fdfa841e19ad4cc64541e000f4b7bc`
- Videos-Celular-Sistema-de-Control-2.0.zip: `09563b2b2f359c1282187bb9b8ed8f2ea95c0481cf17acf79e9ce7c355e5beb2`
- Videos-Duenio-Sistema-de-Control-2.0.zip: `84cf0febd765e9001f97688e6e9f26459216a6a4b9bce814068971b2b419ec93`
- Videos-PC-parte-1-Sistema-de-Control-2.0.zip: `31bbf3ae9d545b75ad5c73e3c9dd52277b527967c493284c468fa052a69de1a8`
- Videos-PC-parte-2-Sistema-de-Control-2.0.zip: `b357be136927a81c087b550d07e57c8f63e15aeccc4f21f9419ace65bafb1e77`
