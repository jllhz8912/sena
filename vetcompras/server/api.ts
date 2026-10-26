/**
 * API REST local de VetCompras. Solo atiende al propio PC o a la red local
 * de la veterinaria; los datos nunca salen del equipo (salvo el PDF que se
 * envía a Gemini cuando el usuario pide extraer una factura en PDF).
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import { BaseDatosLocal, esColeccion, VERSION_ESQUEMA } from './basedatos';
import { extraerFacturaPdf, geminiConfigurado } from './gemini';
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
      console.error(`[VetCompras] ${req.method} ${req.path}:`, error);
      res.status(error?.status || 500).json({ error: error?.message || 'Error interno del servidor local.' });
    }
  };

function coleccionDe(req: Request) {
  const { coleccion } = req.params;
  if (!esColeccion(coleccion)) {
    throw Object.assign(new Error(`Colección desconocida: ${coleccion}`), { status: 404 });
  }
  return coleccion;
}

export function crearApi(bd: BaseDatosLocal) {
  const api = express.Router();

  api.get(
    '/estado',
    seguro((_req, res) => {
      res.json({
        aplicacion: 'VetCompras',
        version: pkg.version,
        versionEsquema: VERSION_ESQUEMA,
        revision: bd.obtenerRevision(),
        carpetaDatos: bd.carpetaDatos,
        geminiConfigurado: geminiConfigurado(),
      });
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
    seguro((req, res) => {
      bd.guardarConfig('empresa', req.body);
      res.json({ ok: true });
    })
  );

  // -------------------------------------------------------------- respaldos
  api.get(
    '/respaldos',
    seguro((_req, res) => {
      res.json({ carpeta: bd.carpetaRespaldos, respaldos: bd.listarRespaldos() });
    })
  );

  api.post(
    '/respaldos',
    seguro((_req, res) => {
      const ruta = bd.crearRespaldo('manual');
      res.json({ ok: true, ruta });
    })
  );

  api.get(
    '/respaldo-json',
    seguro((_req, res) => {
      res.json(bd.exportarTodo());
    })
  );

  api.post(
    '/respaldo-json',
    seguro((req, res) => {
      res.json({ ok: true, importados: bd.importarTodo(req.body) });
    })
  );

  // ------------------------------------------------- operaciones de limpieza
  // Toda operación destructiva deja primero un respaldo en disco.
  api.post(
    '/mantenimiento/limpiar-documentos',
    seguro((_req, res) => {
      bd.crearRespaldo('antes-de-limpiar-documentos');
      bd.vaciar('documentos');
      res.json({ ok: true });
    })
  );

  api.post(
    '/mantenimiento/limpiar-ventas',
    seguro((_req, res) => {
      bd.crearRespaldo('antes-de-limpiar-ventas');
      bd.vaciar('ventas');
      res.json({ ok: true });
    })
  );

  api.post(
    '/mantenimiento/cargar-demo',
    seguro((_req, res) => {
      bd.crearRespaldo('antes-de-cargar-demo');
      bd.vaciar('documentos');
      bd.lote('documentos', generarDatosDemostracion());
      res.json({ ok: true });
    })
  );

  api.post(
    '/mantenimiento/restablecer',
    seguro((_req, res) => {
      bd.crearRespaldo('antes-de-restablecer');
      bd.vaciar('documentos');
      bd.vaciar('proveedores');
      bd.vaciar('categorias');
      bd.vaciar('centrosCosto');
      bd.lote('categorias', CATEGORIAS_DEFECTO);
      bd.lote('centrosCosto', CENTROS_COSTO_DEFECTO);
      bd.lote('proveedores', PROVEEDORES_DEFECTO);
      res.json({ ok: true });
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
      res.json({ success: true, data, fileName });
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
      if (req.body?.id !== req.params.id) {
        return res.status(400).json({ error: 'El id del cuerpo no coincide con el de la URL.' });
      }
      bd.guardar(coleccionDe(req), req.body);
      res.json({ ok: true });
    })
  );

  api.delete(
    '/:coleccion/:id',
    seguro((req, res) => {
      bd.eliminar(coleccionDe(req), [req.params.id]);
      res.json({ ok: true });
    })
  );

  api.post(
    '/:coleccion/lote',
    seguro((req, res) => {
      const { guardar = [], eliminar = [] } = req.body || {};
      if (!Array.isArray(guardar) || !Array.isArray(eliminar)) {
        return res.status(400).json({ error: '"guardar" y "eliminar" deben ser listas.' });
      }
      bd.lote(coleccionDe(req), guardar, eliminar);
      res.json({ ok: true });
    })
  );

  return api;
}
