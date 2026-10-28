/**
 * API REST local de VetCompras. Solo atiende al propio PC o a la red local
 * de la veterinaria; los datos nunca salen del equipo (salvo el PDF que se
 * envía a Gemini cuando el usuario pide extraer una factura en PDF).
 *
 * Toda ruta, salvo el inicio de sesión, exige un usuario autenticado. Las
 * operaciones que borran, restauran o cambian la configuración son solo
 * para administradores, y todo cambio queda en la bitácora de auditoría.
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import { spawn } from 'node:child_process';
import { BaseDatosLocal, esColeccion, VERSION_ESQUEMA, type Coleccion } from './basedatos';
import { recalcularInventario, sincronizarInventario } from './inventario';
import { extraerFacturaPdf, geminiConfigurado } from './gemini';
import {
  Seguridad,
  requiereSesion,
  soloAdministrador,
  leerCookie,
  fijarCookieSesion,
  ipDe,
  NOMBRE_COOKIE,
  MINUTOS_INACTIVIDAD,
} from './seguridad';
import { generarDatosDemostracion, CATEGORIAS_DEFECTO, CENTROS_COSTO_DEFECTO, PROVEEDORES_DEFECTO } from '../src/data/defaults';
import pkg from '../package.json';

type Manejador = (req: Request, res: Response) => unknown;

/** Envuelve un manejador para responder errores como JSON legible en español. */
const seguro =
  (fn: Manejador) =>
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (error: any) {
      const status = error?.status || 500;
      if (status >= 500) console.error(`[VetCompras] ${req.method} ${req.path}:`, error);
      res.status(status).json({ error: error?.message || 'Error interno del servidor local.' });
    }
  };

function coleccionDe(req: Request): Coleccion {
  const { coleccion } = req.params;
  if (!esColeccion(coleccion)) {
    throw Object.assign(new Error(`Colección desconocida: ${coleccion}`), { status: 404 });
  }
  return coleccion;
}

/** Catálogos que afectan la clasificación tributaria: solo administradores los modifican. */
const COLECCIONES_ADMIN: Coleccion[] = ['categorias', 'centrosCosto'];

function exigirAdminSi(req: Request, condicion: boolean) {
  if (condicion && req.usuario?.rol !== 'administrador') {
    throw Object.assign(new Error('Su usuario no tiene permiso para esta acción. Solicítela a un administrador.'), {
      status: 403,
    });
  }
}

/** Texto corto que identifica un registro en la bitácora. */
function describir(coleccion: Coleccion, r: any): string {
  if (!r) return '';
  const pesos = (v: unknown) => `$${Math.round(Number(v) || 0).toLocaleString('es-CO')}`;
  switch (coleccion) {
    case 'documentos':
      return `${r.prefijo || ''}${r.folio || ''} · ${r.proveedor?.razonSocial || ''} · ${pesos(r.total)}`;
    case 'ventas':
      return `${r.consecutivo || ''} · ${r.concepto || ''} · ${pesos(r.monto)}`;
    case 'proveedores':
      return `${r.nit || ''} · ${r.razonSocial || ''}`;
    case 'productos':
      return `${r.codigo ? r.codigo + ' · ' : ''}${r.nombre || ''}`;
    case 'fichasPrecio':
      return `${r.nombre || ''} · ${pesos(r.precioVenta)}`;
    case 'movimientosInventario':
      return `${r.tipo || ''} · ${r.cantidad ?? ''} und · ${r.referencia || r.motivo || ''}`;
    case 'observaciones':
      return `${r.tipo || ''} · ${r.modulo || ''} · ${String(r.descripcion || '').slice(0, 80)}`;
    default:
      return r.nombre || '';
  }
}

const NOMBRES_COLECCION: Record<Coleccion, string> = {
  documentos: 'compra/gasto',
  ventas: 'venta',
  proveedores: 'proveedor',
  categorias: 'categoría',
  centrosCosto: 'centro de costo',
  observaciones: 'observación de prueba',
  productos: 'producto de inventario',
  movimientosInventario: 'movimiento de inventario',
  fichasPrecio: 'ficha de precio',
};

export function crearApi(bd: BaseDatosLocal, opciones: { alApagar?: () => void } = {}) {
  const api = express.Router();
  const seg = new Seguridad(bd);

  const auditar = (req: Request, accion: string, extra: { coleccion?: string; registroId?: string; detalle?: string } = {}) =>
    bd.auditar({ usuario: req.usuario?.usuario || '(sistema)', accion, ip: ipDe(req), ...extra });

  // =================================================== rutas públicas (sesión)
  const exigirCabecera = (req: Request, res: Response, next: NextFunction) => {
    if (req.get('X-VetCompras') !== '1') return res.status(403).json({ error: 'Solicitud no permitida.' });
    next();
  };

  api.get(
    '/sesion',
    seguro((req, res) => {
      const usuario = seg.validarSesion(leerCookie(req, NOMBRE_COOKIE), false);
      const modoAcceso = seg.modoAcceso();
      const empresa = bd.obtenerConfig<Record<string, any>>('empresa') || {};
      res.json({
        usuario,
        modoAcceso,
        // Datos de marca para la pantalla de inicio (información pública del negocio)
        marca: {
          nombre: empresa.nombreComercial || empresa.razonSocial || 'Los Criollos Vet',
          slogan: empresa.slogan || '',
          logoUrl: empresa.logoUrl || '',
          colorPrimario: empresa.colorPrimario || '#9330b3',
        },
        requiereConfiguracion: modoAcceso === 'usuarios' && !seg.hayUsuarios(),
        minutosInactividad: MINUTOS_INACTIVIDAD,
        version: pkg.version,
        etapa: process.env.ETAPA === 'prueba' ? 'prueba' : 'produccion',
      });
    })
  );

  /** Primer uso: crea el administrador (solo si aún no existe ningún usuario). */
  api.post(
    '/sesion/configuracion-inicial',
    exigirCabecera,
    seguro((req, res) => {
      if (seg.hayUsuarios()) {
        return res.status(409).json({ error: 'El sistema ya fue configurado. Ingrese con su usuario.' });
      }
      const { usuario, nombre, clave, empresa } = req.body || {};
      seg.crearUsuario({ usuario, nombre, clave, rol: 'administrador' });
      if (empresa && typeof empresa === 'object') {
        // Se descartan los datos de ejemplo: solo se conservan colores y textos genéricos
        const actual = bd.obtenerConfig<Record<string, unknown>>('empresa') || {};
        const identidadVacia = {
          razonSocial: '', nombreComercial: '', nit: '', dv: '', direccion: '', ciudad: '', departamento: '',
          telefono: '', email: '', whatsapp: '', sitioWeb: '', slogan: '', logoUrl: '', matriculaMercantil: '',
          regimenTributario: '', resolucionLegal: '',
        };
        bd.guardarConfig('empresa', {
          ...actual,
          ...identidadVacia,
          razonSocial: String(empresa.razonSocial || '').slice(0, 200),
          nombreComercial: String(empresa.nombreComercial || empresa.razonSocial || '').slice(0, 200),
          nit: String(empresa.nit || '').replace(/[^\d-]/g, '').slice(0, 20),
        });
      }
      bd.auditar({ usuario: String(usuario).toLowerCase(), accion: 'Configuración inicial: administrador creado', ip: ipDe(req) });
      const sesion = seg.iniciarSesion(usuario, clave, ipDe(req));
      fijarCookieSesion(res, sesion.token);
      res.json({ usuario: sesion.usuario });
    })
  );

  api.post(
    '/sesion/ingresar-libre',
    exigirCabecera,
    seguro((req, res) => {
      const sesion = seg.ingresarSinClave(ipDe(req));
      fijarCookieSesion(res, sesion.token);
      res.json({ usuario: sesion.usuario });
    })
  );

  api.post(
    '/sesion/ingresar',
    exigirCabecera,
    seguro((req, res) => {
      const sesion = seg.iniciarSesion(req.body?.usuario, req.body?.clave, ipDe(req));
      fijarCookieSesion(res, sesion.token);
      res.json({ usuario: sesion.usuario });
    })
  );

  api.post(
    '/sesion/salir',
    exigirCabecera,
    seguro((req, res) => {
      const token = leerCookie(req, NOMBRE_COOKIE);
      const usuario = seg.validarSesion(token, false);
      if (token) seg.cerrarSesion(token);
      if (usuario) bd.auditar({ usuario: usuario.usuario, accion: 'Cierre de sesión', ip: ipDe(req) });
      fijarCookieSesion(res, null);
      res.json({ ok: true });
    })
  );

  // ======================================== desde aquí: requiere sesión válida
  api.use(requiereSesion(seg));

  api.put(
    '/configuracion/acceso',
    soloAdministrador,
    seguro((req, res) => {
      if (req.body?.modo === 'usuarios') {
        seg.activarUsuarios(req.usuario!, req.body?.usuario, req.body?.clave);
        auditar(req, 'Ingreso con usuario y contraseña ACTIVADO');
      } else {
        seg.activarAccesoLibre();
        auditar(req, 'Ingreso sin contraseña (pantalla de inicio) ACTIVADO');
      }
      res.json({ ok: true, modoAcceso: seg.modoAcceso() });
    })
  );

  api.post(
    '/sesion/cambiar-clave',
    seguro((req, res) => {
      seg.cambiarClavePropia(req.usuario!, req.body?.claveActual, req.body?.claveNueva, leerCookie(req, NOMBRE_COOKIE)!);
      auditar(req, 'Cambio de contraseña propia');
      res.json({ ok: true });
    })
  );

  api.get(
    '/estado',
    seguro((req, res) => {
      res.json({
        aplicacion: 'VetCompras',
        version: pkg.version,
        versionEsquema: VERSION_ESQUEMA,
        revision: bd.obtenerRevision(),
        carpetaDatos: req.usuario?.rol === 'administrador' ? bd.carpetaDatos : '',
        geminiConfigurado: geminiConfigurado(),
        etapa: process.env.ETAPA === 'prueba' ? 'prueba' : 'produccion',
        copias: bd.estadoCopias(),
      });
    })
  );

  // ------------------------------------------------------------- usuarios
  api.get(
    '/usuarios',
    soloAdministrador,
    seguro((_req, res) => {
      res.json(seg.listarUsuarios());
    })
  );

  api.post(
    '/usuarios',
    soloAdministrador,
    seguro((req, res) => {
      // Contraseña temporal: la persona debe cambiarla en su primer ingreso
      const id = seg.crearUsuario(req.body || {}, true);
      auditar(req, 'Usuario creado', { registroId: id, detalle: `${req.body?.usuario} (${req.body?.rol})` });
      res.json({ ok: true, id });
    })
  );

  api.put(
    '/usuarios/:id',
    soloAdministrador,
    seguro((req, res) => {
      seg.actualizarUsuario(req.params.id, req.body || {}, req.usuario!);
      auditar(req, 'Usuario modificado', { registroId: req.params.id, detalle: JSON.stringify(req.body || {}) });
      res.json({ ok: true });
    })
  );

  api.post(
    '/usuarios/:id/restablecer-clave',
    soloAdministrador,
    seguro((req, res) => {
      seg.restablecerClave(req.params.id, req.body?.claveTemporal);
      auditar(req, 'Contraseña restablecida por administrador', { registroId: req.params.id });
      res.json({ ok: true });
    })
  );

  // ------------------------------------------------------------- auditoría
  api.get(
    '/auditoria',
    soloAdministrador,
    seguro((req, res) => {
      res.json(bd.listarAuditoria(Number(req.query.limite) || 300, String(req.query.texto || '')));
    })
  );

  // ----------------------------------------------------------- configuración
  api.get(
    '/configuracion/empresa',
    seguro((_req, res) => {
      res.json(bd.obtenerConfig('empresa') ?? null);
    })
  );

  api.put(
    '/configuracion/empresa',
    soloAdministrador,
    seguro((req, res) => {
      bd.guardarConfig('empresa', req.body);
      auditar(req, 'Datos de la veterinaria modificados', { detalle: `${req.body?.razonSocial || ''} · NIT ${req.body?.nit || ''}` });
      res.json({ ok: true });
    })
  );

  // -------------------------------------------------------------- respaldos
  api.get(
    '/respaldos/estado',
    seguro((_req, res) => {
      res.json(bd.estadoCopias());
    })
  );

  api.put(
    '/respaldos/politica',
    soloAdministrador,
    seguro((req, res) => {
      bd.configurarRecordatorio(Number(req.body?.diasRecordatorio));
      auditar(req, 'Recordatorio de copias configurado', { detalle: `cada ${req.body?.diasRecordatorio} días` });
      res.json({ ok: true, ...bd.estadoCopias() });
    })
  );

  api.post(
    '/respaldos/cargar',
    soloAdministrador,
    express.raw({ type: 'application/octet-stream', limit: '1gb' }),
    seguro((req, res) => {
      const nombre = bd.cargarRespaldo(req.body as Buffer);
      auditar(req, 'Copia de seguridad cargada desde archivo', { detalle: `${req.get('X-Nombre-Archivo') || ''} → ${nombre}` });
      res.json({ ok: true, nombre });
    })
  );

  /** Abre la carpeta de respaldos en el Explorador de Windows (solo desde el propio PC). */
  api.post(
    '/respaldos/abrir-carpeta',
    soloAdministrador,
    seguro((req, res) => {
      const local = ['127.0.0.1', '::1'].includes(ipDe(req));
      if (process.platform === 'win32' && local) {
        spawn('explorer.exe', [bd.carpetaRespaldos], { detached: true, stdio: 'ignore' }).unref();
        return res.json({ ok: true, abierta: true, carpeta: bd.carpetaRespaldos });
      }
      res.json({ ok: true, abierta: false, carpeta: bd.carpetaRespaldos });
    })
  );

  api.post(
    '/respaldos',
    seguro((req, res) => {
      const ruta = bd.crearRespaldo('manual');
      bd.registrarCopiaSeguridad('copia manual');
      auditar(req, 'Respaldo manual creado', { detalle: ruta });
      res.json({ ok: true, ruta, externo: bd.ultimoRespaldoExterno });
    })
  );

  api.get(
    '/respaldos',
    soloAdministrador,
    seguro((_req, res) => {
      res.json({
        carpeta: bd.carpetaRespaldos,
        carpetaExterna: bd.carpetaRespaldoExterno() || '',
        ultimoRespaldoExterno: bd.ultimoRespaldoExterno,
        respaldos: bd.listarRespaldos(),
      });
    })
  );

  api.put(
    '/respaldos/externo',
    soloAdministrador,
    seguro((req, res) => {
      const carpeta = String(req.body?.carpeta || '').trim() || null;
      bd.configurarRespaldoExterno(carpeta);
      auditar(req, carpeta ? 'Carpeta de respaldo externo configurada' : 'Respaldo externo desactivado', { detalle: carpeta || '' });
      // Copia inmediata para confirmar que funciona
      if (carpeta) bd.crearRespaldo('manual');
      res.json({ ok: true, ultimoRespaldoExterno: bd.ultimoRespaldoExterno });
    })
  );

  api.get(
    '/respaldos/:nombre/descargar',
    soloAdministrador,
    seguro((req, res) => {
      const ruta = bd.rutaRespaldo(req.params.nombre);
      auditar(req, 'Respaldo descargado', { detalle: req.params.nombre });
      bd.registrarCopiaSeguridad('descarga del respaldo');
      res.download(ruta, req.params.nombre);
    })
  );

  api.post(
    '/respaldos/:nombre/restaurar',
    soloAdministrador,
    seguro((req, res) => {
      const quien = req.usuario!.usuario;
      const previo = bd.restaurarRespaldo(req.params.nombre);
      // La bitácora restaurada es la del respaldo: se deja constancia en ella
      bd.auditar({ usuario: quien, accion: 'Base de datos restaurada desde respaldo', detalle: `${req.params.nombre} (estado anterior guardado en ${previo})`, ip: ipDe(req) });
      fijarCookieSesion(res, null);
      res.json({ ok: true, respaldoPrevio: previo });
    })
  );

  api.get(
    '/respaldo-json',
    soloAdministrador,
    seguro((req, res) => {
      auditar(req, 'Exportación completa de datos (JSON)');
      res.json(bd.exportarTodo());
    })
  );

  api.post(
    '/respaldo-json',
    soloAdministrador,
    seguro((req, res) => {
      const importados = bd.importarTodo(req.body);
      auditar(req, 'Importación de respaldo JSON', { detalle: JSON.stringify(importados) });
      res.json({ ok: true, importados });
    })
  );

  // ------------------------------------------------- operaciones de limpieza
  // Solo administradores; toda operación destructiva deja primero un respaldo.
  api.post(
    '/mantenimiento/limpiar-documentos',
    soloAdministrador,
    seguro((req, res) => {
      bd.crearRespaldo('antes-de-limpiar-documentos');
      bd.vaciar('documentos');
      recalcularInventario(bd);
      auditar(req, 'Se borraron todas las compras y gastos');
      res.json({ ok: true });
    })
  );

  api.post(
    '/mantenimiento/limpiar-ventas',
    soloAdministrador,
    seguro((req, res) => {
      bd.crearRespaldo('antes-de-limpiar-ventas');
      bd.vaciar('ventas');
      recalcularInventario(bd);
      auditar(req, 'Se borraron todas las ventas');
      res.json({ ok: true });
    })
  );

  // Borrar todo para empezar de cero. Se conservan los datos de la veterinaria (nombre,
  // logo), la forma de ingreso, la bitácora y las copias de seguridad, para poder volver atrás.
  api.post(
    '/mantenimiento/borrar-todo',
    soloAdministrador,
    seguro((req, res) => {
      if (req.body?.confirmacion !== 'BORRAR') {
        return res.status(400).json({ error: 'Para borrar todo escriba la palabra BORRAR.' });
      }
      const respaldo = bd.crearRespaldo('antes-de-borrar-todo');
      for (const c of ['documentos', 'ventas', 'proveedores', 'categorias', 'centrosCosto', 'observaciones', 'productos', 'movimientosInventario', 'fichasPrecio'] as const) {
        bd.vaciar(c);
      }
      bd.lote('categorias', CATEGORIAS_DEFECTO);
      bd.lote('centrosCosto', CENTROS_COSTO_DEFECTO);
      auditar(req, 'Se borró toda la información (compras, ventas, proveedores y catálogos)', { detalle: respaldo });
      res.json({ ok: true, respaldo });
    })
  );

  api.post(
    '/mantenimiento/cargar-demo',
    soloAdministrador,
    seguro((req, res) => {
      bd.crearRespaldo('antes-de-cargar-demo');
      bd.vaciar('documentos');
      bd.lote('documentos', generarDatosDemostracion());
      recalcularInventario(bd);
      auditar(req, 'Datos de demostración cargados (reemplazan las compras)');
      res.json({ ok: true });
    })
  );

  api.post(
    '/mantenimiento/restablecer',
    soloAdministrador,
    seguro((req, res) => {
      bd.crearRespaldo('antes-de-restablecer');
      bd.vaciar('documentos');
      bd.vaciar('proveedores');
      bd.vaciar('categorias');
      bd.vaciar('centrosCosto');
      bd.lote('categorias', CATEGORIAS_DEFECTO);
      bd.lote('centrosCosto', CENTROS_COSTO_DEFECTO);
      bd.lote('proveedores', PROVEEDORES_DEFECTO);
      auditar(req, 'Sistema restablecido a valores por defecto');
      res.json({ ok: true });
    })
  );

  api.post(
    '/sistema/apagar',
    soloAdministrador,
    seguro((req, res) => {
      auditar(req, 'Servidor apagado desde la aplicación');
      res.json({ ok: true });
      setTimeout(() => opciones.alApagar?.(), 300);
    })
  );

  // ---------------------------------------------------------- extracción PDF
  api.post(
    '/extract-pdf',
    seguro(async (req, res) => {
      const { pdfBase64, mimeType = 'application/pdf', fileName = 'factura.pdf', categorias, centrosCosto } = req.body;
      if (!pdfBase64) {
        return res.status(400).json({ error: 'No se proporcionó el contenido base64 del archivo PDF.' });
      }
      const data = await extraerFacturaPdf({ pdfBase64, mimeType, categorias, centrosCosto });
      auditar(req, 'Factura enviada a Gemini para lectura', { detalle: String(fileName) });
      res.json({ success: true, data, fileName });
    })
  );

  // -------------------------------------------------------------- inventario
  api.post(
    '/inventario/recalcular',
    seguro((req, res) => {
      const r = recalcularInventario(bd);
      auditar(req, 'Inventario recalculado desde compras y ventas', { detalle: `${r.compras} compras · ${r.ventas} ventas` });
      res.json({ ok: true, ...r });
    })
  );

  // -------------------------------------------------------------- colecciones
  api.get(
    '/:coleccion',
    seguro((req, res) => {
      res.json(bd.listar(coleccionDe(req)));
    })
  );

  api.get(
    '/:coleccion/:id',
    seguro((req, res) => {
      const registro = bd.obtener(coleccionDe(req), req.params.id);
      if (!registro) return res.status(404).json({ error: 'Registro no encontrado.' });
      res.json(registro);
    })
  );

  api.put(
    '/:coleccion/:id',
    seguro((req, res) => {
      const coleccion = coleccionDe(req);
      exigirAdminSi(req, COLECCIONES_ADMIN.includes(coleccion));
      if (req.body?.id !== req.params.id) {
        return res.status(400).json({ error: 'El id del cuerpo no coincide con el de la URL.' });
      }
      const existia = bd.existe(coleccion, req.params.id);
      bd.guardar(coleccion, req.body);
      sincronizarInventario(bd, coleccion, [req.body]);
      auditar(req, `${existia ? 'Modificó' : 'Creó'} ${NOMBRES_COLECCION[coleccion]}`, {
        coleccion,
        registroId: req.params.id,
        detalle: describir(coleccion, req.body),
      });
      res.json({ ok: true });
    })
  );

  api.delete(
    '/:coleccion/:id',
    soloAdministrador,
    seguro((req, res) => {
      const coleccion = coleccionDe(req);
      const anterior = bd.obtener(coleccion, req.params.id);
      bd.eliminar(coleccion, [req.params.id]);
      sincronizarInventario(bd, coleccion, [], [req.params.id]);
      auditar(req, `Eliminó ${NOMBRES_COLECCION[coleccion]}`, {
        coleccion,
        registroId: req.params.id,
        detalle: describir(coleccion, anterior),
      });
      res.json({ ok: true });
    })
  );

  api.post(
    '/:coleccion/lote',
    seguro((req, res) => {
      const coleccion = coleccionDe(req);
      const { guardar = [], eliminar = [] } = req.body || {};
      if (!Array.isArray(guardar) || !Array.isArray(eliminar)) {
        return res.status(400).json({ error: '"guardar" y "eliminar" deben ser listas.' });
      }
      exigirAdminSi(req, eliminar.length > 0 || COLECCIONES_ADMIN.includes(coleccion));
      const eliminados = eliminar.map((id: string) => describir(coleccion, bd.obtener(coleccion, id)));
      bd.lote(coleccion, guardar, eliminar);
      sincronizarInventario(bd, coleccion, guardar, eliminar);
      if (guardar.length) {
        auditar(req, `Guardó ${guardar.length} registro(s) de ${NOMBRES_COLECCION[coleccion]} en lote`, {
          coleccion,
          detalle: guardar.slice(0, 20).map((r: any) => describir(coleccion, r)).join(' | '),
        });
      }
      if (eliminar.length) {
        auditar(req, `Eliminó ${eliminar.length} registro(s) de ${NOMBRES_COLECCION[coleccion]} en lote`, {
          coleccion,
          detalle: eliminados.slice(0, 20).join(' | '),
        });
      }
      res.json({ ok: true });
    })
  );

  return api;
}
