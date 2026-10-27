import { CompraDocumento, Proveedor, Categoria, CentroCosto, RegistroPago, EmpresaInfo, Venta } from '../types';
import { EMPRESA_DEFECTO } from '../data/defaults';
import { fechaLocal } from '../utils/formatters';

/**
 * Capa de acceso a datos de VetCompras.
 *
 * Toda la información vive en la base de datos SQLite del PC donde está
 * instalado el servidor local (ver server/basedatos.ts). El navegador solo
 * guarda en caché los datos de la empresa para mostrarlos de inmediato.
 * Si otros equipos de la red usan el mismo servidor, los cambios se
 * detectan consultando la revisión cada pocos segundos.
 */

type Coleccion = 'documentos' | 'ventas' | 'proveedores' | 'categorias' | 'centrosCosto' | 'observaciones';

const CLAVE_CACHE_EMPRESA = 'vetcompras_empresa';
const INTERVALO_SONDEO_MS = 4000;

export type Rol = 'administrador' | 'auxiliar';

export interface UsuarioActual {
  id: string;
  usuario: string;
  nombre: string;
  rol: Rol;
  debeCambiarClave: boolean;
}

export interface EstadoSesion {
  usuario: UsuarioActual | null;
  requiereConfiguracion: boolean;
  minutosInactividad: number;
  version: string;
  etapa?: 'prueba' | 'produccion';
}

export interface EstadoCopias {
  ultima: { fecha: string; medio: string } | null;
  diasSinCopia: number | null;
  diasRecordatorio: number;
}

/** Observación que deja un probador durante la etapa de prueba. */
export interface Observacion {
  id: string;
  fecha: string;
  usuario: string;
  modulo: string;
  tipo: 'error' | 'mejora' | 'duda';
  descripcion: string;
  estado: 'nueva' | 'revisada' | 'resuelta';
  respuesta?: string;
}

/** Evento global que la App escucha para volver a la pantalla de ingreso. */
export const EVENTO_SESION = 'vetcompras:sesion';

let usuarioActual: UsuarioActual | null = null;
let etapaActual: 'prueba' | 'produccion' = 'produccion';
let versionActual = '';

async function api<T = any>(ruta: string, opciones: RequestInit & { sondeo?: boolean } = {}): Promise<T> {
  const { sondeo, ...init } = opciones;
  let respuesta: Response;
  try {
    respuesta = await fetch('/api' + ruta, {
      ...init,
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        // Cabecera propia: impide que otro sitio web haga cambios usando la sesión abierta
        'X-VetCompras': '1',
        ...(sondeo ? { 'X-Sondeo': '1' } : {}),
        ...(init.headers || {}),
      },
    });
  } catch {
    throw new Error('No hay conexión con el servidor local de VetCompras. Verifique que el programa esté abierto.');
  }
  const cuerpo = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    if (cuerpo?.sesionVencida || cuerpo?.debeCambiarClave) {
      window.dispatchEvent(new CustomEvent(EVENTO_SESION, { detail: cuerpo }));
    }
    throw new Error(cuerpo?.error || `Error ${respuesta.status} del servidor local.`);
  }
  return cuerpo as T;
}

const listar = <T>(c: Coleccion) => api<T[]>(`/${c}`);
const obtener = async <T>(c: Coleccion, id: string): Promise<T | undefined> => {
  try {
    return await api<T>(`/${c}/${encodeURIComponent(id)}`);
  } catch {
    return undefined;
  }
};
const guardar = <T extends { id: string }>(c: Coleccion, r: T) =>
  api(`/${c}/${encodeURIComponent(r.id)}`, { method: 'PUT', body: JSON.stringify(r) });
const eliminar = (c: Coleccion, id: string) => api(`/${c}/${encodeURIComponent(id)}`, { method: 'DELETE' });
const lote = (c: Coleccion, cambios: { guardar?: unknown[]; eliminar?: string[] }) =>
  api(`/${c}/lote`, { method: 'POST', body: JSON.stringify(cambios) });

function nuevoId(prefijo: string): string {
  const aleatorio =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefijo}-${Date.now()}-${aleatorio}`;
}

function leerEmpresaEnCache(): EmpresaInfo {
  try {
    const raw = localStorage.getItem(CLAVE_CACHE_EMPRESA);
    if (raw) return JSON.parse(raw);
  } catch {
    // Caché no disponible: se usan los valores por defecto hasta que responda el servidor
  }
  return EMPRESA_DEFECTO;
}

let empresaActual: EmpresaInfo = leerEmpresaEnCache();
let inicializacion: Promise<void> | null = null;

function fijarEmpresa(datos: EmpresaInfo) {
  empresaActual = datos;
  try {
    localStorage.setItem(CLAVE_CACHE_EMPRESA, JSON.stringify(datos));
  } catch {
    // Sin caché local; no afecta los datos guardados en el servidor
  }
}

export interface EstadoServidor {
  aplicacion: string;
  version: string;
  versionEsquema: number;
  revision: string;
  carpetaDatos: string;
  geminiConfigurado: boolean;
  etapa?: 'prueba' | 'produccion';
  copias?: EstadoCopias;
}

export const dataService = {
  // ================= SESIÓN Y USUARIOS =================

  usuarioActual(): UsuarioActual | null {
    return usuarioActual;
  },

  /** 'prueba' cuando el paquete se entregó a probadores (ETAPA=prueba en .env). */
  etapa(): 'prueba' | 'produccion' {
    return etapaActual;
  },

  version(): string {
    return versionActual;
  },

  esAdministrador(): boolean {
    return usuarioActual?.rol === 'administrador';
  },

  async obtenerSesion(): Promise<EstadoSesion> {
    const estado = await api<EstadoSesion>('/sesion');
    usuarioActual = estado.usuario;
    etapaActual = estado.etapa === 'prueba' ? 'prueba' : 'produccion';
    versionActual = estado.version;
    return estado;
  },

  async ingresar(usuario: string, clave: string): Promise<UsuarioActual> {
    const r = await api<{ usuario: UsuarioActual }>('/sesion/ingresar', {
      method: 'POST',
      body: JSON.stringify({ usuario, clave }),
    });
    usuarioActual = r.usuario;
    inicializacion = null;
    return r.usuario;
  },

  async configuracionInicial(datos: {
    usuario: string;
    nombre: string;
    clave: string;
    empresa?: Partial<EmpresaInfo>;
  }): Promise<UsuarioActual> {
    const r = await api<{ usuario: UsuarioActual }>('/sesion/configuracion-inicial', {
      method: 'POST',
      body: JSON.stringify(datos),
    });
    usuarioActual = r.usuario;
    inicializacion = null;
    return r.usuario;
  },

  async salir(): Promise<void> {
    await api('/sesion/salir', { method: 'POST' }).catch(() => undefined);
    usuarioActual = null;
    inicializacion = null;
  },

  async cambiarClave(claveActual: string, claveNueva: string): Promise<void> {
    await api('/sesion/cambiar-clave', { method: 'POST', body: JSON.stringify({ claveActual, claveNueva }) });
    if (usuarioActual) usuarioActual = { ...usuarioActual, debeCambiarClave: false };
  },

  listarUsuarios(): Promise<(UsuarioActual & { activo: boolean; creadoEn: string; ultimoAcceso: string | null })[]> {
    return api('/usuarios');
  },

  crearUsuario(datos: { usuario: string; nombre: string; rol: Rol; clave: string }): Promise<unknown> {
    return api('/usuarios', { method: 'POST', body: JSON.stringify(datos) });
  },

  actualizarUsuario(id: string, cambios: { nombre?: string; rol?: Rol; activo?: boolean }): Promise<unknown> {
    return api(`/usuarios/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(cambios) });
  },

  restablecerClaveUsuario(id: string, claveTemporal: string): Promise<unknown> {
    return api(`/usuarios/${encodeURIComponent(id)}/restablecer-clave`, {
      method: 'POST',
      body: JSON.stringify({ claveTemporal }),
    });
  },

  listarAuditoria(texto = ''): Promise<
    { fecha: string; usuario: string; accion: string; coleccion?: string; registroId?: string; detalle?: string; ip?: string }[]
  > {
    return api(`/auditoria?limite=500&texto=${encodeURIComponent(texto)}`);
  },

  /** Carga los datos de la empresa una sola vez por sesión. */
  init(): Promise<void> {
    if (!inicializacion) {
      inicializacion = api<EmpresaInfo | null>('/configuracion/empresa')
        .then((emp) => {
          if (emp) fijarEmpresa(emp);
        })
        .catch((err) => {
          inicializacion = null;
          throw err;
        });
    }
    return inicializacion;
  },

  obtenerEstado(): Promise<EstadoServidor> {
    return api<EstadoServidor>('/estado');
  },

  /**
   * Avisa cuando cambian los datos en el servidor (por ejemplo desde otro PC
   * de la veterinaria). Devuelve la función para cancelar la suscripción.
   */
  suscribirCambiosEnVivo(onCambio: () => void): () => void {
    let ultimaRevision: string | null = null;
    let activo = true;

    const revisar = async () => {
      try {
        const { revision } = await api<EstadoServidor>('/estado', { sondeo: true });
        if (ultimaRevision !== null && revision !== ultimaRevision) {
          const emp = await api<EmpresaInfo | null>('/configuracion/empresa', { sondeo: true });
          if (emp) fijarEmpresa(emp);
          if (activo) onCambio();
        }
        ultimaRevision = revision;
      } catch {
        // Servidor momentáneamente no disponible: se reintenta en el siguiente ciclo
      }
    };

    revisar();
    const temporizador = setInterval(revisar, INTERVALO_SONDEO_MS);
    return () => {
      activo = false;
      clearInterval(temporizador);
    };
  },

  // ================= DOCUMENTOS =================

  async obtenerDocumentos(): Promise<CompraDocumento[]> {
    await this.init();
    const docs = await listar<CompraDocumento>('documentos');
    return docs.sort((a, b) => (b.fechaEmision || '').localeCompare(a.fechaEmision || ''));
  },

  /** Devuelve el documento completo, incluido el contenido del PDF/XML anexo. */
  async obtenerDocumentoPorId(id: string): Promise<CompraDocumento | undefined> {
    return obtener<CompraDocumento>('documentos', id);
  },

  /**
   * Valida si ya existe un documento con el mismo CUFE o combinación de NIT Proveedor + Prefijo + Folio
   */
  async buscarDuplicado(
    cufe?: string,
    nitProveedor?: string,
    folio?: string,
    prefijo?: string
  ): Promise<CompraDocumento | null> {
    const todos = await listar<CompraDocumento>('documentos');

    if (cufe && cufe.trim().length > 10) {
      const c = cufe.toLowerCase().trim();
      const matchCufe = todos.find((d) => d.cufe && d.cufe.toLowerCase().trim() === c);
      if (matchCufe) return matchCufe;
    }

    if (nitProveedor && folio) {
      const cleanNit = nitProveedor.replace(/\D/g, '');
      const cleanFolio = folio.trim().toLowerCase();
      const cleanPrefijo = (prefijo || '').trim().toLowerCase();

      const matchNitFolio = todos.find((d) => {
        const dNit = (d.proveedor?.nit || '').replace(/\D/g, '');
        const dFolio = (d.folio || '').trim().toLowerCase();
        const dPrefijo = (d.prefijo || '').trim().toLowerCase();
        const mismoPrefijo = !cleanPrefijo || !dPrefijo || dPrefijo === cleanPrefijo;
        return dNit === cleanNit && dFolio === cleanFolio && mismoPrefijo;
      });
      if (matchNitFolio) return matchNitFolio;
    }

    return null;
  },

  async guardarDocumento(docData: CompraDocumento): Promise<string> {
    if (docData.proveedor && docData.proveedor.nit) {
      await this.asegurarProveedor(docData.proveedor, docData.categoriaId, docData.centroCostoId);
    }
    await guardar('documentos', docData);
    return docData.id;
  },

  async actualizarDocumento(docData: CompraDocumento, detalleCambio?: string): Promise<void> {
    const historial = [...(docData.historialCambios || [])];
    if (detalleCambio) {
      historial.push({
        fecha: new Date().toISOString(),
        usuario: usuarioActual?.nombre || 'Usuario',
        accion: 'Modificación de registro',
        detalle: detalleCambio,
      });
    }
    await guardar('documentos', {
      ...docData,
      historialCambios: historial,
      actualizadoEn: new Date().toISOString(),
    });
  },

  async eliminarDocumento(id: string): Promise<void> {
    await eliminar('documentos', id);
  },

  async eliminarDocumentosLote(ids: string[]): Promise<void> {
    await lote('documentos', { eliminar: ids });
  },

  async cambiarCategoriaLote(ids: string[], nuevaCategoriaId: string, esGasto?: boolean): Promise<void> {
    const seleccion = new Set(ids);
    const docs = (await listar<CompraDocumento>('documentos')).filter((d) => seleccion.has(d.id));
    const ahora = new Date().toISOString();
    const actualizados = docs.map((d) => ({
      ...d,
      categoriaId: nuevaCategoriaId,
      esGasto: esGasto ?? d.esGasto,
      actualizadoEn: ahora,
      historialCambios: [
        ...(d.historialCambios || []),
        { fecha: ahora, usuario: usuarioActual?.nombre || 'Usuario', accion: 'Cambio masivo de categoría' },
      ],
    }));
    await lote('documentos', { guardar: actualizados });
  },

  async marcarPagadosLote(ids: string[]): Promise<void> {
    const seleccion = new Set(ids);
    const docs = (await listar<CompraDocumento>('documentos')).filter((d) => seleccion.has(d.id));
    const hoy = fechaLocal();
    const ahora = new Date().toISOString();

    const actualizados = docs
      .filter((d) => d.saldoPendiente > 0)
      .map((d) => {
        const nuevoPago: RegistroPago = {
          id: nuevoId('pago'),
          fecha: hoy,
          monto: d.saldoPendiente,
          medio: 'transferencia',
          nota: 'Marcado masivo como pagado',
        };
        return {
          ...d,
          estadoPago: 'pagada' as const,
          saldoPendiente: 0,
          fechaPago: hoy,
          pagos: [...(d.pagos || []), nuevoPago],
          actualizadoEn: ahora,
          historialCambios: [
            ...(d.historialCambios || []),
            { fecha: ahora, usuario: usuarioActual?.nombre || 'Usuario', accion: 'Marcado masivo como pagado' },
          ],
        };
      });

    await lote('documentos', { guardar: actualizados });
  },

  async registrarAbonoPago(
    documentoId: string,
    pago: { monto: number; fecha: string; medio: string; referencia?: string; nota?: string }
  ): Promise<CompraDocumento> {
    const docItem = await obtener<CompraDocumento>('documentos', documentoId);
    if (!docItem) throw new Error('Documento no encontrado');
    if (!(pago.monto > 0)) throw new Error('El valor del abono debe ser mayor a cero.');
    if (pago.monto > docItem.saldoPendiente) {
      throw new Error('El abono supera el saldo pendiente del documento.');
    }

    const nuevoSaldo = Math.max(0, docItem.saldoPendiente - pago.monto);
    const nuevoEstado = nuevoSaldo === 0 ? 'pagada' : 'parcial';

    const registroPago: RegistroPago = {
      id: nuevoId('pago'),
      fecha: pago.fecha,
      monto: pago.monto,
      medio: pago.medio,
      referencia: pago.referencia,
      nota: pago.nota,
    };

    const docActualizado: CompraDocumento = {
      ...docItem,
      saldoPendiente: nuevoSaldo,
      estadoPago: nuevoEstado,
      fechaPago: nuevoSaldo === 0 ? pago.fecha : docItem.fechaPago,
      pagos: [...(docItem.pagos || []), registroPago],
      actualizadoEn: new Date().toISOString(),
      historialCambios: [
        ...(docItem.historialCambios || []),
        {
          fecha: new Date().toISOString(),
          usuario: usuarioActual?.nombre || 'Usuario',
          accion: 'Registro de Abono / Pago',
          detalle: `Medio: ${pago.medio}. Saldo restante: $${nuevoSaldo.toLocaleString('es-CO')}`,
        },
      ],
    };

    await guardar('documentos', docActualizado);
    return docActualizado;
  },

  /** Anula un abono registrado por error y devuelve su valor al saldo de la factura. */
  async anularAbono(documentoId: string, pagoId: string, motivo: string): Promise<CompraDocumento> {
    const docItem = await obtener<CompraDocumento>('documentos', documentoId);
    if (!docItem) throw new Error('Documento no encontrado');
    const pago = (docItem.pagos || []).find((p) => p.id === pagoId);
    if (!pago) throw new Error('El abono ya no existe.');
    const pagos = docItem.pagos.filter((p) => p.id !== pagoId);
    const neto = Math.max(0, Math.abs(docItem.total) - Math.abs(docItem.totalRetenciones || 0));
    const saldo = Math.min(neto || Infinity, Math.max(0, docItem.saldoPendiente) + pago.monto);
    const ahora = new Date().toISOString();
    const actualizado: CompraDocumento = {
      ...docItem,
      pagos,
      saldoPendiente: Math.round(saldo),
      estadoPago: saldo <= 0 ? 'pagada' : pagos.length > 0 ? 'parcial' : 'pendiente',
      fechaPago: saldo <= 0 ? docItem.fechaPago : undefined,
      actualizadoEn: ahora,
      historialCambios: [
        ...(docItem.historialCambios || []),
        {
          fecha: ahora,
          usuario: usuarioActual?.nombre || 'Usuario',
          accion: 'Abono anulado',
          detalle: `${pago.fecha} · $${pago.monto.toLocaleString('es-CO')} · ${pago.medio}. Motivo: ${motivo || 'sin motivo'}`,
        },
      ],
    };
    await guardar('documentos', actualizado);
    return actualizado;
  },

  async registrarAbono(
    documentoId: string,
    pago: { monto: number; fecha: string; medio: string; referencia?: string; nota?: string }
  ): Promise<CompraDocumento> {
    return this.registrarAbonoPago(documentoId, pago);
  },

  // ================= PROVEEDORES =================

  async obtenerProveedores(): Promise<Proveedor[]> {
    const provs = await listar<Proveedor>('proveedores');
    return provs.sort((a, b) => a.razonSocial.localeCompare(b.razonSocial));
  },

  async guardarProveedor(proveedor: Proveedor): Promise<void> {
    await guardar('proveedores', proveedor);
  },

  async eliminarProveedor(id: string): Promise<void> {
    await eliminar('proveedores', id);
  },

  async asegurarProveedor(
    info: { nit: string; dv?: string; razonSocial: string; telefono?: string; email?: string; direccion?: string; ciudad?: string },
    categoriaId?: string,
    centroCostoId?: string
  ): Promise<Proveedor> {
    const cleanNit = info.nit.replace(/\D/g, '');
    const todos = await listar<Proveedor>('proveedores');
    const existente = todos.find((p) => p.nit.replace(/\D/g, '') === cleanNit);
    if (existente) return existente;

    const ahora = new Date().toISOString();
    const nuevo: Proveedor = {
      id: nuevoId('prov'),
      nit: info.nit,
      dv: info.dv,
      razonSocial: info.razonSocial,
      nombreComercial: info.razonSocial,
      telefono: info.telefono,
      email: info.email,
      direccion: info.direccion,
      ciudad: info.ciudad || 'Colombia',
      categoriaPredeterminadaId: categoriaId,
      centroCostoPredeterminadoId: centroCostoId,
      creadoEn: ahora,
      actualizadoEn: ahora,
    };
    await guardar('proveedores', nuevo);
    return nuevo;
  },

  // ================= CATEGORÍAS =================

  async obtenerCategorias(): Promise<Categoria[]> {
    return listar<Categoria>('categorias');
  },

  async guardarCategoria(categoria: Categoria): Promise<void> {
    await guardar('categorias', categoria);
  },

  async eliminarCategoria(id: string): Promise<void> {
    await eliminar('categorias', id);
  },

  // ================= CENTROS DE COSTO =================

  async obtenerCentrosCosto(): Promise<CentroCosto[]> {
    return listar<CentroCosto>('centrosCosto');
  },

  async guardarCentroCosto(centro: CentroCosto): Promise<void> {
    await guardar('centrosCosto', centro);
  },

  async eliminarCentroCosto(id: string): Promise<void> {
    await eliminar('centrosCosto', id);
  },

  // ================= MANTENIMIENTO Y RESPALDOS =================
  // Cada operación destructiva crea antes un respaldo automático en el PC.

  async cargarDatosDemostracion(): Promise<void> {
    await api('/mantenimiento/cargar-demo', { method: 'POST' });
  },

  async limpiarTodosLosDatos(): Promise<void> {
    await api('/mantenimiento/limpiar-documentos', { method: 'POST' });
  },

  async resetearTodoPorDefecto(): Promise<void> {
    await api('/mantenimiento/restablecer', { method: 'POST' });
  },

  async crearRespaldoEnDisco(): Promise<string> {
    const { ruta } = await api<{ ruta: string }>('/respaldos', { method: 'POST' });
    return ruta;
  },

  async listarRespaldos(): Promise<{
    carpeta: string;
    carpetaExterna: string;
    ultimoRespaldoExterno: { fecha: string; ok: boolean; mensaje: string } | null;
    respaldos: { nombre: string; tamano: number; fecha: string }[];
  }> {
    return api('/respaldos');
  },

  configurarRespaldoExterno(carpeta: string): Promise<{ ultimoRespaldoExterno: { ok: boolean; mensaje: string } | null }> {
    return api('/respaldos/externo', { method: 'PUT', body: JSON.stringify({ carpeta }) });
  },

  urlDescargaRespaldo(nombre: string): string {
    return `/api/respaldos/${encodeURIComponent(nombre)}/descargar`;
  },

  async restaurarRespaldo(nombre: string): Promise<string> {
    const r = await api<{ respaldoPrevio: string }>(`/respaldos/${encodeURIComponent(nombre)}/restaurar`, { method: 'POST' });
    usuarioActual = null;
    return r.respaldoPrevio;
  },

  obtenerEstadoCopias(): Promise<EstadoCopias> {
    return api('/respaldos/estado');
  },

  configurarRecordatorioCopias(diasRecordatorio: number): Promise<EstadoCopias> {
    return api('/respaldos/politica', { method: 'PUT', body: JSON.stringify({ diasRecordatorio }) });
  },

  /** Sube un archivo .db (copia de seguridad) a la carpeta de respaldos para luego restaurarlo. */
  async cargarArchivoRespaldo(archivo: File): Promise<string> {
    let respuesta: Response;
    try {
      respuesta = await fetch('/api/respaldos/cargar', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-VetCompras': '1',
          'X-Nombre-Archivo': encodeURIComponent(archivo.name),
        },
        body: archivo,
      });
    } catch {
      throw new Error('No hay conexión con el servidor local de VetCompras.');
    }
    const cuerpo = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(cuerpo?.error || 'No se pudo cargar el archivo.');
    return cuerpo.nombre;
  },

  abrirCarpetaRespaldos(): Promise<{ abierta: boolean; carpeta: string }> {
    return api('/respaldos/abrir-carpeta', { method: 'POST' });
  },

  // ================= OBSERVACIONES (ETAPA DE PRUEBA) =================

  async obtenerObservaciones(): Promise<Observacion[]> {
    const lista = await listar<Observacion>('observaciones');
    return lista.sort((a, b) => b.fecha.localeCompare(a.fecha));
  },

  guardarObservacion(o: Observacion): Promise<unknown> {
    return guardar('observaciones', o);
  },

  async apagarServidor(): Promise<void> {
    await api('/sistema/apagar', { method: 'POST' });
  },

  async exportarRespaldoJSON(): Promise<string> {
    const respaldo = await api('/respaldo-json');
    return JSON.stringify(respaldo, null, 2);
  },

  async importarRespaldoJSON(jsonString: string): Promise<{ documentos: number; proveedores: number; ventas: number }> {
    const data = JSON.parse(jsonString);
    const { importados } = await api<{ importados: Record<string, number> }>('/respaldo-json', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (data.empresa) fijarEmpresa(data.empresa);
    return {
      documentos: importados.documentos || 0,
      proveedores: importados.proveedores || 0,
      ventas: importados.ventas || 0,
    };
  },

  // ================= DATOS DE LA EMPRESA VETERINARIA =================

  obtenerDatosEmpresa(): EmpresaInfo {
    return empresaActual;
  },

  guardarDatosEmpresa(datos: EmpresaInfo): Promise<void> {
    fijarEmpresa(datos);
    return api('/configuracion/empresa', { method: 'PUT', body: JSON.stringify(datos) }).then(() => undefined);
  },

  // ================= VENTAS DE LA VETERINARIA =================

  async obtenerVentas(): Promise<Venta[]> {
    const ventas = await listar<Venta>('ventas');
    return ventas.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  },

  async obtenerVentaPorId(id: string): Promise<Venta | undefined> {
    return obtener<Venta>('ventas', id);
  },

  async guardarVenta(venta: Venta): Promise<string> {
    await guardar('ventas', venta);
    return venta.id;
  },

  async actualizarVenta(venta: Venta): Promise<void> {
    await guardar('ventas', { ...venta, actualizadoEn: new Date().toISOString() });
  },

  async eliminarVenta(id: string): Promise<void> {
    await eliminar('ventas', id);
  },

  async eliminarVentasLote(ids: string[]): Promise<void> {
    await lote('ventas', { eliminar: ids });
  },

  async limpiarVentas(): Promise<void> {
    await api('/mantenimiento/limpiar-ventas', { method: 'POST' });
  },

  async generarSiguienteConsecutivoVenta(): Promise<string> {
    const todas = await listar<Venta>('ventas');
    let maxNum = 0;
    for (const v of todas) {
      const match = v.consecutivo?.match(/\d+/);
      if (match) {
        const n = parseInt(match[0], 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    }
    return `VNT-${String(maxNum + 1).padStart(3, '0')}`;
  },
};
