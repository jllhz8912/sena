/**
 * Empaqueta dist-demo/ en un solo HTML (sin <html>/<head>/<body>) para
 * publicarlo como página de demostración: node scripts/empaquetarDemo.mjs <salida.html>
 */
import fs from 'node:fs';
import path from 'node:path';

const salida = process.argv[2] || 'dist-demo/vetcompras-demo.html';
const assets = path.join('dist-demo', 'assets');
const archivos = fs.readdirSync(assets);
const css = archivos.filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(path.join(assets, f), 'utf8')).join('\n');
let js = archivos.filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(assets, f), 'utf8')).join('\n');

// Secuencias que el analizador HTML interpreta dentro de <script>
js = js.replaceAll('</script', '<\\/script').replaceAll('/<!--', '/<\\!--');

const html = `<title>VetCompras Demo</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap">
<style>
/* Demostración de VetCompras: misma interfaz del sistema instalado, servidor simulado en el navegador */
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
fs.writeFileSync(salida, html);
console.log(`Demostración empaquetada: ${salida} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
