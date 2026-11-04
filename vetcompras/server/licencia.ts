/**
 * Licencia de uso por equipo (Sistema de Control 2.0).
 *
 * Cada instalación calcula un "código de equipo" a partir del identificador del
 * sistema operativo (en Windows, el MachineGuid del registro). El vendedor firma
 * con su clave privada Ed25519 una licencia que incluye ese código; el programa
 * solo trae la clave pública, así que puede verificar licencias pero no crearlas.
 * Una licencia copiada a otro PC no sirve porque el código de equipo no coincide.
 *
 * Formato de la clave:  SC2-<datos en base64url>.<firma en base64url>
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { CLAVE_PUBLICA_LICENCIAS } from './clavePublica';

export const PRODUCTO_LICENCIA = 'sistema-control-2';
export const PREFIJO_LICENCIA = 'SC2-';

export interface DatosLicencia {
  /** Versión del formato */
  v: 1;
  /** Producto: siempre sistema-control-2 */
  p: string;
  /** Cliente (nombre o razón social) */
  c: string;
  /** Documento del cliente (NIT o cédula) */
  d?: string;
  /** Código de equipo autorizado */
  e: string;
  /** Edición o plan (p. ej. "Estándar") */
  ed?: string;
  /** Fecha de emisión (AAAA-MM-DD) */
  f: string;
  /** Fecha de vencimiento (AAAA-MM-DD) o vacío si es perpetua */
  x?: string;
  /** Número de licencia que lleva el vendedor */
  n?: string;
}

export interface EstadoLicencia {
  activa: boolean;
  equipo: string;
  motivo?: string;
  cliente?: string;
  documento?: string;
  edicion?: string;
  emitida?: string;
  vence?: string;
  numero?: string;
}

const b64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const desdeB64url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/** Identificador del sistema operativo de este PC (no cambia al renombrar el equipo). */
export function identificadorSistema(): string {
  try {
    if (process.platform === 'win32') {
      const salida = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 5000,
      });
      const m = salida.match(/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/);
      if (m) return 'win:' + m[1].toLowerCase();
    } else if (process.platform === 'darwin') {
      const salida = execFileSync('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], { encoding: 'utf8', timeout: 5000 });
      const m = salida.match(/"IOPlatformUUID" = "([^"]+)"/);
      if (m) return 'mac:' + m[1].toLowerCase();
    } else {
      for (const ruta of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
        if (fs.existsSync(ruta)) {
          const id = fs.readFileSync(ruta, 'utf8').trim();
          if (id) return 'linux:' + id.toLowerCase();
        }
      }
    }
  } catch {
    /* se usa el respaldo de abajo */
  }
  const mac = Object.values(os.networkInterfaces())
    .flat()
    .find((i) => i && !i.internal && i.mac && i.mac !== '00:00:00:00:00:00')?.mac;
  return 'otro:' + os.hostname().toLowerCase() + '|' + (mac || '');
}

/** Código de equipo legible: 16 caracteres en grupos de 4 (p. ej. 3F9A-21C0-7B44-E1D2). */
export function codigoEquipo(identificador = identificadorSistema()): string {
  const h = crypto.createHash('sha256').update('SC2|' + identificador).digest('hex').slice(0, 16).toUpperCase();
  return h.match(/.{4}/g)!.join('-');
}

const normalizarCodigo = (c: string) => String(c || '').toUpperCase().replace(/[^0-9A-F]/g, '');

/** Lee la clave sin verificarla (para mostrar errores claros). */
export function leerClave(clave: string): { datos: DatosLicencia; firmado: Buffer; firma: Buffer } {
  const limpia = String(clave || '').replace(/\s+/g, '');
  if (!limpia.startsWith(PREFIJO_LICENCIA)) throw new Error('La clave no es de Sistema de Control 2.0 (debe empezar por SC2-).');
  const [cuerpo, firma] = limpia.slice(PREFIJO_LICENCIA.length).split('.');
  if (!cuerpo || !firma) throw new Error('La clave está incompleta. Cópiela completa, sin cortar.');
  const firmado = desdeB64url(cuerpo);
  let datos: DatosLicencia;
  try {
    datos = JSON.parse(firmado.toString('utf8'));
  } catch {
    throw new Error('La clave está dañada. Pida a su proveedor que la envíe de nuevo.');
  }
  return { datos, firmado, firma: desdeB64url(firma) };
}

/** Verifica firma, producto, equipo y vencimiento. Nunca lanza: devuelve el estado. */
export function verificarLicencia(clave: string | undefined, equipo: string, hoy = new Date(), clavePublica = CLAVE_PUBLICA_LICENCIAS): EstadoLicencia {
  const base: EstadoLicencia = { activa: false, equipo };
  if (!clave) return { ...base, motivo: 'Este equipo no tiene licencia activada.' };
  let leida;
  try {
    leida = leerClave(clave);
  } catch (e: any) {
    return { ...base, motivo: e.message };
  }
  const { datos, firmado, firma } = leida;
  const info: EstadoLicencia = {
    ...base,
    cliente: datos.c,
    documento: datos.d,
    edicion: datos.ed,
    emitida: datos.f,
    vence: datos.x || undefined,
    numero: datos.n,
  };
  let firmaValida = false;
  try {
    firmaValida = crypto.verify(null, firmado, crypto.createPublicKey(clavePublica), firma);
  } catch {
    firmaValida = false;
  }
  if (!firmaValida) return { ...info, motivo: 'La clave no es auténtica (firma inválida).' };
  if (datos.p !== PRODUCTO_LICENCIA) return { ...info, motivo: 'La clave es de otro producto.' };
  if (normalizarCodigo(datos.e) !== normalizarCodigo(equipo)) {
    return { ...info, motivo: `La clave fue emitida para otro equipo (${datos.e}). El código de este equipo es ${equipo}.` };
  }
  if (datos.x) {
    const fin = new Date(datos.x + 'T23:59:59');
    if (!(fin.getTime() >= hoy.getTime())) return { ...info, motivo: `La licencia venció el ${datos.x}. Solicite la renovación a su proveedor.` };
  }
  return { ...info, activa: true };
}

/** Solo para pruebas y para el generador por consola: firma unos datos con la clave privada. */
export function firmarLicencia(datos: DatosLicencia, clavePrivada: crypto.KeyObject | string | crypto.JsonWebKeyInput): string {
  const llave = clavePrivada instanceof crypto.KeyObject ? clavePrivada : crypto.createPrivateKey(clavePrivada as any);
  const cuerpo = Buffer.from(JSON.stringify(datos), 'utf8');
  const firma = crypto.sign(null, cuerpo, llave);
  return PREFIJO_LICENCIA + b64url(cuerpo) + '.' + b64url(firma);
}
