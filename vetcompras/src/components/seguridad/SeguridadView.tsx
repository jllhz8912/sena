import React, { useCallback, useEffect, useState } from 'react';
import {
  Users,
  DatabaseBackup,
  History,
  UserPlus,
  KeyRound,
  UserX,
  UserCheck,
  Download,
  RotateCcw,
  HardDrive,
  Save,
  Search,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Power,
  Loader2,
} from 'lucide-react';
import { dataService, Rol, UsuarioActual } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { ModalConfirmacion } from '../common/ModalConfirmacion';
import { problemaClave } from './PantallaAcceso';

type UsuarioFila = UsuarioActual & { activo: boolean; creadoEn: string; ultimoAcceso: string | null };
type Respaldos = Awaited<ReturnType<typeof dataService.listarRespaldos>>;
type Evento = Awaited<ReturnType<typeof dataService.listarAuditoria>>[number];

const claseInput =
  'w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500';
const claseTarjeta = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4';

const fechaHora = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const megas = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Explica en palabras simples de dónde salió cada respaldo. */
function motivoRespaldo(nombre: string): string {
  if (nombre.includes('diario')) return 'Automático diario';
  if (nombre.includes('manual')) return 'Creado manualmente';
  if (nombre.includes('antes-de-actualizar')) return 'Antes de actualizar el programa';
  if (nombre.includes('antes-de-restaurar')) return 'Antes de restaurar otro respaldo';
  if (nombre.includes('antes-de-importar')) return 'Antes de importar un archivo';
  if (nombre.includes('antes-de-limpiar')) return 'Antes de borrar registros';
  if (nombre.includes('antes-de-cargar-demo')) return 'Antes de cargar datos de demostración';
  if (nombre.includes('antes-de-restablecer')) return 'Antes de restablecer el sistema';
  return 'Respaldo';
}

// ============================================================== USUARIOS
const PanelUsuarios: React.FC = () => {
  const { mostrarToast } = useToast();
  const [usuarios, setUsuarios] = useState<UsuarioFila[]>([]);
  const [nuevo, setNuevo] = useState({ nombre: '', usuario: '', rol: 'auxiliar' as Rol, clave: '', confirmacion: '' });
  const [guardando, setGuardando] = useState(false);
  const [restableciendo, setRestableciendo] = useState<UsuarioFila | null>(null);
  const [claveTemporal, setClaveTemporal] = useState('');
  const yo = dataService.usuarioActual();

  const cargar = useCallback(() => {
    dataService.listarUsuarios().then(setUsuarios).catch((e) => mostrarToast('error', 'Usuarios', e.message));
  }, [mostrarToast]);

  useEffect(cargar, [cargar]);

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    const problema = problemaClave(nuevo.clave, nuevo.confirmacion);
    if (problema) return mostrarToast('error', 'Contraseña', problema);
    setGuardando(true);
    try {
      await dataService.crearUsuario({ nombre: nuevo.nombre, usuario: nuevo.usuario, rol: nuevo.rol, clave: nuevo.clave });
      mostrarToast('success', 'Usuario creado', `Entregue a ${nuevo.nombre} su usuario y la contraseña temporal. Deberá cambiarla al ingresar.`);
      setNuevo({ nombre: '', usuario: '', rol: 'auxiliar', clave: '', confirmacion: '' });
      cargar();
    } catch (err: any) {
      mostrarToast('error', 'No se creó el usuario', err.message);
    } finally {
      setGuardando(false);
    }
  };

  const cambiar = async (u: UsuarioFila, cambios: { rol?: Rol; activo?: boolean }, mensaje: string) => {
    try {
      await dataService.actualizarUsuario(u.id, cambios);
      mostrarToast('success', 'Usuario actualizado', mensaje);
      cargar();
    } catch (err: any) {
      mostrarToast('error', 'No se pudo actualizar', err.message);
    }
  };

  const confirmarRestablecer = async () => {
    if (!restableciendo) return;
    const problema = problemaClave(claveTemporal, claveTemporal);
    if (problema) return mostrarToast('error', 'Contraseña temporal', problema);
    try {
      await dataService.restablecerClaveUsuario(restableciendo.id, claveTemporal);
      mostrarToast('success', 'Contraseña restablecida', `${restableciendo.nombre} deberá cambiarla al ingresar.`);
      setRestableciendo(null);
      setClaveTemporal('');
    } catch (err: any) {
      mostrarToast('error', 'No se pudo restablecer', err.message);
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <div className={claseTarjeta + ' lg:col-span-2'}>
        <h3 className="font-bold text-sm flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-600" /> Personas con acceso
        </h3>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {usuarios.map((u) => (
            <div key={u.id} className={`py-3 flex flex-wrap items-center gap-3 ${u.activo ? '' : 'opacity-50'}`}>
              <div className="flex-1 min-w-[180px]">
                <p className="text-sm font-semibold">
                  {u.nombre} {u.id === yo?.id && <span className="text-[11px] text-emerald-600">(usted)</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {u.usuario} · Último ingreso: {fechaHora(u.ultimoAcceso)}
                  {!u.activo && ' · DESACTIVADO'}
                </p>
              </div>
              <select
                value={u.rol}
                disabled={u.id === yo?.id}
                onChange={(e) => cambiar(u, { rol: e.target.value as Rol }, `${u.nombre} ahora es ${e.target.value}.`)}
                className="px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              >
                <option value="administrador">Administrador</option>
                <option value="auxiliar">Auxiliar</option>
              </select>
              <button
                onClick={() => setRestableciendo(u)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                title="Asignar una contraseña temporal"
              >
                <KeyRound className="w-3.5 h-3.5" /> Contraseña
              </button>
              {u.id !== yo?.id && (
                <button
                  onClick={() =>
                    cambiar(u, { activo: !u.activo }, u.activo ? `${u.nombre} ya no puede ingresar.` : `${u.nombre} puede ingresar de nuevo.`)
                  }
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border ${
                    u.activo ? 'border-rose-300 text-rose-700 hover:bg-rose-50' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  {u.activo ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                  {u.activo ? 'Desactivar' : 'Activar'}
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 space-y-1">
          <p>
            <strong>Administrador:</strong> todo, incluido borrar registros, configurar la veterinaria, catálogos, usuarios y respaldos.
          </p>
          <p>
            <strong>Auxiliar:</strong> registra y edita compras, facturas y ventas, y consulta reportes. No puede borrar ni cambiar la configuración.
          </p>
          <p>Los usuarios no se eliminan (para conservar la trazabilidad): se desactivan.</p>
        </div>
      </div>

      <form onSubmit={crear} className={claseTarjeta}>
        <h3 className="font-bold text-sm flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-emerald-600" /> Agregar persona
        </h3>
        <input placeholder="Nombre completo" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} className={claseInput} />
        <input
          placeholder="Usuario (ej. maria.lopez)"
          value={nuevo.usuario}
          onChange={(e) => setNuevo({ ...nuevo, usuario: e.target.value.replace(/\s/g, '').toLowerCase() })}
          className={claseInput}
        />
        <select value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value as Rol })} className={claseInput}>
          <option value="auxiliar">Auxiliar</option>
          <option value="administrador">Administrador</option>
        </select>
        <input type="password" placeholder="Contraseña temporal" value={nuevo.clave} onChange={(e) => setNuevo({ ...nuevo, clave: e.target.value })} className={claseInput} autoComplete="new-password" />
        <input type="password" placeholder="Repita la contraseña" value={nuevo.confirmacion} onChange={(e) => setNuevo({ ...nuevo, confirmacion: e.target.value })} className={claseInput} autoComplete="new-password" />
        <p className="text-[11px] text-slate-500">La persona deberá cambiarla la primera vez que ingrese.</p>
        <button disabled={guardando} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-60">
          Crear usuario
        </button>
      </form>

      {restableciendo && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold">Contraseña temporal para {restableciendo.nombre}</h3>
            <p className="text-xs text-slate-500">Se cerrarán sus sesiones abiertas y deberá cambiarla al ingresar.</p>
            <input type="text" value={claveTemporal} onChange={(e) => setClaveTemporal(e.target.value)} className={claseInput} placeholder="Ej. Clinica2026" autoFocus />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRestableciendo(null)} className="px-4 py-2 rounded-xl border text-sm">
                Cancelar
              </button>
              <button onClick={confirmarRestablecer} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold">
                Asignar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================== RESPALDOS
const PanelRespaldos: React.FC<{ onRestaurado: () => void }> = ({ onRestaurado }) => {
  const { mostrarToast } = useToast();
  const [datos, setDatos] = useState<Respaldos | null>(null);
  const [carpetaExterna, setCarpetaExterna] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [aRestaurar, setARestaurar] = useState<string | null>(null);
  const [confirmarApagado, setConfirmarApagado] = useState(false);

  const cargar = useCallback(() => {
    dataService
      .listarRespaldos()
      .then((d) => {
        setDatos(d);
        setCarpetaExterna(d.carpetaExterna);
      })
      .catch((e) => mostrarToast('error', 'Respaldos', e.message));
  }, [mostrarToast]);

  useEffect(cargar, [cargar]);

  const crearAhora = async () => {
    setTrabajando(true);
    try {
      await dataService.crearRespaldoEnDisco();
      mostrarToast('success', 'Respaldo creado', 'Se guardó una copia completa de la información.');
      cargar();
    } catch (e: any) {
      mostrarToast('error', 'No se creó el respaldo', e.message);
    } finally {
      setTrabajando(false);
    }
  };

  const guardarExterna = async () => {
    setTrabajando(true);
    try {
      const r = await dataService.configurarRespaldoExterno(carpetaExterna);
      if (!carpetaExterna) mostrarToast('info', 'Copia externa desactivada', 'Los respaldos quedan solo en este PC.');
      else if (r.ultimoRespaldoExterno?.ok) mostrarToast('success', 'Copia externa activada', r.ultimoRespaldoExterno.mensaje);
      else mostrarToast('error', 'Revise la carpeta', r.ultimoRespaldoExterno?.mensaje || 'No se pudo copiar.');
      cargar();
    } catch (e: any) {
      mostrarToast('error', 'Carpeta no válida', e.message);
    } finally {
      setTrabajando(false);
    }
  };

  const restaurar = async () => {
    if (!aRestaurar) return;
    setTrabajando(true);
    try {
      await dataService.restaurarRespaldo(aRestaurar);
      mostrarToast('success', 'Información restaurada', 'Ingrese de nuevo para continuar.');
      setARestaurar(null);
      onRestaurado();
    } catch (e: any) {
      mostrarToast('error', 'No se restauró', e.message);
    } finally {
      setTrabajando(false);
    }
  };

  if (!datos) return <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />;
  const ext = datos.ultimoRespaldoExterno;

  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-2 gap-5">
        <div className={claseTarjeta}>
          <h3 className="font-bold text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Cómo se protege la información
          </h3>
          <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-disc pl-4">
            <li>Un respaldo automático cada día (se guardan los últimos 30).</li>
            <li>Un respaldo antes de actualizar el programa, borrar, importar o restaurar.</li>
            <li>
              Carpeta de datos: <code className="break-all">{datos.carpeta.replace(/[\\/]respaldos$/, '')}</code>
            </li>
          </ul>
          <button
            onClick={crearAhora}
            disabled={trabajando}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-60"
          >
            <Save className="w-4 h-4" /> Crear respaldo ahora
          </button>
        </div>

        <div className={claseTarjeta}>
          <h3 className="font-bold text-sm flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-emerald-600" /> Copia en otro lugar (recomendado)
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Si el PC se daña o se pierde, los respaldos de este equipo se pierden con él. Indique una carpeta en otro disco, una
            memoria USB o una carpeta sincronizada (OneDrive, Google Drive) y cada respaldo se copiará también allí.
          </p>
          <input
            value={carpetaExterna}
            onChange={(e) => setCarpetaExterna(e.target.value)}
            placeholder="Ej. D:\Respaldos VetCompras  o  C:\Users\...\OneDrive\VetCompras"
            className={claseInput}
          />
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={guardarExterna}
              disabled={trabajando}
              className="px-4 py-2 rounded-xl border border-emerald-600 text-emerald-700 dark:text-emerald-300 text-sm font-semibold disabled:opacity-60"
            >
              Guardar y probar
            </button>
            {ext && (
              <span className={`text-xs flex items-center gap-1 ${ext.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                {ext.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {fechaHora(ext.fecha)}: {ext.mensaje}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={claseTarjeta}>
        <h3 className="font-bold text-sm flex items-center gap-2">
          <DatabaseBackup className="w-4 h-4 text-emerald-600" /> Respaldos guardados en este PC
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
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
                <tr key={r.nombre}>
                  <td className="py-2">{fechaHora(r.fecha)}</td>
                  <td>{motivoRespaldo(r.nombre)}</td>
                  <td>{megas(r.tamano)}</td>
                  <td className="text-right space-x-2 whitespace-nowrap">
                    <a
                      href={dataService.urlDescargaRespaldo(r.nombre)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                      title="Guardar una copia (por ejemplo en una USB)"
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
                    Aún no hay respaldos. Use “Crear respaldo ahora”.
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
          Detiene el programa (por ejemplo antes de copiar la carpeta de datos o de actualizar). Para volver a usarlo, abra el
          icono VetCompras del escritorio.
        </p>
        <button onClick={() => setConfirmarApagado(true)} className="px-4 py-2 rounded-xl border border-rose-400 text-rose-700 text-sm font-semibold">
          Apagar
        </button>
      </div>

      <ModalConfirmacion
        abierto={!!aRestaurar}
        titulo="¿Restaurar este respaldo?"
        mensaje={`La información volverá a como estaba el ${fechaHora(
          datos.respaldos.find((r) => r.nombre === aRestaurar)?.fecha
        )}. Lo registrado después NO se pierde del todo: antes se guarda un respaldo del estado actual, que podrá restaurar si se arrepiente. Todos deberán ingresar de nuevo.`}
        textoConfirmar="Sí, restaurar"
        tipo="advertencia"
        cargando={trabajando}
        enConfirmar={restaurar}
        enCancelar={() => setARestaurar(null)}
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

// ============================================================== BITÁCORA
const PanelActividad: React.FC = () => {
  const { mostrarToast } = useToast();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [texto, setTexto] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      dataService.listarAuditoria(texto).then(setEventos).catch((e) => mostrarToast('error', 'Actividad', e.message));
    }, 300);
    return () => clearTimeout(t);
  }, [texto, mostrarToast]);

  return (
    <div className={claseTarjeta}>
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <History className="w-4 h-4 text-emerald-600" /> Quién hizo qué y cuándo
        </h3>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar usuario, acción o factura" className={claseInput + ' pl-9'} />
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Registro permanente de ingresos, intentos fallidos, creaciones, modificaciones, eliminaciones y respaldos. No se puede editar ni borrar desde la aplicación.
      </p>
      <div className="overflow-x-auto max-h-[60vh]">
        <table className="w-full text-xs">
          <thead className="text-left text-slate-500 sticky top-0 bg-white dark:bg-slate-900">
            <tr>
              <th className="py-2 pr-3">Fecha y hora</th>
              <th className="pr-3">Usuario</th>
              <th className="pr-3">Acción</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {eventos.map((e, i) => (
              <tr key={i} className={e.accion.includes('fallido') || e.accion.startsWith('Eliminó') ? 'bg-rose-50/60 dark:bg-rose-950/20' : ''}>
                <td className="py-2 pr-3 whitespace-nowrap">{fechaHora(e.fecha)}</td>
                <td className="pr-3">{e.usuario}</td>
                <td className="pr-3 font-medium">{e.accion}</td>
                <td className="text-slate-500 break-all">{e.detalle}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================== VISTA
export const SeguridadView: React.FC<{ onSesionTerminada: () => void }> = ({ onSesionTerminada }) => {
  const [pestana, setPestana] = useState<'usuarios' | 'respaldos' | 'actividad'>('respaldos');
  const pestanas = [
    { id: 'respaldos' as const, label: 'Respaldos', icon: DatabaseBackup },
    { id: 'usuarios' as const, label: 'Usuarios y permisos', icon: Users },
    { id: 'actividad' as const, label: 'Bitácora de actividad', icon: History },
  ];

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap">
        {pestanas.map(({ id, label, icon: Icono }) => (
          <button
            key={id}
            onClick={() => setPestana(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
              pestana === id
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <Icono className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>
      {pestana === 'usuarios' && <PanelUsuarios />}
      {pestana === 'respaldos' && <PanelRespaldos onRestaurado={onSesionTerminada} />}
      {pestana === 'actividad' && <PanelActividad />}
    </div>
  );
};
