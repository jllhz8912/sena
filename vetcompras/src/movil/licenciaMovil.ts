/**
 * Licencia por celular: mismo formato y misma clave pública que el PC
 * (server/licencia.ts). El código del celular sale del identificador del
 * dispositivo que entrega Android para esta app.
 */
import { verifyAsync } from '@noble/ed25519';
import { CLAVE_PUBLICA_LICENCIAS } from '../../server/clavePublica';

export const PRODUCTO_LICENCIA = 'sistema-control-2';
export const PREFIJO_LICENCIA = 'SC2-';

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

const desdeB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

/** La clave pública en PEM (SPKI) termina con los 32 bytes de la llave Ed25519. */
function llavePublica(pem = CLAVE_PUBLICA_LICENCIAS): Uint8Array {
  const der = desdeB64(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''));
  return der.slice(der.length - 32);
}

/** Código del celular: 16 caracteres en grupos de 4, igual que en el PC. */
export async function codigoEquipo(identificador: string): Promise<string> {
  const datos = new TextEncoder().encode('SC2|' + identificador);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', datos));
  const hex = Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16).toUpperCase();
  return hex.match(/.{4}/g)!.join('-');
}

const normalizar = (c: string) => String(c || '').toUpperCase().replace(/[^0-9A-F]/g, '');

export function leerClave(clave: string) {
  const limpia = String(clave || '').replace(/\s+/g, '');
  if (!limpia.startsWith(PREFIJO_LICENCIA)) throw new Error('La clave no es de Sistema de Control 2.0 (debe empezar por SC2-).');
  const [cuerpo, firma] = limpia.slice(PREFIJO_LICENCIA.length).split('.');
  if (!cuerpo || !firma) throw new Error('La clave está incompleta. Cópiela completa, sin cortar.');
  const firmado = desdeB64(cuerpo);
  let datos: any;
  try {
    datos = JSON.parse(new TextDecoder().decode(firmado));
  } catch {
    throw new Error('La clave está dañada. Pida a su proveedor que la envíe de nuevo.');
  }
  return { datos, firmado, firma: desdeB64(firma) };
}

/** Verifica firma, producto, equipo y vencimiento. Nunca lanza: devuelve el estado. */
export async function verificarLicencia(clave: string | null | undefined, equipo: string, hoy = new Date(), pem?: string): Promise<EstadoLicencia> {
  const base: EstadoLicencia = { activa: false, equipo };
  if (!clave) return { ...base, motivo: 'Este celular no tiene licencia activada.' };
  let leida;
  try {
    leida = leerClave(clave);
  } catch (e: any) {
    return { ...base, motivo: e.message };
  }
  const { datos, firmado, firma } = leida;
  const info: EstadoLicencia = { ...base, cliente: datos.c, documento: datos.d, edicion: datos.ed, emitida: datos.f, vence: datos.x || undefined, numero: datos.n };
  let valida = false;
  try {
    valida = await verifyAsync(firma, firmado, llavePublica(pem));
  } catch {
    valida = false;
  }
  if (!valida) return { ...info, motivo: 'La clave no es auténtica (firma inválida).' };
  if (datos.p !== PRODUCTO_LICENCIA) return { ...info, motivo: 'La clave es de otro producto.' };
  if (normalizar(datos.e) !== normalizar(equipo)) {
    return { ...info, motivo: `La clave fue emitida para otro equipo (${datos.e}). El código de este celular es ${equipo}.` };
  }
  if (datos.x) {
    const fin = new Date(datos.x + 'T23:59:59');
    if (!(fin.getTime() >= hoy.getTime())) return { ...info, motivo: `La licencia venció el ${datos.x}. Solicite la renovación a su proveedor.` };
  }
  return { ...info, activa: true };
}
