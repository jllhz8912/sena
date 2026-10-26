/**
 * Recuperación de acceso cuando se olvidó la contraseña de administrador.
 *
 * Solo se puede ejecutar en el PC donde está instalada la base de datos (quien
 * tiene acceso físico al equipo y a sus archivos). Crea un administrador de
 * emergencia o reactiva uno existente con una contraseña temporal, y deja
 * constancia en la bitácora.
 *
 *   npm run recuperar-acceso
 */
import '../server/silenciarAvisos';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { BaseDatosLocal } from '../server/basedatos';
import { Seguridad, cifrarClave } from '../server/seguridad';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(raiz, '.env'), quiet: true });

const bd = new BaseDatosLocal();
const seg = new Seguridad(bd);
// Temporal legible: 4 letras + 4 números (cumple la política de contraseñas)
const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const temporal =
  Array.from({ length: 4 }, () => letras[crypto.randomInt(letras.length)]).join('') +
  String(crypto.randomInt(1000, 10000));

const existe = bd.db.prepare("SELECT id FROM usuarios WHERE usuario = 'recuperacion'").get() as { id: string } | undefined;
if (existe) {
  bd.db
    .prepare("UPDATE usuarios SET clave_hash = ?, rol = 'administrador', activo = 1, debe_cambiar_clave = 1 WHERE id = ?")
    .run(cifrarClave(temporal), existe.id);
} else {
  seg.crearUsuario({ usuario: 'recuperacion', nombre: 'Recuperación de acceso', rol: 'administrador', clave: temporal }, true);
}
bd.auditar({ usuario: 'recuperacion', accion: 'Acceso de emergencia generado desde el PC servidor' });
bd.cerrar();

console.log('\n============================================================');
console.log('  ACCESO DE EMERGENCIA DE VETCOMPRAS');
console.log('  Usuario:              recuperacion');
console.log(`  Contraseña temporal:  ${temporal}`);
console.log('  Al ingresar se le pedirá crear una contraseña nueva.');
console.log('  Luego, en "Seguridad y Respaldos" restablezca la contraseña');
console.log('  del administrador habitual y desactive "recuperacion".');
console.log('============================================================\n');
