/**
 * Empaqueta dist-demo/ en un solo HTML para la demostración:
 *   node scripts/empaquetarDemo.mjs <salida.html>              fragmento para publicar como página
 *   node scripts/empaquetarDemo.mjs <salida.html> --documento  documento completo para descargar y
 *                                                              abrir con doble clic en Windows
 * Ambos declaran UTF-8: sin eso, un archivo abierto desde el disco en Windows se lee como
 * windows-1252, las tildes del código se dañan y la página queda en blanco.
 */
import fs from 'node:fs';
import path from 'node:path';

const argumentos = process.argv.slice(2);
const documento = argumentos.includes('--documento');
const salida = argumentos.find((a) => !a.startsWith('--')) || 'dist-demo/sistema-control-demo.html';
const assets = path.join('dist-demo', 'assets');
const archivos = fs.readdirSync(assets);
const css = archivos.filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(path.join(assets, f), 'utf8')).join('\n');
let js = archivos.filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(assets, f), 'utf8')).join('\n');

// Secuencias que el analizador HTML interpreta dentro de <script>
js = js.replaceAll('</script', '<\\/script').replaceAll('/<!--', '/<\\!--');

// Todo carácter no ASCII del código va escapado: la página funciona aunque se lea con otra codificación
js = js.replace(/[^\x00-\x7f]/g, (c) => {
  const n = c.charCodeAt(0);
  return '\\u' + n.toString(16).padStart(4, '0');
});

const contenido = `<meta charset="utf-8">
<title>Sistema de Control 2.0 - Demostración</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap">
<style>
/* Demostración de Sistema de Control 2.0: misma interfaz del sistema instalado, servidor simulado en el navegador */
:root { --fondo: #f8fafc; --texto: #0f172a; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --fondo: #020617; --texto: #f1f5f9; color-scheme: dark; } }
:root[data-theme="dark"] { --fondo: #020617; --texto: #f1f5f9; color-scheme: dark; }
html, body { height: 100%; }
body { background: var(--fondo); color: var(--texto); font-family: Inter, ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
#root { height: 100%; }
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;
const html = documento
  ? `<!doctype html>
<html lang="es">
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
${contenido.replace('</style>\n', '</style>\n</head>\n<body>\n')}</body>
</html>
`
  : contenido;
fs.writeFileSync(salida, html);
console.log(`Demostración empaquetada: ${salida} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
