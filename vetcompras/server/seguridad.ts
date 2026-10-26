/**
 * Seguridad de VetCompras: usuarios, contraseñas, sesiones y permisos.
 *
 * - Contraseñas: scrypt con sal aleatoria (nunca se guarda la contraseña).
 * - Sesiones: token aleatorio en cookie HttpOnly + SameSite=Strict; en la base
 *   solo se guarda su hash SHA-256. Expiran por inactividad.
 * - Intentos fallidos: bloqueo temporal del usuario/equipo.
 * - Permisos: el servidor decide qué puede hacer cada rol.
 */

import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { BaseDatosLocal } from './basedatos';

export type Rol = 'administrador' | 'auxiliar';

export interface UsuarioSesion {
  id: string;
  usuario: string;
  nombre: string;
  rol: Rol;
  debeCambiarClave: boolean;
}

export const NOMBRE_COOKIE = 'vc_sesion';
export const MINUTOS_INACTIVIDAD = Number(process.env.MINUTOS_INACTIVIDAD) || 60;
const LONGITUD_MINIMA_CLAVE = 8;
const INTENTOS_MAXIMOS = 5;
const MINUTOS_BLOQUEO = 10;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: UsuarioSesion;
    }
  }
}

const error = (status: number, mensaje: string) => Object.assign(new Error(mensaje), { status });

// ------------------------------------------------------------- contraseñas
export function cifrarClave(clave: string): string {
  const sal = crypto.randomBytes(16);
  const hash = crypto.scryptSync(clave, sal, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$${sal.toString('base64')}$${hash.toString('base64')}`;
}

export function verificarClave(clave: string, guardado: string): boolean {
  const [alg, n, salB64, hashB64] = guardado.split('$');
  if (alg !== 'scrypt' || !salB64 || !hashB64) return false;
  const esperado = Buffer.from(hashB64, 'base64');
  const calculado = crypto.scryptSync(clave, Buffer.from(salB64, 'base64'), esperado.length, {
    N: Number(n),
    r: 8,
    p: 1,
  });
  return crypto.timingSafeEqual(esperado, calculado);
}

export function validarClave(clave: unknown): string {
  if (typeof clave !== 'string' || clave.length < LONGITUD_MINIMA_CLAVE) {
    throw error(400, `La contraseña debe tener al menos ${LONGITUD_MINIMA_CLAVE} caracteres.`);
  }
  if (!/[a-zA-Z]/.test(clave) || !/\d/.test(clave)) {
    throw error(400, 'La contraseña debe combinar letras y números.');
  }
  return clave;
}

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

// ---------------------------------------------------------------- servicio
interface FilaUsuario {
  id: string;
  usuario: string;
  nombre: string;
  rol: Rol;
  clave_hash: string;
  activo: number;
  debe_cambiar_clave: number;
  creado_en: string;
  ultimo_acceso: string | null;
}

const aSesion = (u: FilaUsuario): UsuarioSesion => ({
  id: u.id,
  usuario: u.usuario,
  nombre: u.nombre,
  rol: u.rol,
  debeCambiarClave: !!u.debe_cambiar_clave,
});

export class Seguridad {
  /** Intentos fallidos por usuario + equipo (en memoria: se reinicia con el programa). */
  private readonly intentos = new Map<string, { fallos: number; bloqueadoHasta: number }>();

  constructor(private readonly bd: BaseDatosLocal) {}

  private verificarBloqueo(clave: string): void {
    const reg = this.intentos.get(clave);
    if (reg && reg.bloqueadoHasta > Date.now()) {
      const minutos = Math.ceil((reg.bloqueadoHasta - Date.now()) / 60000);
      throw error(429, `Demasiados intentos fallidos. Espere ${minutos} minuto(s) e intente de nuevo.`);
    }
  }

  private registrarFallo(clave: string): void {
    const reg = this.intentos.get(clave) || { fallos: 0, bloqueadoHasta: 0 };
    reg.fallos++;
    if (reg.fallos >= INTENTOS_MAXIMOS) {
      reg.fallos = 0;
      reg.bloqueadoHasta = Date.now() + MINUTOS_BLOQUEO * 60000;
    }
    this.intentos.set(clave, reg);
  }

  private get db() {
    return this.bd.db;
  }

  hayUsuarios(): boolean {
    return !!this.db.prepare('SELECT 1 AS si FROM usuarios LIMIT 1').get();
  }

  listarUsuarios() {
    const filas = this.db
      .prepare('SELECT * FROM usuarios ORDER BY activo DESC, nombre')
      .all() as unknown as FilaUsuario[];
    return filas.map((u) => ({
      ...aSesion(u),
      activo: !!u.activo,
      creadoEn: u.creado_en,
      ultimoAcceso: u.ultimo_acceso,
    }));
  }

  crearUsuario(datos: { usuario: unknown; nombre: unknown; rol: unknown; clave: unknown }, debeCambiarClave = false) {
    const usuario = String(datos.usuario || '').trim().toLowerCase();
    const nombre = String(datos.nombre || '').trim();
    const rol = datos.rol === 'administrador' ? 'administrador' : 'auxiliar';
    if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) {
      throw error(400, 'El usuario debe tener entre 3 y 30 letras, números, punto o guion (sin espacios).');
    }
    if (!nombre) throw error(400, 'Escriba el nombre de la persona.');
    const clave = validarClave(datos.clave);
    if (this.db.prepare('SELECT 1 AS si FROM usuarios WHERE usuario = ?').get(usuario)) {
      throw error(409, `Ya existe el usuario "${usuario}".`);
    }
    const id = 'usr-' + crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO usuarios (id, usuario, nombre, rol, clave_hash, activo, debe_cambiar_clave, creado_en)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
      )
      .run(id, usuario, nombre, rol, cifrarClave(clave), debeCambiarClave ? 1 : 0, new Date().toISOString());
    return id;
  }

  actualizarUsuario(id: string, cambios: { nombre?: unknown; rol?: unknown; activo?: unknown }, quien: UsuarioSesion) {
    const actual = this.db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id) as unknown as FilaUsuario | undefined;
    if (!actual) throw error(404, 'Usuario no encontrado.');
    const rol = cambios.rol === undefined ? actual.rol : cambios.rol === 'administrador' ? 'administrador' : 'auxiliar';
    const activo = cambios.activo === undefined ? !!actual.activo : !!cambios.activo;
    const nombre = cambios.nombre === undefined ? actual.nombre : String(cambios.nombre).trim() || actual.nombre;

    if (id === quien.id && (!activo || rol !== 'administrador')) {
      throw error(400, 'No puede desactivarse ni quitarse el rol de administrador a sí mismo.');
    }
    if (actual.rol === 'administrador' && actual.activo && (rol !== 'administrador' || !activo)) {
      const otros = this.db
        .prepare("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'administrador' AND activo = 1 AND id <> ?")
        .get(id) as { n: number };
      if (otros.n === 0) throw error(400, 'Debe quedar al menos un administrador activo.');
    }
    this.db
      .prepare('UPDATE usuarios SET nombre = ?, rol = ?, activo = ? WHERE id = ?')
      .run(nombre, rol, activo ? 1 : 0, id);
    if (!activo) this.db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').run(id);
  }

  /** Un administrador asigna una contraseña temporal; el usuario deberá cambiarla al entrar. */
  restablecerClave(id: string, claveTemporal: unknown) {
    const clave = validarClave(claveTemporal);
    const r = this.db
      .prepare('UPDATE usuarios SET clave_hash = ?, debe_cambiar_clave = 1 WHERE id = ?')
      .run(cifrarClave(clave), id);
    if (r.changes === 0) throw error(404, 'Usuario no encontrado.');
    this.db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').run(id);
  }

  cambiarClavePropia(usuario: UsuarioSesion, claveActual: unknown, claveNueva: unknown, tokenActual: string) {
    const fila = this.db.prepare('SELECT * FROM usuarios WHERE id = ?').get(usuario.id) as unknown as FilaUsuario;
    if (!fila || !verificarClave(String(claveActual || ''), fila.clave_hash)) {
      throw error(400, 'La contraseña actual no es correcta.');
    }
    const nueva = validarClave(claveNueva);
    if (nueva === claveActual) throw error(400, 'La nueva contraseña debe ser diferente a la actual.');
    this.db
      .prepare('UPDATE usuarios SET clave_hash = ?, debe_cambiar_clave = 0 WHERE id = ?')
      .run(cifrarClave(nueva), usuario.id);
    // Cierra las demás sesiones abiertas de este usuario
    this.db
      .prepare('DELETE FROM sesiones WHERE usuario_id = ? AND token_hash <> ?')
      .run(usuario.id, hashToken(tokenActual));
  }

  iniciarSesion(usuarioTexto: unknown, clave: unknown, ip: string): { token: string; usuario: UsuarioSesion } {
    const usuario = String(usuarioTexto || '').trim().toLowerCase();
    const claveBloqueo = `${usuario}|${ip}`;
    this.verificarBloqueo(claveBloqueo);

    const fila = this.db
      .prepare('SELECT * FROM usuarios WHERE usuario = ?')
      .get(usuario) as unknown as FilaUsuario | undefined;
    // Se verifica igual con un hash ficticio para no revelar si el usuario existe
    const valido = verificarClave(String(clave || ''), fila?.clave_hash || FALSO_HASH) && !!fila;

    if (!valido || !fila) {
      this.registrarFallo(claveBloqueo);
      this.bd.auditar({ usuario: usuario || '(vacío)', accion: 'Intento de ingreso fallido', ip });
      throw error(401, 'Usuario o contraseña incorrectos.');
    }
    if (!fila.activo) {
      this.bd.auditar({ usuario, accion: 'Ingreso rechazado (usuario inactivo)', ip });
      throw error(403, 'Este usuario está desactivado. Consulte al administrador.');
    }

    this.intentos.delete(claveBloqueo);
    const token = crypto.randomBytes(32).toString('base64url');
    const ahora = new Date().toISOString();
    this.purgarSesionesVencidas();
    this.db
      .prepare('INSERT INTO sesiones (token_hash, usuario_id, creada_en, ultimo_uso, ip) VALUES (?, ?, ?, ?, ?)')
      .run(hashToken(token), fila.id, ahora, ahora, ip);
    this.db.prepare('UPDATE usuarios SET ultimo_acceso = ? WHERE id = ?').run(ahora, fila.id);
    this.bd.auditar({ usuario, accion: 'Inicio de sesión', ip });
    return { token, usuario: aSesion(fila) };
  }

  cerrarSesion(token: string): void {
    this.db.prepare('DELETE FROM sesiones WHERE token_hash = ?').run(hashToken(token));
  }

  /**
   * Devuelve el usuario de la sesión si sigue vigente. `renovar` = false para
   * las consultas automáticas de la pantalla, que no deben mantener viva una
   * sesión que nadie está usando.
   */
  validarSesion(token: string | undefined, renovar: boolean): UsuarioSesion | null {
    if (!token) return null;
    const fila = this.db
      .prepare(
        `SELECT u.*, s.ultimo_uso FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
         WHERE s.token_hash = ? AND u.activo = 1`
      )
      .get(hashToken(token)) as unknown as (FilaUsuario & { ultimo_uso: string }) | undefined;
    if (!fila) return null;
    if (Date.now() - new Date(fila.ultimo_uso).getTime() > MINUTOS_INACTIVIDAD * 60000) {
      this.cerrarSesion(token);
      return null;
    }
    if (renovar) {
      this.db.prepare('UPDATE sesiones SET ultimo_uso = ? WHERE token_hash = ?').run(new Date().toISOString(), hashToken(token));
    }
    return aSesion(fila);
  }

  private purgarSesionesVencidas(): void {
    const limite = new Date(Date.now() - MINUTOS_INACTIVIDAD * 60000).toISOString();
    this.db.prepare('DELETE FROM sesiones WHERE ultimo_uso < ?').run(limite);
  }
}

const FALSO_HASH = cifrarClave(crypto.randomBytes(16).toString('hex'));

// -------------------------------------------------------------- utilidades HTTP
export function leerCookie(req: Request, nombre: string): string | undefined {
  const cabecera = req.headers.cookie;
  if (!cabecera) return undefined;
  for (const parte of cabecera.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nombre) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export function fijarCookieSesion(res: Response, token: string | null): void {
  const base = `${NOMBRE_COOKIE}=${token ? encodeURIComponent(token) : ''}; HttpOnly; SameSite=Strict; Path=/`;
  res.setHeader('Set-Cookie', token ? base : `${base}; Max-Age=0`);
}

export function ipDe(req: Request): string {
  return (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
}

/** Exige sesión válida y protege contra peticiones de otros sitios (CSRF). */
export function requiereSesion(seg: Seguridad) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.get('X-VetCompras') !== '1') {
      return res.status(403).json({ error: 'Solicitud no permitida.' });
    }
    const usuario = seg.validarSesion(leerCookie(req, NOMBRE_COOKIE), req.get('X-Sondeo') !== '1');
    if (!usuario) {
      return res.status(401).json({ error: 'Su sesión terminó. Ingrese nuevamente.', sesionVencida: true });
    }
    if (usuario.debeCambiarClave && !req.path.startsWith('/sesion')) {
      return res.status(403).json({ error: 'Debe cambiar su contraseña antes de continuar.', debeCambiarClave: true });
    }
    req.usuario = usuario;
    next();
  };
}

export function soloAdministrador(req: Request, res: Response, next: NextFunction) {
  if (req.usuario?.rol !== 'administrador') {
    return res.status(403).json({ error: 'Su usuario no tiene permiso para esta acción. Solicítela a un administrador.' });
  }
  next();
}
