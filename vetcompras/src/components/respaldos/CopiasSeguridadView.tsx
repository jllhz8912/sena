import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  DatabaseBackup,
  Download,
  FolderOpen,
  HardDrive,
  Loader2,
  Power,
  RotateCcw,
  Save,
  ShieldCheck,
  Upload,
  BellRing,
  Trash2,
} from 'lucide-react';
import { dataService, EstadoCopias } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { ModalConfirmacion } from '../common/ModalConfirmacion';
import { ModalBorradoSeguro } from './ModalBorradoSeguro';

type Respaldos = Awaited<ReturnType<typeof dataService.listarRespaldos>>;

const claseInput =
  'w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500';
const claseTarjeta = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4';
const fechaHora = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const megas = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Explica en palabras simples de dónde salió cada respaldo. */
function motivoRespaldo(nombre: string): string {
  if (nombre.includes('diario')) return 'Automático diario';
  if (nombre.includes('manual')) return 'Copia manual';
  if (nombre.includes('cargado')) return 'Cargado desde un archivo';
  if (nombre.includes('antes-de-actualizar')) return 'Antes de actualizar el programa';
  if (nombre.includes('antes-de-restaurar')) return 'Antes de restaurar otro respaldo';
  if (nombre.includes('antes-de-importar')) return 'Antes de importar un archivo';
  if (nombre.includes('antes-de-limpiar')) return 'Antes de borrar registros';
  if (nombre.includes('antes-de-cargar-demo')) return 'Antes de cargar datos de demostración';
  if (nombre.includes('antes-de-restablecer')) return 'Antes de restablecer el sistema';
  return 'Respaldo';
}

/** Mensaje y color del recordatorio según los días sin copia de seguridad. */
export function estadoRecordatorio(c: EstadoCopias | null | undefined): { vencido: boolean; texto: string } {
  if (!c) return { vencido: false, texto: '' };
  if (!c.ultima) return { vencido: true, texto: 'Todavía no ha hecho ninguna copia de seguridad.' };
  const dias = c.diasSinCopia ?? 0;
  const hace = dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`;
  return {
    vencido: dias >= c.diasRecordatorio,
    texto: `Última copia de seguridad: ${hace} (${c.ultima.medio}).`,
  };
}

export const CopiasSeguridadView: React.FC<{ onSesionTerminada: () => void; onDatosActualizados: () => void }> = ({
  onSesionTerminada,
  onDatosActualizados,
}) => {
  const { mostrarToast } = useToast();
  const esAdmin = dataService.esAdministrador();
  const [estado, setEstado] = useState<EstadoCopias | null>(null);
  const [datos, setDatos] = useState<Respaldos | null>(null);
  const [carpetaExterna, setCarpetaExterna] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [aRestaurar, setARestaurar] = useState<string | null>(null);
  const [jsonPorImportar, setJsonPorImportar] = useState<File | null>(null);
  const [confirmarApagado, setConfirmarApagado] = useState(false);
  const [borrarTodoAbierto, setBorrarTodoAbierto] = useState(false);
  const [recienCargado, setRecienCargado] = useState<string | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(() => {
    dataService.obtenerEstadoCopias().then(setEstado).catch(() => undefined);
    if (!esAdmin) return;
    dataService
      .listarRespaldos()
      .then((d) => {
        setDatos(d);
        setCarpetaExterna(d.carpetaExterna);
      })
      .catch((e) => mostrarToast('error', 'Copias de seguridad', e.message));
  }, [esAdmin, mostrarToast]);

  useEffect(cargar, [cargar]);

  const ejecutar = async (accion: () => Promise<void>) => {
    setTrabajando(true);
    try {
      await accion();
    } catch (e: any) {
      mostrarToast('error', 'No se completó la operación', e?.message);
    } finally {
      setTrabajando(false);
      cargar();
      onDatosActualizados(); // actualiza alertas del menú y la campana
    }
  };

  const crearCopia = (descargar: boolean) =>
    ejecutar(async () => {
      const ruta = await dataService.crearRespaldoEnDisco();
      const nombre = ruta.split(/[\\/]/).pop()!;
      mostrarToast('success', 'Copia de seguridad creada', descargar ? 'Elija dónde guardarla (por ejemplo, la USB).' : `Guardada en la carpeta de respaldos: ${nombre}`);
      if (descargar) window.location.href = dataService.urlDescargaRespaldo(nombre);
    });

  const abrirCarpeta = () =>
    ejecutar(async () => {
      const r = await dataService.abrirCarpetaRespaldos();
      if (!r.abierta) mostrarToast('info', 'Carpeta de respaldos', r.carpeta, 10000);
    });

  const alElegirArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    if (archivo.name.toLowerCase().endsWith('.json')) {
      setJsonPorImportar(archivo);
      return;
    }
    ejecutar(async () => {
      const nombre = await dataService.cargarArchivoRespaldo(archivo);
      setRecienCargado(nombre);
      mostrarToast('success', 'Copia cargada', 'Revísela en la lista y presione "Restaurar" para usarla.');
    });
  };

  const importarJson = () =>
    ejecutar(async () => {
      if (!jsonPorImportar) return;
      const r = await dataService.importarRespaldoJSON(await jsonPorImportar.text());
      setJsonPorImportar(null);
      mostrarToast('success', 'Respaldo importado', `${r.documentos} compras, ${r.ventas} ventas y ${r.proveedores} proveedores.`);
      onDatosActualizados();
    });

  const restaurar = () =>
    ejecutar(async () => {
      if (!aRestaurar) return;
      await dataService.restaurarRespaldo(aRestaurar);
      setARestaurar(null);
      mostrarToast('success', 'Información restaurada', 'Ingrese de nuevo para continuar.');
      onSesionTerminada();
    });

  const guardarExterna = () =>
    ejecutar(async () => {
      const r = await dataService.configurarRespaldoExterno(carpetaExterna);
      if (!carpetaExterna) mostrarToast('info', 'Copia externa desactivada', 'Las copias quedan solo en este PC.');
      else if (r.ultimoRespaldoExterno?.ok) mostrarToast('success', 'Copia externa activada', r.ultimoRespaldoExterno.mensaje);
      else mostrarToast('error', 'Revise la carpeta', r.ultimoRespaldoExterno?.mensaje || 'No se pudo copiar.');
    });

  const cambiarRecordatorio = (dias: number) =>
    ejecutar(async () => {
      setEstado(await dataService.configurarRecordatorioCopias(dias));
      mostrarToast('success', 'Recordatorio guardado', `Le avisaremos si pasan ${dias} días sin copia de seguridad.`);
    });

  const recordatorio = estadoRecordatorio(estado);
  const ext = datos?.ultimoRespaldoExterno;

  return (
    <div className="space-y-5">
      {/* Estado de la última copia */}
      <div
        className={`rounded-2xl border p-5 flex flex-col md:flex-row md:items-center gap-4 justify-between ${
          recordatorio.vencido
            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
            : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
        }`}
      >
        <div className="flex items-start gap-3">
          {recordatorio.vencido ? (
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
          ) : (
            <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
          )}
          <div>
            <p className="font-bold text-slate-900 dark:text-white">{estado ? recordatorio.texto : 'Consultando…'}</p>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {recordatorio.vencido
                ? 'Haga una copia ahora y, si puede, guárdela también en una USB o en otro disco.'
                : 'Sus datos están respaldados. Mantenga la costumbre de copiar a una USB u otro disco.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => crearCopia(false)}
            disabled={trabajando}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-60"
          >
            {trabajando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Hacer copia de seguridad
          </button>
          {esAdmin && (
            <button
              onClick={() => crearCopia(true)}
              disabled={trabajando}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-600 text-emerald-700 dark:text-emerald-300 text-sm font-semibold disabled:opacity-60"
              title="Crea la copia y la descarga para guardarla en una USB u otro disco"
            >
              <Download className="w-4 h-4" /> Copiar y descargar
            </button>
          )}
        </div>
      </div>

      {!esAdmin && (
        <p className="text-xs text-slate-500">
          Su usuario puede crear copias de seguridad. Para descargarlas, cargarlas o restaurarlas, solicítelo a un administrador.
        </p>
      )}

      {esAdmin && datos && (
        <>
          <div className="grid lg:grid-cols-3 gap-5">
            {/* Carpeta y recordatorio */}
            <div className={claseTarjeta}>
              <h3 className="font-bold text-sm flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-emerald-600" /> Carpeta de copias
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                El sistema guarda aquí todas las copias (automáticas diarias y manuales):
              </p>
              <code className="block text-xs break-all bg-slate-50 dark:bg-slate-800 rounded-lg p-2">{datos.carpeta}</code>
              <button onClick={abrirCarpeta} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold">
                <FolderOpen className="w-4 h-4" /> Abrir carpeta
              </button>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <label htmlFor="recordatorio-dias" className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mb-1">
                  <BellRing className="w-3.5 h-3.5" /> Recordarme hacer copia cada
                </label>
                <select
                  id="recordatorio-dias"
                  value={estado?.diasRecordatorio || 7}
                  onChange={(e) => cambiarRecordatorio(Number(e.target.value))}
                  className={claseInput}
                >
                  {[1, 3, 7, 15, 30].map((d) => (
                    <option key={d} value={d}>
                      {d === 1 ? 'día' : `${d} días`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Cargar copia */}
            <div className={claseTarjeta}>
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-600" /> Cargar una copia de seguridad
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Traiga una copia guardada en una USB, el correo u otro PC. Se admite el archivo <strong>.db</strong> (copia completa) o el{' '}
                <strong>.json</strong> exportado desde “Datos y Respaldo”.
              </p>
              <ul className="text-[11px] text-slate-500 list-disc pl-4 space-y-0.5">
                <li>.db: queda en la lista de abajo; luego presione “Restaurar”.</li>
                <li>.json: se combina con los datos actuales sin borrar nada.</li>
              </ul>
              <button
                onClick={() => archivoRef.current?.click()}
                disabled={trabajando}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 text-white text-sm font-semibold disabled:opacity-60"
              >
                <Upload className="w-4 h-4" /> Elegir archivo…
              </button>
              <input ref={archivoRef} type="file" accept=".db,.json,application/json" className="hidden" onChange={alElegirArchivo} />
            </div>

            {/* Copia externa automática */}
            <div className={claseTarjeta}>
              <h3 className="font-bold text-sm flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-600" /> Copia automática en otro lugar
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Cada copia se duplica en esta carpeta: otro disco, una USB conectada u OneDrive. Protege si el PC se daña.
              </p>
              <input
                value={carpetaExterna}
                onChange={(e) => setCarpetaExterna(e.target.value)}
                placeholder="Ej. D:\Respaldos VetCompras"
                className={claseInput}
              />
              <button
                onClick={guardarExterna}
                disabled={trabajando}
                className="px-4 py-2 rounded-xl border border-emerald-600 text-emerald-700 dark:text-emerald-300 text-sm font-semibold disabled:opacity-60"
              >
                Guardar y probar
              </button>
              {ext && (
                <p className={`text-xs flex items-center gap-1 ${ext.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {ext.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {fechaHora(ext.fecha)}: {ext.mensaje}
                </p>
              )}
            </div>
          </div>

          {/* Lista */}
          <div className={claseTarjeta}>
            <h3 className="font-bold text-sm flex items-center gap-2">
              <DatabaseBackup className="w-4 h-4 text-emerald-600" /> Copias guardadas ({datos.respaldos.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[560px]">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="py-2">Fecha</th>
                    <th>Origen</th>
                    <th>Tamaño</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {datos.respaldos.map((r) => (
                    <tr key={r.nombre} className={r.nombre === recienCargado ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''}>
                      <td className="py-2">{fechaHora(r.fecha)}</td>
                      <td>{motivoRespaldo(r.nombre)}</td>
                      <td>{megas(r.tamano)}</td>
                      <td className="text-right space-x-2 whitespace-nowrap">
                        <a
                          href={dataService.urlDescargaRespaldo(r.nombre)}
                          onClick={() => setTimeout(cargar, 1500)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                          title="Guardar este archivo en una USB u otro disco"
                        >
                          <Download className="w-3.5 h-3.5" /> Descargar
                        </a>
                        <button
                          onClick={() => setARestaurar(r.nombre)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-400 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Restaurar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {datos.respaldos.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-400">
                        Aún no hay copias. Use “Hacer copia de seguridad”.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={claseTarjeta}>
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Power className="w-4 h-4 text-rose-600" /> Apagar VetCompras en este PC
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Detiene el programa, por ejemplo antes de actualizarlo. Para volver a usarlo, abra el icono VetCompras.
            </p>
            <button onClick={() => setConfirmarApagado(true)} className="px-4 py-2 rounded-xl border border-rose-400 text-rose-700 text-sm font-semibold">
              Apagar
            </button>
          </div>

          <div className={claseTarjeta + ' border-rose-200 dark:border-rose-900'}>
            <h3 className="font-bold text-sm flex items-center gap-2 text-rose-700 dark:text-rose-400">
              <Trash2 className="w-4 h-4" /> Borrar todo y empezar de cero
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Borra compras, ventas, proveedores y catálogos. Antes le pregunta si desea hacer una copia de seguridad. Se conservan los
              datos y el logo de la veterinaria, la bitácora y las copias.
            </p>
            <button
              onClick={() => setBorrarTodoAbierto(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold"
            >
              <Trash2 className="w-4 h-4" /> Borrar todo
            </button>
          </div>
        </>
      )}

      <ModalBorradoSeguro
        abierto={borrarTodoAbierto}
        titulo="Borrar toda la información"
        borra={['Compras, gastos y anexos', 'Ventas y recibos', 'Inventario (productos y movimientos)', 'Fichas de precios', 'Proveedores', 'Catálogos (vuelven a los de fábrica)', 'Observaciones de prueba']}
        conserva={['Datos y logo de la veterinaria', 'Forma de ingreso', 'Bitácora', 'Copias de seguridad']}
        textoBoton="Borrar todo"
        palabraConfirmacion="BORRAR"
        onEjecutar={async () => {
          await dataService.borrarTodo();
          mostrarToast('info', 'Información borrada', 'El sistema quedó en cero. Las copias de seguridad siguen disponibles.');
          cargar();
          onDatosActualizados();
        }}
        onCerrar={() => setBorrarTodoAbierto(false)}
      />

      <ModalConfirmacion
        abierto={!!aRestaurar}
        titulo="¿Restaurar esta copia?"
        mensaje={`La información volverá a como estaba el ${fechaHora(
          datos?.respaldos.find((r) => r.nombre === aRestaurar)?.fecha
        )}. Antes se guarda una copia del estado actual, que podrá restaurar si se arrepiente. Todos deberán ingresar de nuevo.`}
        textoConfirmar="Sí, restaurar"
        tipo="advertencia"
        cargando={trabajando}
        enConfirmar={restaurar}
        enCancelar={() => setARestaurar(null)}
      />
      <ModalConfirmacion
        abierto={!!jsonPorImportar}
        titulo="¿Importar este respaldo JSON?"
        mensaje={`Se combinarán los registros de "${jsonPorImportar?.name}" con los actuales: los que tengan el mismo identificador se reemplazan y no se borra nada más. Antes se crea una copia automática.`}
        textoConfirmar="Sí, importar"
        tipo="advertencia"
        cargando={trabajando}
        enConfirmar={importarJson}
        enCancelar={() => setJsonPorImportar(null)}
      />
      <ModalConfirmacion
        abierto={confirmarApagado}
        titulo="¿Apagar VetCompras?"
        mensaje="Nadie podrá usar el sistema (tampoco desde otros equipos de la red) hasta que se vuelva a abrir."
        textoConfirmar="Sí, apagar"
        tipo="advertencia"
        enConfirmar={async () => {
          await dataService.apagarServidor().catch(() => undefined);
          document.body.innerHTML =
            '<div style="font-family:sans-serif;padding:48px;text-align:center"><h2>VetCompras se apagó.</h2><p>Puede cerrar esta pestaña.</p></div>';
        }}
        enCancelar={() => setConfirmarApagado(false)}
      />
    </div>
  );
};
