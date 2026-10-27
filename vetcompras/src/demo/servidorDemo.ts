/**
 * Servidor simulado para la DEMOSTRACIÓN en línea de VetCompras.
 *
 * Intercepta las llamadas a /api/... y responde dentro del navegador con la
 * misma forma que server/api.ts, de modo que las pantallas son exactamente
 * las del sistema real. Los datos viven solo en el navegador de quien prueba
 * (localStorage) y se pueden reiniciar en cualquier momento.
 *
 * No se usa en la instalación real: ahí responde el servidor local con SQLite.
 */

import {
  CATEGORIAS_DEFECTO,
  CENTROS_COSTO_DEFECTO,
  PROVEEDORES_DEFECTO,
  EMPRESA_DEFECTO,
  VENTAS_DEFECTO,
  generarDatosDemostracion,
} from '../data/defaults';

type Coleccion = 'documentos' | 'ventas' | 'proveedores' | 'categorias' | 'centrosCosto';
const COLECCIONES: Coleccion[] = ['documentos', 'ventas', 'proveedores', 'categorias', 'centrosCosto'];
const NOMBRES: Record<Coleccion, string> = {
  documentos: 'compra/gasto',
  ventas: 'venta',
  proveedores: 'proveedor',
  categorias: 'categoría',
  centrosCosto: 'centro de costo',
};

interface UsuarioDemo {
  id: string;
  usuario: string;
  nombre: string;
  rol: 'administrador' | 'auxiliar';
  clave: string; // En la demostración no se cifra; el sistema real usa scrypt
  activo: boolean;
  debeCambiarClave: boolean;
  creadoEn: string;
  ultimoAcceso: string | null;
}

interface Datos {
  colecciones: Record<Coleccion, any[]>;
  empresa: any;
}

interface Estado extends Datos {
  usuarios: UsuarioDemo[];
  auditoria: { fecha: string; usuario: string; accion: string; detalle?: string; registroId?: string }[];
  respaldos: { nombre: string; fecha: string; tamano: number; datos: Datos }[];
  carpetaExterna: string;
  ultimaCopia?: { fecha: string; medio: string } | null;
  diasRecordatorio?: number;
  sesion: { usuarioId: string; ultimoUso: number } | null;
  revision: number;
}

export const CREDENCIALES_DEMO = [
  { rol: 'Administrador', usuario: 'demo', clave: 'Demo2026' },
  { rol: 'Auxiliar', usuario: 'auxiliar', clave: 'Auxiliar2026' },
];

const CLAVE_ALMACEN = 'vetcompras_demo_v4';
const MINUTOS_INACTIVIDAD = 60;
const clonar = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const ahoraIso = () => new Date().toISOString();

function marca(motivo: string) {
  return `vetcompras-${ahoraIso().replace(/[:.]/g, '-').slice(0, 19)}-${motivo}.db`;
}

function datosIniciales(): Datos {
  return {
    colecciones: {
      documentos: generarDatosDemostracion(),
      ventas: clonar(VENTAS_DEFECTO),
      proveedores: clonar(PROVEEDORES_DEFECTO),
      categorias: clonar(CATEGORIAS_DEFECTO),
      centrosCosto: clonar(CENTROS_COSTO_DEFECTO),
    },
    empresa: clonar(EMPRESA_DEFECTO),
  };
}

function estadoInicial(conUsuarios = true): Estado {
  const datos = datosIniciales();
  const hace = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
  const usuarios: UsuarioDemo[] = conUsuarios
    ? [
        { id: 'usr-demo', usuario: 'demo', nombre: 'Dra. Laura Gómez', rol: 'administrador', clave: 'Demo2026', activo: true, debeCambiarClave: false, creadoEn: hace(240), ultimoAcceso: hace(20) },
        { id: 'usr-aux', usuario: 'auxiliar', nombre: 'Andrés Ruiz', rol: 'auxiliar', clave: 'Auxiliar2026', activo: true, debeCambiarClave: false, creadoEn: hace(200), ultimoAcceso: hace(4) },
      ]
    : [];
  return {
    ...datos,
    usuarios,
    auditoria: conUsuarios
      ? [
          { fecha: hace(4), usuario: 'auxiliar', accion: 'Inicio de sesión' },
          { fecha: hace(3.9), usuario: 'auxiliar', accion: 'Creó venta', detalle: 'VNT-011 · Consulta general · $45.000' },
          { fecha: hace(3), usuario: 'auxiliar', accion: 'Intento de ingreso fallido' },
          { fecha: hace(20), usuario: 'demo', accion: 'Inicio de sesión' },
          { fecha: hace(19.5), usuario: 'demo', accion: 'Usuario creado', detalle: 'auxiliar (auxiliar)' },
          { fecha: hace(240), usuario: 'demo', accion: 'Configuración inicial: administrador creado' },
        ].sort((a, b) => b.fecha.localeCompare(a.fecha))
      : [],
    respaldos: conUsuarios ? [{ nombre: marca('diario'), fecha: hace(6), tamano: 2_400_000, datos: clonar(datos) }] : [],
    carpetaExterna: '',
    // Hace 9 días sin copia: así se ve el recordatorio en la demostración
    ultimaCopia: conUsuarios ? { fecha: hace(24 * 9), medio: 'copia manual' } : null,
    diasRecordatorio: 7,
    sesion: null,
    revision: 1,
  };
}

let estado: Estado = cargar();

function cargar(): Estado {
  try {
    const raw = localStorage.getItem(CLAVE_ALMACEN);
    if (raw) return JSON.parse(raw);
  } catch {
    // Sin almacenamiento: la demostración funciona en memoria
  }
  return estadoInicial();
}

function guardar() {
  estado.revision++;
  try {
    localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(estado));
  } catch {
    // Si el navegador no permite guardar, la demostración sigue en memoria
  }
}

/** Reinicia la demostración. Sin usuarios = muestra el asistente de primer uso. */
export function reiniciarDemo(conUsuarios = true) {
  estado = estadoInicial(conUsuarios);
  guardar();
}

export function contenidoRespaldo(nombre: string): string {
  const r = estado.respaldos.find((x) => x.nombre === nombre);
  return JSON.stringify(r?.datos ?? {}, null, 2);
}

// ----------------------------------------------------------------- utilidades
class ErrorHttp extends Error {
  constructor(public status: number, mensaje: string, public extra: Record<string, unknown> = {}) {
    super(mensaje);
  }
}

const usuarioPublico = (u: UsuarioDemo) => ({
  id: u.id,
  usuario: u.usuario,
  nombre: u.nombre,
  rol: u.rol,
  debeCambiarClave: u.debeCambiarClave,
});

function auditar(usuario: string, accion: string, detalle?: string, registroId?: string) {
  estado.auditoria.unshift({ fecha: ahoraIso(), usuario, accion, detalle, registroId });
  estado.auditoria = estado.auditoria.slice(0, 1000);
}

function validarClave(clave: unknown): string {
  if (typeof clave !== 'string' || clave.length < 8) throw new ErrorHttp(400, 'La contraseña debe tener al menos 8 caracteres.');
  if (!/[a-zA-Z]/.test(clave) || !/\d/.test(clave)) throw new ErrorHttp(400, 'La contraseña debe combinar letras y números.');
  return clave;
}

function usuarioSesion(renovar: boolean): UsuarioDemo | null {
  const s = estado.sesion;
  if (!s) return null;
  const u = estado.usuarios.find((x) => x.id === s.usuarioId && x.activo);
  if (!u || Date.now() - s.ultimoUso > MINUTOS_INACTIVIDAD * 60000) {
    estado.sesion = null;
    return null;
  }
  if (renovar) s.ultimoUso = Date.now();
  return u;
}

function describir(c: Coleccion, r: any): string {
  if (!r) return '';
  const pesos = (v: unknown) => `$${Math.round(Number(v) || 0).toLocaleString('es-CO')}`;
  if (c === 'documentos') return `${r.prefijo || ''}${r.folio || ''} · ${r.proveedor?.razonSocial || ''} · ${pesos(r.total)}`;
  if (c === 'ventas') return `${r.consecutivo || ''} · ${r.concepto || ''} · ${pesos(r.monto)}`;
  if (c === 'proveedores') return `${r.nit || ''} · ${r.razonSocial || ''}`;
  return r.nombre || '';
}

function crearRespaldo(motivo: string) {
  const datos: Datos = clonar({ colecciones: estado.colecciones, empresa: estado.empresa });
  const nombre = marca(motivo);
  estado.respaldos.unshift({ nombre, fecha: ahoraIso(), tamano: JSON.stringify(datos).length, datos });
  estado.respaldos = estado.respaldos.slice(0, 15);
  return nombre;
}

// ------------------------------------------------------------------- rutas
function atender(metodo: string, ruta: string, cuerpo: any, cabeceras: Headers, query: URLSearchParams): unknown {
  const esSondeo = cabeceras.get('X-Sondeo') === '1';
  if (metodo !== 'GET' && cabeceras.get('X-VetCompras') !== '1') throw new ErrorHttp(403, 'Solicitud no permitida.');

  // ---- públicas
  if (metodo === 'GET' && ruta === '/sesion') {
    const u = usuarioSesion(false);
    return { usuario: u ? usuarioPublico(u) : null, requiereConfiguracion: estado.usuarios.length === 0, minutosInactividad: MINUTOS_INACTIVIDAD, version: '2.1.0-demo' };
  }
  if (metodo === 'POST' && ruta === '/sesion/configuracion-inicial') {
    if (estado.usuarios.length) throw new ErrorHttp(409, 'El sistema ya fue configurado. Ingrese con su usuario.');
    const usuario = String(cuerpo.usuario || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) throw new ErrorHttp(400, 'El usuario debe tener entre 3 y 30 letras, números, punto o guion (sin espacios).');
    if (!String(cuerpo.nombre || '').trim()) throw new ErrorHttp(400, 'Escriba el nombre de la persona.');
    validarClave(cuerpo.clave);
    const u: UsuarioDemo = { id: 'usr-' + Date.now(), usuario, nombre: cuerpo.nombre.trim(), rol: 'administrador', clave: cuerpo.clave, activo: true, debeCambiarClave: false, creadoEn: ahoraIso(), ultimoAcceso: ahoraIso() };
    estado.usuarios.push(u);
    const e = cuerpo.empresa || {};
    estado.empresa = { ...estado.empresa, razonSocial: e.razonSocial || '', nombreComercial: e.nombreComercial || e.razonSocial || '', nit: e.nit || '', dv: '', direccion: '', ciudad: '', departamento: '', telefono: '', email: '', whatsapp: '', sitioWeb: '', slogan: '', logoUrl: '', resolucionLegal: '', regimenTributario: '' };
    estado.colecciones.documentos = [];
    estado.colecciones.ventas = [];
    auditar(usuario, 'Configuración inicial: administrador creado');
    auditar(usuario, 'Inicio de sesión');
    estado.sesion = { usuarioId: u.id, ultimoUso: Date.now() };
    return { usuario: usuarioPublico(u) };
  }
  if (metodo === 'POST' && ruta === '/sesion/ingresar') {
    const usuario = String(cuerpo.usuario || '').trim().toLowerCase();
    const u = estado.usuarios.find((x) => x.usuario === usuario);
    if (!u || u.clave !== cuerpo.clave) {
      auditar(usuario || '(vacío)', 'Intento de ingreso fallido');
      throw new ErrorHttp(401, 'Usuario o contraseña incorrectos.');
    }
    if (!u.activo) throw new ErrorHttp(403, 'Este usuario está desactivado. Consulte al administrador.');
    u.ultimoAcceso = ahoraIso();
    estado.sesion = { usuarioId: u.id, ultimoUso: Date.now() };
    auditar(usuario, 'Inicio de sesión');
    return { usuario: usuarioPublico(u) };
  }
  if (metodo === 'POST' && ruta === '/sesion/salir') {
    const u = usuarioSesion(false);
    if (u) auditar(u.usuario, 'Cierre de sesión');
    estado.sesion = null;
    return { ok: true };
  }

  // ---- requieren sesión
  const yo = usuarioSesion(!esSondeo);
  if (!yo) throw new ErrorHttp(401, 'Su sesión terminó. Ingrese nuevamente.', { sesionVencida: true });
  if (yo.debeCambiarClave && !ruta.startsWith('/sesion')) {
    throw new ErrorHttp(403, 'Debe cambiar su contraseña antes de continuar.', { debeCambiarClave: true });
  }
  const admin = () => {
    if (yo.rol !== 'administrador') throw new ErrorHttp(403, 'Su usuario no tiene permiso para esta acción. Solicítela a un administrador.');
  };

  if (metodo === 'POST' && ruta === '/sesion/cambiar-clave') {
    if (cuerpo.claveActual !== yo.clave) throw new ErrorHttp(400, 'La contraseña actual no es correcta.');
    const nueva = validarClave(cuerpo.claveNueva);
    if (nueva === yo.clave) throw new ErrorHttp(400, 'La nueva contraseña debe ser diferente a la actual.');
    yo.clave = nueva;
    yo.debeCambiarClave = false;
    auditar(yo.usuario, 'Cambio de contraseña propia');
    return { ok: true };
  }
  if (metodo === 'GET' && ruta === '/estado') {
    return { aplicacion: 'VetCompras', version: '2.1.0-demo', versionEsquema: 3, revision: String(estado.revision), carpetaDatos: yo.rol === 'administrador' ? 'C:\\Users\\Veterinaria\\VetCompras\\datos (demostración)' : '', geminiConfigurado: false };
  }

  // usuarios
  if (ruta === '/usuarios' && metodo === 'GET') {
    admin();
    return estado.usuarios.map((u) => ({ ...usuarioPublico(u), activo: u.activo, creadoEn: u.creadoEn, ultimoAcceso: u.ultimoAcceso }));
  }
  if (ruta === '/usuarios' && metodo === 'POST') {
    admin();
    const usuario = String(cuerpo.usuario || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) throw new ErrorHttp(400, 'El usuario debe tener entre 3 y 30 letras, números, punto o guion (sin espacios).');
    if (!String(cuerpo.nombre || '').trim()) throw new ErrorHttp(400, 'Escriba el nombre de la persona.');
    if (estado.usuarios.some((u) => u.usuario === usuario)) throw new ErrorHttp(409, `Ya existe el usuario "${usuario}".`);
    validarClave(cuerpo.clave);
    const id = 'usr-' + Date.now();
    estado.usuarios.push({ id, usuario, nombre: cuerpo.nombre.trim(), rol: cuerpo.rol === 'administrador' ? 'administrador' : 'auxiliar', clave: cuerpo.clave, activo: true, debeCambiarClave: true, creadoEn: ahoraIso(), ultimoAcceso: null });
    auditar(yo.usuario, 'Usuario creado', `${usuario} (${cuerpo.rol})`, id);
    return { ok: true, id };
  }
  let m = ruta.match(/^\/usuarios\/([^/]+)$/);
  if (m && metodo === 'PUT') {
    admin();
    const u = estado.usuarios.find((x) => x.id === decodeURIComponent(m![1]));
    if (!u) throw new ErrorHttp(404, 'Usuario no encontrado.');
    const rol = cuerpo.rol ?? u.rol;
    const activo = cuerpo.activo ?? u.activo;
    if (u.id === yo.id && (!activo || rol !== 'administrador')) throw new ErrorHttp(400, 'No puede desactivarse ni quitarse el rol de administrador a sí mismo.');
    if (u.rol === 'administrador' && (rol !== 'administrador' || !activo) && !estado.usuarios.some((x) => x.id !== u.id && x.rol === 'administrador' && x.activo)) {
      throw new ErrorHttp(400, 'Debe quedar al menos un administrador activo.');
    }
    Object.assign(u, { rol, activo, nombre: cuerpo.nombre ?? u.nombre });
    auditar(yo.usuario, 'Usuario modificado', JSON.stringify(cuerpo), u.id);
    return { ok: true };
  }
  m = ruta.match(/^\/usuarios\/([^/]+)\/restablecer-clave$/);
  if (m && metodo === 'POST') {
    admin();
    const u = estado.usuarios.find((x) => x.id === decodeURIComponent(m![1]));
    if (!u) throw new ErrorHttp(404, 'Usuario no encontrado.');
    u.clave = validarClave(cuerpo.claveTemporal);
    u.debeCambiarClave = true;
    auditar(yo.usuario, 'Contraseña restablecida por administrador', undefined, u.id);
    return { ok: true };
  }
  if (ruta === '/auditoria' && metodo === 'GET') {
    admin();
    const t = (query.get('texto') || '').toLowerCase();
    return estado.auditoria.filter((e) => !t || JSON.stringify(e).toLowerCase().includes(t)).slice(0, 500);
  }

  // configuración
  if (ruta === '/configuracion/empresa') {
    if (metodo === 'GET') return estado.empresa;
    admin();
    estado.empresa = cuerpo;
    auditar(yo.usuario, 'Datos de la veterinaria modificados', `${cuerpo?.razonSocial || ''} · NIT ${cuerpo?.nit || ''}`);
    return { ok: true };
  }

  // respaldos
  if (ruta === '/respaldos/estado' && metodo === 'GET') {
    const ultima = estado.ultimaCopia || null;
    return {
      ultima,
      diasSinCopia: ultima ? Math.floor((Date.now() - new Date(ultima.fecha).getTime()) / 86400000) : null,
      diasRecordatorio: estado.diasRecordatorio || 7,
    };
  }
  if (ruta === '/respaldos/politica' && metodo === 'PUT') {
    admin();
    estado.diasRecordatorio = Number(cuerpo.diasRecordatorio) || 7;
    auditar(yo.usuario, 'Recordatorio de copias configurado', `cada ${estado.diasRecordatorio} días`);
    return atender('GET', '/respaldos/estado', {}, cabeceras, query);
  }
  if (ruta === '/respaldos/cargar') {
    throw new ErrorHttp(400, 'En la demostración no se cargan archivos. En la instalación real se elige el archivo .db o .json y queda listo para restaurar.');
  }
  if (ruta === '/respaldos/abrir-carpeta') {
    return { abierta: false, carpeta: 'C:\\Users\\Veterinaria\\VetCompras\\datos\\respaldos (en la instalación real se abre el Explorador)' };
  }
  if (ruta === '/respaldos' && metodo === 'POST') {
    estado.ultimaCopia = { fecha: ahoraIso(), medio: 'copia manual' };
    const nombre = crearRespaldo('manual');
    auditar(yo.usuario, 'Respaldo manual creado', nombre);
    const externo = estado.carpetaExterna ? { fecha: ahoraIso(), ok: true, mensaje: `Copiado a ${estado.carpetaExterna} (simulado)` } : null;
    return { ok: true, ruta: `C:\\Users\\Veterinaria\\VetCompras\\datos\\respaldos\\${nombre}`, externo };
  }
  if (ruta === '/respaldos' && metodo === 'GET') {
    admin();
    return {
      carpeta: 'C:\\Users\\Veterinaria\\VetCompras\\datos\\respaldos',
      carpetaExterna: estado.carpetaExterna,
      ultimoRespaldoExterno: estado.carpetaExterna ? { fecha: estado.respaldos[0]?.fecha, ok: true, mensaje: `Copiado a ${estado.carpetaExterna} (simulado)` } : null,
      respaldos: estado.respaldos.map(({ nombre, fecha, tamano }) => ({ nombre, fecha, tamano })),
    };
  }
  if (ruta === '/respaldos/externo' && metodo === 'PUT') {
    admin();
    const carpeta = String(cuerpo.carpeta || '').trim();
    if (carpeta && !/^([a-zA-Z]:\\|\\\\|\/)/.test(carpeta)) throw new ErrorHttp(400, 'Escriba la ruta completa de la carpeta (ej. D:\\Respaldos).');
    estado.carpetaExterna = carpeta;
    auditar(yo.usuario, carpeta ? 'Carpeta de respaldo externo configurada' : 'Respaldo externo desactivado', carpeta);
    if (carpeta) crearRespaldo('manual');
    return { ok: true, ultimoRespaldoExterno: carpeta ? { fecha: ahoraIso(), ok: true, mensaje: `Copiado a ${carpeta} (simulado)` } : null };
  }
  m = ruta.match(/^\/respaldos\/([^/]+)\/restaurar$/);
  if (m && metodo === 'POST') {
    admin();
    const r = estado.respaldos.find((x) => x.nombre === decodeURIComponent(m![1]));
    if (!r) throw new ErrorHttp(404, 'El respaldo no existe.');
    const previo = crearRespaldo('antes-de-restaurar');
    estado.colecciones = clonar(r.datos.colecciones);
    estado.empresa = clonar(r.datos.empresa);
    auditar(yo.usuario, 'Base de datos restaurada desde respaldo', `${r.nombre} (estado anterior guardado en ${previo})`);
    estado.sesion = null;
    return { ok: true, respaldoPrevio: previo };
  }
  if (ruta === '/respaldo-json') {
    admin();
    if (metodo === 'GET') {
      auditar(yo.usuario, 'Exportación completa de datos (JSON)');
      return { version: '2.0', aplicacion: 'VetCompras Colombia', fechaExportacion: ahoraIso(), empresa: estado.empresa, ...estado.colecciones };
    }
    crearRespaldo('antes-de-importar');
    const conteo: Record<string, number> = {};
    for (const c of COLECCIONES) {
      const lista = Array.isArray(cuerpo[c]) ? cuerpo[c].filter((r: any) => r?.id) : [];
      for (const r of lista) upsert(c, r);
      conteo[c] = lista.length;
    }
    if (cuerpo.empresa) estado.empresa = cuerpo.empresa;
    auditar(yo.usuario, 'Importación de respaldo JSON', JSON.stringify(conteo));
    return { ok: true, importados: conteo };
  }

  // mantenimiento
  if (ruta.startsWith('/mantenimiento/') && metodo === 'POST') {
    admin();
    const accion = ruta.split('/')[2];
    crearRespaldo(`antes-de-${accion}`);
    if (accion === 'limpiar-documentos') {
      estado.colecciones.documentos = [];
      auditar(yo.usuario, 'Se borraron todas las compras y gastos');
    } else if (accion === 'limpiar-ventas') {
      estado.colecciones.ventas = [];
      auditar(yo.usuario, 'Se borraron todas las ventas');
    } else if (accion === 'cargar-demo') {
      estado.colecciones.documentos = generarDatosDemostracion();
      auditar(yo.usuario, 'Datos de demostración cargados (reemplazan las compras)');
    } else if (accion === 'restablecer') {
      const d = datosIniciales();
      Object.assign(estado.colecciones, { documentos: [], proveedores: d.colecciones.proveedores, categorias: d.colecciones.categorias, centrosCosto: d.colecciones.centrosCosto });
      auditar(yo.usuario, 'Sistema restablecido a valores por defecto');
    }
    return { ok: true };
  }
  if (ruta === '/sistema/apagar' && metodo === 'POST') {
    admin();
    auditar(yo.usuario, 'Servidor apagado desde la aplicación (simulado)');
    return { ok: true };
  }
  if (ruta === '/extract-pdf') {
    throw new ErrorHttp(503, 'En esta demostración no está activa la lectura de PDF con IA (en la instalación real requiere la clave de Gemini). Pruebe con el XML de la DIAN o el registro manual.');
  }

  // colecciones
  m = ruta.match(/^\/(\w+)(?:\/([^/]+))?$/);
  const c = m?.[1] as Coleccion;
  if (!m || !COLECCIONES.includes(c)) throw new ErrorHttp(404, `Ruta desconocida: ${ruta}`);
  const id = m[2] ? decodeURIComponent(m[2]) : undefined;
  const lista = estado.colecciones[c];

  if (id === 'lote' && metodo === 'POST') {
    const { guardar: g = [], eliminar: e = [] } = cuerpo || {};
    if (e.length || c === 'categorias' || c === 'centrosCosto') admin();
    for (const r of g) upsert(c, r);
    const eliminados = e.map((x: string) => describir(c, lista.find((r) => r.id === x)));
    estado.colecciones[c] = estado.colecciones[c].filter((r) => !e.includes(r.id));
    if (g.length) auditar(yo.usuario, `Guardó ${g.length} registro(s) de ${NOMBRES[c]} en lote`, g.slice(0, 20).map((r: any) => describir(c, r)).join(' | '));
    if (e.length) auditar(yo.usuario, `Eliminó ${e.length} registro(s) de ${NOMBRES[c]} en lote`, eliminados.join(' | '));
    return { ok: true };
  }
  if (!id && metodo === 'GET') return clonar(lista);
  if (id && metodo === 'GET') {
    const r = lista.find((x) => x.id === id);
    if (!r) throw new ErrorHttp(404, 'Registro no encontrado.');
    return clonar(r);
  }
  if (id && metodo === 'PUT') {
    if (c === 'categorias' || c === 'centrosCosto') admin();
    const existia = lista.some((x) => x.id === id);
    upsert(c, cuerpo);
    auditar(yo.usuario, `${existia ? 'Modificó' : 'Creó'} ${NOMBRES[c]}`, describir(c, cuerpo), id);
    return { ok: true };
  }
  if (id && metodo === 'DELETE') {
    admin();
    const anterior = lista.find((x) => x.id === id);
    estado.colecciones[c] = lista.filter((x) => x.id !== id);
    auditar(yo.usuario, `Eliminó ${NOMBRES[c]}`, describir(c, anterior), id);
    return { ok: true };
  }
  throw new ErrorHttp(404, `Ruta desconocida: ${metodo} ${ruta}`);
}

function upsert(c: Coleccion, r: any) {
  const lista = estado.colecciones[c];
  const i = lista.findIndex((x) => x.id === r.id);
  if (i >= 0) lista[i] = clonar(r);
  else lista.push(clonar(r));
}

/** Reemplaza fetch para que las llamadas a /api las responda la demostración. */
export function instalarServidorDemo() {
  const fetchOriginal = window.fetch.bind(window);
  window.fetch = async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url, location.href);
    if (!url.pathname.startsWith('/api/')) return fetchOriginal(entrada, init);

    const metodo = (init?.method || 'GET').toUpperCase();
    const cabeceras = new Headers(init?.headers);
    let cuerpo: any = {};
    try {
      cuerpo = init?.body ? JSON.parse(String(init.body)) : {};
    } catch {
      cuerpo = {};
    }
    // Pequeña espera para que la interfaz se comporte como con un servidor real
    await new Promise((r) => setTimeout(r, 60));
    try {
      const datos = atender(metodo, url.pathname.slice(4), cuerpo, cabeceras, url.searchParams);
      if (metodo !== 'GET' || url.pathname === '/api/sesion') guardar();
      return new Response(JSON.stringify(datos ?? null), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (err: any) {
      const status = err instanceof ErrorHttp ? err.status : 500;
      if (metodo !== 'GET') guardar();
      return new Response(JSON.stringify({ error: err?.message || 'Error en la demostración.', ...(err?.extra || {}) }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}
