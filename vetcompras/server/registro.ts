// Si se define VETCOMPRAS_LOG, todo lo que el servidor escribe en consola se guarda
// también en ese archivo (el lanzador de Windows ejecuta el servidor sin ventana).
import fs from 'node:fs';

const archivo = process.env.VETCOMPRAS_LOG;
if (archivo) {
  for (const nivel of ['log', 'warn', 'error'] as const) {
    const original = console[nivel].bind(console);
    console[nivel] = (...args: unknown[]) => {
      original(...args);
      try {
        const texto = args.map((a) => (a instanceof Error ? a.stack || a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
        fs.appendFileSync(archivo, `${new Date().toISOString()} [${nivel}] ${texto}\n`);
      } catch {
        // Sin acceso al archivo de registro: se ignora
      }
    };
  }
}
