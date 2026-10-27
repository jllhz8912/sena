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
  MessageSquare,
} from 'lucide-react';
import { dataService, Rol, UsuarioActual } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { ModalConfirmacion } from '../common/ModalConfirmacion';
import { problemaClave } from './PantallaAcceso';
import { PanelObservaciones } from '../prueba/PanelObservaciones';

type UsuarioFila = UsuarioActual & { activo: boolean; creadoEn: string; ultimoAcceso: string | null };
type Evento = Awaited<ReturnType<typeof dataService.listarAuditoria>>[number];

const claseInput =
  'w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500';
const claseTarjeta = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4';

const fechaHora = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—';


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
  const [pestana, setPestana] = useState<'usuarios' | 'actividad' | 'observaciones'>(
    dataService.etapa() === 'prueba' ? 'observaciones' : 'usuarios'
  );
  const pestanas = [
    ...(dataService.etapa() === 'prueba' ? [{ id: 'observaciones' as const, label: 'Observaciones de prueba', icon: MessageSquare }] : []),
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
      {pestana === 'actividad' && <PanelActividad />}
      {pestana === 'observaciones' && <PanelObservaciones />}
    </div>
  );
};
