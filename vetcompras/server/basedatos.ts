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

export const COLECCIONES = ['documentos', 'ventas', 'proveedores', 'categorias', 'centrosCosto', 'observaciones', 'productos', 'movimientosInventario'] as const;
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
  {
    version: 2,
    descripcion: 'Seguridad: usuarios, sesiones y bitácora de auditoría',
    aplicar: (db) => {
      db.exec(`
        CREATE TABLE usuarios (
          id             TEXT PRIMARY KEY,
          usuario        TEXT NOT NULL UNIQUE COLLATE NOCASE,
          nombre         TEXT NOT NULL,
          rol            TEXT NOT NULL CHECK (rol IN ('administrador', 'auxiliar')),
          clave_hash     TEXT NOT NULL,
          activo         INTEGER NOT NULL DEFAULT 1,
          debe_cambiar_clave INTEGER NOT NULL DEFAULT 0,
          creado_en      TEXT NOT NULL,
          ultimo_acceso  TEXT
        );
        CREATE TABLE sesiones (
          token_hash   TEXT PRIMARY KEY,
          usuario_id   TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
          creada_en    TEXT NOT NULL,
          ultimo_uso   TEXT NOT NULL,
          ip           TEXT
        );
        CREATE TABLE auditoria (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          fecha       TEXT NOT NULL,
          usuario     TEXT NOT NULL,
          accion      TEXT NOT NULL,
          coleccion   TEXT,
          registro_id TEXT,
          detalle     TEXT,
          ip          TEXT
        );
        CREATE INDEX auditoria_fecha ON auditoria (fecha);
      `);
    },
  },
  {
    version: 3,
    descripcion: 'Compras: total = valor de la factura; saldo por pagar = total − retenciones − abonos',
    aplicar: (db) => {
      const filas = db.prepare("SELECT id, datos FROM registros WHERE coleccion = 'documentos'").all() as { id: string; datos: string }[];
      const actualizar = db.prepare("UPDATE registros SET datos = ? WHERE coleccion = 'documentos' AND id = ?");
      for (const fila of filas) {
        const d = JSON.parse(fila.datos);
        const signo = d.tipoDocumento === 'nota_credito' ? -1 : 1;
        const abs = (v: unknown) => Math.abs(Number(v) || 0);
        const ret = abs(d.totalRetenciones);
        const valorFactura = abs(d.subtotal) - abs(d.descuentos) + abs(d.totalIva) + abs(d.impoconsumo);
        let cambio = false;
        // Registros manuales anteriores guardaban el total ya restadas las retenciones
        if (ret > 0 && Math.abs(abs(d.total) - (valorFactura - ret)) <= 2) {
          d.total = Math.round(valorFactura) * signo;
          cambio = true;
        }
        // Saldo pendiente coherente con el nuevo criterio (solo facturas con saldo)
        if (signo > 0 && Number(d.saldoPendiente) > 0) {
          const abonado = (d.pagos || []).reduce((s: number, p: any) => s + (Number(p.monto) || 0), 0);
          const saldo = Math.max(0, Math.round(abs(d.total) - ret - abonado));
          if (saldo !== d.saldoPendiente) {
            d.saldoPendiente = saldo;
            d.estadoPago = saldo === 0 ? 'pagada' : abonado > 0 ? 'parcial' : 'pendiente';
            cambio = true;
          }
        }
        if (cambio) actualizar.run(JSON.stringify(d), fila.id);
      }
    },
  },
  {
    version: 4,
    descripcion: 'Empresa: reemplaza los datos de ejemplo por "Mi Veterinaria" (pantalla de inicio)',
    aplicar: (db) => {
      const fila = db.prepare("SELECT valor FROM configuracion WHERE clave = 'empresa'").get() as { valor: string } | undefined;
      if (!fila) return;
      const empresa = JSON.parse(fila.valor);
      // Solo si nadie la ha cambiado: conserva cualquier dato real ya configurado
      if (empresa.razonSocial !== EMPRESA_DEFECTO.razonSocial || empresa.nit !== EMPRESA_DEFECTO.nit) return;
      const neutra = {
        ...empresa,
        razonSocial: 'Mi Veterinaria', nombreComercial: 'Mi Veterinaria', nit: '', dv: '', direccion: '', ciudad: '',
        departamento: '', telefono: '', email: '', whatsapp: '', sitioWeb: '', slogan: '', logoUrl: '',
        matriculaMercantil: '', regimenTributario: '', resolucionLegal: '',
      };
      db.prepare("UPDATE configuracion SET valor = ? WHERE clave = 'empresa'").run(JSON.stringify(neutra));
    },
  },
  {
    version: 5,
    descripcion: 'Marca: nombre y colores de Los Criollos Vet (el logo viene con el programa)',
    aplicar: (db) => {
      const fila = db.prepare("SELECT valor FROM configuracion WHERE clave = 'empresa'").get() as { valor: string } | undefined;
      if (!fila) return;
      const empresa = JSON.parse(fila.valor);
      // Valores fijos (no constantes que cambien después): una migración publicada no se modifica
      if (!empresa.razonSocial || empresa.razonSocial === 'Mi Veterinaria') {
        empresa.razonSocial = 'LOS CRIOLLOS VET';
        empresa.nombreComercial = 'Los Criollos Vet';
        if (!empresa.slogan) empresa.slogan = 'Clínica veterinaria · Med. Rojas';
      }
      // Solo cambia los colores si seguían los verdes de fábrica
      if (!empresa.colorPrimario || empresa.colorPrimario.toLowerCase() === '#059669') empresa.colorPrimario = '#9330b3';
      if (!empresa.colorSecundario || empresa.colorSecundario.toLowerCase() === '#0f766e') empresa.colorSecundario = '#244568';
      db.prepare("UPDATE configuracion SET valor = ? WHERE clave = 'empresa'").run(JSON.stringify(empresa));
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
  /** Conexión activa; se reemplaza al restaurar un respaldo. */
  db!: DatabaseSync;
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
    this.abrir(existia);
    if (existia) this.respaldoDiario();
  }

  private abrir(existia: boolean): void {
    this.db = new DatabaseSync(this.rutaArchivo);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    this.migrar(existia);
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
    const base = `vetcompras-${marcaDeTiempo()}-${motivo.replace(/[^a-z0-9-]/gi, '_')}`;
    let destino = path.join(this.carpetaRespaldos, `${base}.db`);
    for (let n = 2; fs.existsSync(destino); n++) destino = path.join(this.carpetaRespaldos, `${base}-${n}.db`);
    this.db.prepare('VACUUM INTO ?').run(destino);
    this.depurarRespaldos();
    this.copiarARespaldoExterno(destino);
    return destino;
  }

  /** Crea el respaldo del día si aún no existe. El servidor lo llama al iniciar y cada hora. */
  respaldoDiario(): void {
    const hoy = new Date().toISOString().slice(0, 10);
    const yaExiste = this.listarRespaldos().some((r) => r.nombre.includes(hoy) && r.nombre.includes('diario'));
    if (!yaExiste) this.crearRespaldo('diario');
  }

  rutaRespaldo(nombre: string): string {
    // Solo nombres de la carpeta de respaldos (evita rutas como ..\otro-archivo)
    if (!/^vetcompras-[\w-]+\.db$/.test(nombre)) throw Object.assign(new Error('Nombre de respaldo no válido.'), { status: 400 });
    const ruta = path.join(this.carpetaRespaldos, nombre);
    if (!fs.existsSync(ruta)) throw Object.assign(new Error('El respaldo no existe.'), { status: 404 });
    return ruta;
  }

  /**
   * Reemplaza la base de datos actual por un respaldo. Antes guarda un respaldo
   * del estado actual, de modo que la restauración también se puede deshacer.
   */
  restaurarRespaldo(nombre: string): string {
    const origen = this.rutaRespaldo(nombre);

    // Validar que sea una base de VetCompras compatible antes de tocar nada
    const prueba = new DatabaseSync(origen, { readOnly: true });
    try {
      const { user_version } = prueba.prepare('PRAGMA user_version').get() as { user_version: number };
      const tabla = prueba.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'registros'").get();
      if (!tabla) throw new Error('El archivo no es un respaldo de VetCompras.');
      if (user_version > VERSION_ESQUEMA) throw new Error('El respaldo es de una versión más nueva del programa.');
    } finally {
      prueba.close();
    }

    const previo = this.crearRespaldo('antes-de-restaurar');
    this.db.close();
    for (const sufijo of ['-wal', '-shm']) fs.rmSync(this.rutaArchivo + sufijo, { force: true });
    fs.copyFileSync(origen, this.rutaArchivo);
    this.abrir(true);
    this.tocar();
    return previo;
  }

  // ------------------------------------------------- recordatorio de copias
  /**
   * Una "copia de seguridad" para el recordatorio es la que hace el usuario
   * (manual, descargada o copiada a otra carpeta). Los respaldos automáticos
   * diarios quedan en el mismo disco y no protegen ante daño o robo del PC.
   */
  registrarCopiaSeguridad(medio: string): void {
    this.guardarConfig('ultimaCopiaSeguridad', { fecha: new Date().toISOString(), medio });
  }

  estadoCopias(): { ultima: { fecha: string; medio: string } | null; diasSinCopia: number | null; diasRecordatorio: number } {
    const ultima = this.obtenerConfig<{ fecha: string; medio: string }>('ultimaCopiaSeguridad') || null;
    const diasRecordatorio = this.obtenerConfig<{ diasRecordatorio: number }>('politicaRespaldo')?.diasRecordatorio || 7;
    const diasSinCopia = ultima ? Math.floor((Date.now() - new Date(ultima.fecha).getTime()) / 86400000) : null;
    return { ultima, diasSinCopia, diasRecordatorio };
  }

  configurarRecordatorio(dias: number): void {
    if (!Number.isInteger(dias) || dias < 1 || dias > 90) {
      throw Object.assign(new Error('El recordatorio debe estar entre 1 y 90 días.'), { status: 400 });
    }
    this.guardarConfig('politicaRespaldo', { diasRecordatorio: dias });
  }

  /**
   * Guarda en la carpeta de respaldos un archivo .db traído de otro lugar
   * (USB, correo, otro PC) después de comprobar que es una copia válida de VetCompras.
   * Luego se restaura desde la lista como cualquier otro respaldo.
   */
  cargarRespaldo(contenido: Buffer): string {
    if (contenido.length < 100 || contenido.subarray(0, 16).toString('latin1') !== 'SQLite format 3\u0000') {
      throw Object.assign(new Error('El archivo no es una copia de seguridad de VetCompras (.db).'), { status: 400 });
    }
    const nombre = `vetcompras-${marcaDeTiempo()}-cargado.db`;
    const destino = path.join(this.carpetaRespaldos, nombre);
    fs.writeFileSync(destino, contenido);
    try {
      const prueba = new DatabaseSync(destino, { readOnly: true });
      try {
        const tabla = prueba.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'registros'").get();
        const { user_version } = prueba.prepare('PRAGMA user_version').get() as { user_version: number };
        if (!tabla) throw new Error('El archivo no contiene datos de VetCompras.');
        if (user_version > VERSION_ESQUEMA) throw new Error('La copia es de una versión más nueva del programa. Actualice VetCompras primero.');
      } finally {
        prueba.close();
      }
    } catch (err: any) {
      fs.rmSync(destino, { force: true });
      throw Object.assign(new Error(err?.message || 'El archivo está dañado o no es una copia válida.'), { status: 400 });
    }
    return nombre;
  }

  // ------------------------------------------------------- respaldo externo
  /** Segunda carpeta (otro disco, USB u OneDrive) donde se copia cada respaldo. */
  carpetaRespaldoExterno(): string | undefined {
    return this.obtenerConfig<{ carpeta?: string }>('respaldoExterno')?.carpeta || undefined;
  }

  configurarRespaldoExterno(carpeta: string | null): void {
    if (carpeta) {
      if (!path.isAbsolute(carpeta)) throw Object.assign(new Error('Escriba la ruta completa de la carpeta (ej. D:\\Respaldos).'), { status: 400 });
      try {
        fs.mkdirSync(carpeta, { recursive: true });
        const prueba = path.join(carpeta, '.vetcompras-prueba');
        fs.writeFileSync(prueba, 'ok');
        fs.rmSync(prueba);
      } catch {
        throw Object.assign(new Error('No se puede escribir en esa carpeta. Verifique que la USB o el disco estén conectados.'), { status: 400 });
      }
    }
    this.guardarConfig('respaldoExterno', { carpeta: carpeta || '' });
  }

  ultimoRespaldoExterno: { fecha: string; ok: boolean; mensaje: string } | null = null;

  private copiarARespaldoExterno(archivo: string): void {
    const carpeta = this.carpetaRespaldoExterno();
    if (!carpeta) return;
    const fecha = new Date().toISOString();
    try {
      fs.mkdirSync(carpeta, { recursive: true });
      fs.copyFileSync(archivo, path.join(carpeta, path.basename(archivo)));
      // Conservar solo los últimos respaldos rotativos también en la carpeta externa
      const rotativos = fs
        .readdirSync(carpeta)
        .filter((f) => /^vetcompras-.*\.db$/.test(f) && !f.includes('antes-de-actualizar'))
        .sort()
        .reverse();
      for (const f of rotativos.slice(RESPALDOS_A_CONSERVAR)) fs.rmSync(path.join(carpeta, f), { force: true });
      this.ultimoRespaldoExterno = { fecha, ok: true, mensaje: `Copiado a ${carpeta}` };
      this.registrarCopiaSeguridad('copia automática en carpeta externa');
    } catch (err: any) {
      this.ultimoRespaldoExterno = { fecha, ok: false, mensaje: `No se pudo copiar a ${carpeta}: ${err?.message}` };
      console.warn('[VetCompras]', this.ultimoRespaldoExterno.mensaje);
    }
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

  tocar(): void {
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

  existe(coleccion: Coleccion, id: string): boolean {
    return !!this.db.prepare('SELECT 1 AS si FROM registros WHERE coleccion = ? AND id = ?').get(coleccion, id);
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

  // -------------------------------------------------------------- auditoría
  auditar(e: { usuario: string; accion: string; coleccion?: string; registroId?: string; detalle?: string; ip?: string }): void {
    this.db
      .prepare(
        'INSERT INTO auditoria (fecha, usuario, accion, coleccion, registro_id, detalle, ip) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(new Date().toISOString(), e.usuario, e.accion, e.coleccion ?? null, e.registroId ?? null, e.detalle ?? null, e.ip ?? null);
  }

  listarAuditoria(limite = 300, texto = ''): Record<string, unknown>[] {
    const filtro = `%${texto}%`;
    return this.db
      .prepare(
        `SELECT fecha, usuario, accion, coleccion, registro_id AS registroId, detalle, ip FROM auditoria
         WHERE ? = '%%' OR usuario LIKE ? OR accion LIKE ? OR detalle LIKE ? OR registro_id LIKE ?
         ORDER BY id DESC LIMIT ?`
      )
      .all(filtro, filtro, filtro, filtro, filtro, Math.min(Math.max(limite, 1), 2000)) as Record<string, unknown>[];
  }

  cerrar(): void {
    this.db.close();
  }
}
