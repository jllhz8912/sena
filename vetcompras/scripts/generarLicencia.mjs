/**
 * Generador de licencias por consola (para el VENDEDOR, no se entrega al cliente).
 *
 *   node scripts/generarLicencia.mjs --clave RUTA\CLAVE-PRIVADA-Sistema-de-Control.json \
 *        --equipo 3F9A-21C0-7B44-E1D2 --cliente "Ferretería La 14 S.A.S." --documento 900123456 \
 *        [--edicion Estándar] [--vence 2027-12-31] [--numero L-2026-0001] [--salida licencia.lic]
 *
 * Imprime la clave (SC2-…) y, con --salida, la guarda en un archivo .lic.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), [])
);
const faltan = ['clave', 'equipo', 'cliente'].filter((k) => !args[k]);
if (faltan.length) {
  console.error('Faltan: --' + faltan.join(', --') + '\nVea el encabezado de este archivo.');
  process.exit(1);
}
const archivo = JSON.parse(fs.readFileSync(args.clave, 'utf8'));
const llave = crypto.createPrivateKey({ key: archivo.jwk || archivo, format: 'jwk' });
const equipo = String(args.equipo).toUpperCase().replace(/[^0-9A-F]/g, '').match(/.{1,4}/g)?.join('-') || '';
if (!/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(equipo)) {
  console.error('El código de equipo debe tener 16 caracteres (0-9, A-F), p. ej. 3F9A-21C0-7B44-E1D2.');
  process.exit(1);
}
if (args.vence && !/^\d{4}-\d{2}-\d{2}$/.test(args.vence)) {
  console.error('--vence debe ser AAAA-MM-DD.');
  process.exit(1);
}
const hoy = new Date();
const datos = {
  v: 1,
  p: 'sistema-control-2',
  c: args.cliente,
  ...(args.documento ? { d: args.documento } : {}),
  e: equipo,
  ed: args.edicion || 'Estándar',
  f: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`,
  ...(args.vence ? { x: args.vence } : {}),
  ...(args.numero ? { n: args.numero } : {}),
};
const cuerpo = Buffer.from(JSON.stringify(datos), 'utf8');
const clave = 'SC2-' + cuerpo.toString('base64url') + '.' + crypto.sign(null, cuerpo, llave).toString('base64url');
if (args.salida) fs.writeFileSync(args.salida, clave + '\n');
console.log(clave);
