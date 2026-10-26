/**
 * ============================================================================
 * BASE DE DATOS LOCAL DE VETCOMPRAS (SQLite en el disco del PC)
 * ============================================================================
 *
 * Toda la información queda en un único archivo `vetcompras.db` dentro de la
 * carpeta de datos (por defecto `<carpeta de usuario>/VetCompras/datos`), que
 * está FUERA de la carpeta del programa. Así, reemplazar o actualizar el
 * código nunca toca la información.
 *
 * Actualizaciones sin pérdida de datos:
 *  - La versión del esquema se guarda en `PRAGMA user_version`.
 *  - Cada cambio de estructura se agrega como una nueva entrada en MIGRACIONES
 *    (nunca se modifica una migración ya publicada).
 *  - Antes de aplicar migraciones pendientes se crea un respaldo automático
 *    en `datos/respaldos/`, y las migraciones corren dentro de una transacción.
 */

import type { DatabaseSync as TipoDatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CATEGORIAS_DEFECTO,
  CENTROS_COSTO_DEFECTO,
  PROVEEDORES_DEFECTO,
  EMPRESA_DEFECTO,
} from '../src/data/defaults';

// Carga diferida de node:sqlite para que server/silenciarAvisos.ts actúe antes
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type DatabaseSync = TipoDatabaseSync;

export const COLECCIONES = ['documentos', 'ventas', 'proveedores', 'categorias', 'centrosCosto'] as const;
export type Coleccion = (typeof COLECCIONES)[number];

export function esColeccion(valor: string): valor is Coleccion {
  return (COLECCIONES as readonly string[]).includes(valor);
}

const RESPALDOS_A_CONSERVAR = 30;

type Registro = Record<string, any> & { id: string };

interface Migracion {
  version: number;
  descripcion: string;
  aplicar: (db: DatabaseSync) => void;
}

/**
 * Lista ordenada de migraciones. Para una mejora que cambie la estructura,
 * agregar al final { version: N+1, ... }. Los datos de los clientes se
 * transforman aquí, nunca se borran.
 */
const MIGRACIONES: Migracion[] = [
  {
    version: 1,
    descripcion: 'Estructura inicial: registros por colección, adjuntos y configuración',
    aplicar: (db) => {
      db.exec(`
        CREATE TABLE registros (
          coleccion      TEXT NOT NULL,
          id             TEXT NOT NULL,
          datos          TEXT NOT NULL,
          creado_en      TEXT NOT NULL,
          actualizado_en TEXT NOT NULL,
          PRIMARY KEY (coleccion, id)
        );
        CREATE TABLE adjuntos (
          documento_id  TEXT PRIMARY KEY,
          nombre        TEXT,
          tipo          TEXT,
          data_url      TEXT,
          contenido_xml TEXT
        );
        CREATE TABLE configuracion (
          clave TEXT PRIMARY KEY,
          valor TEXT NOT NULL
        );
      `);

      const ahora = new Date().toISOString();
      const insertar = db.prepare(
        'INSERT INTO registros (coleccion, id, datos, creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?)'
      );
      for (const c of CATEGORIAS_DEFECTO) insertar.run('categorias', c.id, JSON.stringify(c), ahora, ahora);
      for (const cc of CENTROS_COSTO_DEFECTO) insertar.run('centrosCosto', cc.id, JSON.stringify(cc), ahora, ahora);
      for (const p of PROVEEDORES_DEFECTO) insertar.run('proveedores', p.id, JSON.stringify(p), ahora, ahora);
      db.prepare('INSERT INTO configuracion (clave, valor) VALUES (?, ?)').run(
        'empresa',
        JSON.stringify(EMPRESA_DEFECTO)
      );
    },
  },
];

export const VERSION_ESQUEMA = MIGRACIONES[MIGRACIONES.length - 1].version;

export function carpetaDatosPorDefecto(): string {
  return process.env.VETCOMPRAS_DATOS || path.join(os.homedir(), 'VetCompras', 'datos');
}

function marcaDeTiempo(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export class BaseDatosLocal {
  readonly db: DatabaseSync;
  readonly carpetaDatos: string;
  readonly carpetaRespaldos: string;
  readonly rutaArchivo: string;
  /** Contador que cambia con cada escritura; los navegadores lo consultan para refrescarse. */
  private revision = 0;
  private readonly inicioServidor = Date.now().toString(36);

  constructor(carpetaDatos = carpetaDatosPorDefecto()) {
    this.carpetaDatos = carpetaDatos;
    this.carpetaRespaldos = path.join(carpetaDatos, 'respaldos');
    this.rutaArchivo = path.join(carpetaDatos, 'vetcompras.db');
    fs.mkdirSync(this.carpetaRespaldos, { recursive: true });

    const existia = fs.existsSync(this.rutaArchivo);
    this.db = new DatabaseSync(this.rutaArchivo);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

    this.migrar(existia);
    if (existia) this.respaldoDiario();
  }

  // ---------------------------------------------------------------- versión
  versionEsquema(): number {
    const fila = this.db.prepare('PRAGMA user_version').get() as { user_version: number };
    return fila.user_version;
  }

  private migrar(existia: boolean): void {
    const actual = this.versionEsquema();
    if (actual > VERSION_ESQUEMA) {
      throw new Error(
        `La base de datos (versión ${actual}) es más nueva que este programa (versión ${VERSION_ESQUEMA}). ` +
          'Instale la versión más reciente de VetCompras; no se modificó ningún dato.'
      );
    }
    const pendientes = MIGRACIONES.filter((m) => m.version > actual);
    if (pendientes.length === 0) return;

    if (existia && actual > 0) {
      this.crearRespaldo(`antes-de-actualizar-v${actual}-a-v${VERSION_ESQUEMA}`);
    }

    for (const m of pendientes) {
      this.transaccion(() => {
        m.aplicar(this.db);
        this.db.exec(`PRAGMA user_version = ${m.version}`);
      });
      console.log(`[VetCompras] Migración ${m.version} aplicada: ${m.descripcion}`);
    }
  }

  transaccion<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const resultado = fn();
      this.db.exec('COMMIT');
      return resultado;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  // -------------------------------------------------------------- respaldos
  /** Copia consistente de la base de datos (VACUUM INTO). Devuelve la ruta creada. */
  crearRespaldo(motivo = 'manual'): string {
    const nombre = `vetcompras-${marcaDeTiempo()}-${motivo.replace(/[^a-z0-9-]/gi, '_')}.db`;
    const destino = path.join(this.carpetaRespaldos, nombre);
    this.db.prepare('VACUUM INTO ?').run(destino);
    this.depurarRespaldos();
    return destino;
  }

  private respaldoDiario(): void {
    const hoy = new Date().toISOString().slice(0, 10);
    const yaExiste = this.listarRespaldos().some((r) => r.nombre.includes(hoy) && r.nombre.includes('diario'));
    if (!yaExiste) this.crearRespaldo('diario');
  }

  listarRespaldos(): { nombre: string; tamano: number; fecha: string }[] {
    return fs
      .readdirSync(this.carpetaRespaldos)
      .filter((f) => f.endsWith('.db'))
      .map((nombre) => {
        const st = fs.statSync(path.join(this.carpetaRespaldos, nombre));
        return { nombre, tamano: st.size, fecha: st.mtime.toISOString() };
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  private depurarRespaldos(): void {
    // Los respaldos previos a una actualización nunca se borran automáticamente.
    const rotativos = this.listarRespaldos().filter((r) => !r.nombre.includes('antes-de-actualizar'));
    for (const r of rotativos.slice(RESPALDOS_A_CONSERVAR)) {
      fs.rmSync(path.join(this.carpetaRespaldos, r.nombre), { force: true });
    }
  }

  // --------------------------------------------------------------- revisión
  obtenerRevision(): string {
    return `${this.inicioServidor}-${this.revision}`;
  }

  private tocar(): void {
    this.revision++;
  }

  // -------------------------------------------------------------- registros
  listar(coleccion: Coleccion): Registro[] {
    const filas = this.db
      .prepare('SELECT datos FROM registros WHERE coleccion = ?')
      .all(coleccion) as { datos: string }[];
    return filas.map((f) => JSON.parse(f.datos));
  }

  obtener(coleccion: Coleccion, id: string): Registro | undefined {
    const fila = this.db
      .prepare('SELECT datos FROM registros WHERE coleccion = ? AND id = ?')
      .get(coleccion, id) as { datos: string } | undefined;
    if (!fila) return undefined;
    const registro = JSON.parse(fila.datos);
    if (coleccion === 'documentos') this.adjuntarContenido(registro);
    return registro;
  }

  guardar(coleccion: Coleccion, registro: Registro): void {
    this.transaccion(() => this.guardarSinTransaccion(coleccion, registro));
    this.tocar();
  }

  private guardarSinTransaccion(coleccion: Coleccion, registro: Registro): void {
    if (!registro || typeof registro.id !== 'string' || !registro.id) {
      throw new Error('El registro debe tener un "id" de texto.');
    }
    const datos = coleccion === 'documentos' ? this.separarAdjunto(registro) : registro;
    const ahora = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO registros (coleccion, id, datos, creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (coleccion, id) DO UPDATE SET datos = excluded.datos, actualizado_en = excluded.actualizado_en`
      )
      .run(coleccion, registro.id, JSON.stringify(datos), ahora, ahora);
  }

  eliminar(coleccion: Coleccion, ids: string[]): void {
    this.transaccion(() => this.eliminarSinTransaccion(coleccion, ids));
    this.tocar();
  }

  private eliminarSinTransaccion(coleccion: Coleccion, ids: string[]): void {
    const borrar = this.db.prepare('DELETE FROM registros WHERE coleccion = ? AND id = ?');
    const borrarAdjunto = this.db.prepare('DELETE FROM adjuntos WHERE documento_id = ?');
    for (const id of ids) {
      borrar.run(coleccion, id);
      if (coleccion === 'documentos') borrarAdjunto.run(id);
    }
  }

  /** Guarda y elimina varios registros de forma atómica. */
  lote(coleccion: Coleccion, guardar: Registro[] = [], eliminar: string[] = []): void {
    this.transaccion(() => {
      for (const r of guardar) this.guardarSinTransaccion(coleccion, r);
      this.eliminarSinTransaccion(coleccion, eliminar);
    });
    this.tocar();
  }

  vaciar(coleccion: Coleccion): void {
    this.transaccion(() => {
      this.db.prepare('DELETE FROM registros WHERE coleccion = ?').run(coleccion);
      if (coleccion === 'documentos') this.db.exec('DELETE FROM adjuntos');
    });
    this.tocar();
  }

  /**
   * Los PDF/XML anexos se guardan en la tabla `adjuntos` para que el listado
   * general cargue rápido. Si un documento llega sin contenido de adjunto
   * (por ejemplo al editarlo desde el listado), se conserva el existente.
   */
  private separarAdjunto(documento: Registro): Registro {
    const adj = documento.archivoAdjunto;
    if (!adj) {
      this.db.prepare('DELETE FROM adjuntos WHERE documento_id = ?').run(documento.id);
      return documento;
    }
    const { dataUrl, contenidoXml, ...resto } = adj;
    if (dataUrl || contenidoXml) {
      this.db
        .prepare(
          `INSERT INTO adjuntos (documento_id, nombre, tipo, data_url, contenido_xml) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (documento_id) DO UPDATE SET nombre = excluded.nombre, tipo = excluded.tipo,
             data_url = excluded.data_url, contenido_xml = excluded.contenido_xml`
        )
        .run(documento.id, adj.nombre ?? null, adj.tipo ?? null, dataUrl ?? null, contenidoXml ?? null);
    }
    const existe = this.db.prepare('SELECT 1 AS si FROM adjuntos WHERE documento_id = ?').get(documento.id);
    return { ...documento, archivoAdjunto: { ...resto, tieneContenido: !!existe } };
  }

  private adjuntarContenido(documento: Registro): void {
    if (!documento.archivoAdjunto) return;
    const fila = this.db
      .prepare('SELECT data_url, contenido_xml FROM adjuntos WHERE documento_id = ?')
      .get(documento.id) as { data_url: string | null; contenido_xml: string | null } | undefined;
    if (fila?.data_url) documento.archivoAdjunto.dataUrl = fila.data_url;
    if (fila?.contenido_xml) documento.archivoAdjunto.contenidoXml = fila.contenido_xml;
  }

  // ---------------------------------------------------------- configuración
  obtenerConfig<T>(clave: string): T | undefined {
    const fila = this.db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(clave) as
      | { valor: string }
      | undefined;
    return fila ? (JSON.parse(fila.valor) as T) : undefined;
  }

  guardarConfig(clave: string, valor: unknown): void {
    this.db
      .prepare(
        'INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor'
      )
      .run(clave, JSON.stringify(valor));
    this.tocar();
  }

  // ---------------------------------------------------- respaldo completo JSON
  exportarTodo() {
    const respaldo: Record<string, unknown> = {
      version: '2.0',
      aplicacion: 'VetCompras Colombia',
      versionEsquema: this.versionEsquema(),
      fechaExportacion: new Date().toISOString(),
      empresa: this.obtenerConfig('empresa'),
    };
    for (const c of COLECCIONES) {
      respaldo[c] = c === 'documentos' ? this.listar(c).map((d) => this.obtener(c, d.id)) : this.listar(c);
    }
    return respaldo;
  }

  /**
   * Importa un respaldo JSON (de esta versión o del VetCompras anterior basado
   * en navegador). Combina por id: nunca borra registros que no vengan en el archivo.
   */
  importarTodo(datos: any): Record<string, number> {
    if (!datos || typeof datos !== 'object') throw new Error('El respaldo no tiene un formato válido.');
    this.crearRespaldo('antes-de-importar');
    const conteo: Record<string, number> = {};
    this.transaccion(() => {
      for (const c of COLECCIONES) {
        const lista = Array.isArray(datos[c]) ? datos[c].filter((r: any) => r && r.id) : [];
        for (const r of lista) this.guardarSinTransaccion(c, r);
        conteo[c] = lista.length;
      }
      if (datos.empresa && typeof datos.empresa === 'object') {
        this.db
          .prepare(
            'INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor'
          )
          .run('empresa', JSON.stringify(datos.empresa));
      }
    });
    this.tocar();
    return conteo;
  }

  cerrar(): void {
    this.db.close();
  }
}
