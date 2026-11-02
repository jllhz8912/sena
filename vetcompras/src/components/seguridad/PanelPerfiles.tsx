import React, { useEffect, useState } from 'react';
import { KeyRound, Lock, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { dataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { ModalConfirmacion } from '../common/ModalConfirmacion';
import { ID_ADMINISTRACION, MODULOS_SISTEMA, PerfilAcceso } from '../../utils/perfiles';

type PerfilEditable = PerfilAcceso & { pin?: string; quitarPin?: boolean; nuevo?: boolean };

const claseInput = 'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs';
const GRUPOS = ['Ventas', 'Compras', 'Gestión', 'Sistema'] as const;

/**
 * Perfiles de ingreso y sus permisos: qué módulos ve cada perfil, su nombre, su
 * descripción y un PIN opcional. Administración siempre ve todo.
 */
export const PanelPerfiles: React.FC = () => {
  const { mostrarToast } = useToast();
  const [perfiles, setPerfiles] = useState<PerfilEditable[] | null>(null);
  const [cambios, setCambios] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [restaurar, setRestaurar] = useState(false);
  const [aEliminar, setAEliminar] = useState<PerfilEditable | null>(null);

  const cargar = () =>
    dataService
      .obtenerPerfiles()
      .then((p) => {
        setPerfiles(p);
        setCambios(false);
      })
      .catch((err) => mostrarToast('error', 'No se pudieron cargar los perfiles', err?.message));
  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const editar = (id: string, c: Partial<PerfilEditable>) => {
    setPerfiles((ps) => ps!.map((p) => (p.id === id ? { ...p, ...c } : p)));
    setCambios(true);
  };
  const alternar = (p: PerfilEditable, modulo: string) =>
    editar(p.id, { modulos: p.modulos.includes(modulo) ? p.modulos.filter((m) => m !== modulo) : [...p.modulos, modulo] });

  const agregar = () => {
    const id = `perfil_${Date.now().toString(36)}`;
    setPerfiles((ps) => [...ps!, { id, nombre: 'Nuevo perfil', descripcion: '', modulos: ['ventas'], nuevo: true }]);
    setCambios(true);
  };

  const guardar = async () => {
    if (!perfiles) return;
    const malPin = perfiles.find((p) => p.pin && !/^\d{4,8}$/.test(p.pin));
    if (malPin) return mostrarToast('warning', 'PIN no válido', `El PIN de ${malPin.nombre} debe tener de 4 a 8 números.`);
    setGuardando(true);
    try {
      const guardados = await dataService.guardarPerfiles(perfiles.map(({ nuevo, ...p }) => ({ ...p, id: nuevo ? '' : p.id })));
      setPerfiles(guardados);
      setCambios(false);
      mostrarToast('success', 'Perfiles guardados', 'Los cambios aplican la próxima vez que alguien elija su perfil.');
    } catch (err: any) {
      mostrarToast('error', 'No se pudo guardar', err?.message);
    } finally {
      setGuardando(false);
    }
  };

  if (!perfiles) return <div className="p-5 text-xs text-slate-500">Cargando perfiles…</div>;
  const adminSinPin = perfiles.find((p) => p.id === ID_ADMINISTRACION && !p.tienePin && !p.pin);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h3 className="font-bold text-slate-900 dark:text-white">Perfiles y permisos</h3>
          <p className="text-xs text-slate-500">
            Después de “Ingresar” cada persona elige su perfil y solo ve los módulos marcados. Administración siempre ve todo. Ponga un PIN a los perfiles
            que no todos deben usar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setRestaurar(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold">
            <RotateCcw className="w-4 h-4" /> Restaurar los de fábrica
          </button>
          <button onClick={agregar} id="agregar-perfil" className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-600 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
            <Plus className="w-4 h-4" /> Nuevo perfil
          </button>
          <button onClick={guardar} id="guardar-perfiles" disabled={!cambios || guardando} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">
            <Save className="w-4 h-4" /> {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {adminSinPin && (
        <p className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
          <strong>Recomendado:</strong> Administración no tiene PIN, así que cualquier persona puede entrar con ese perfil y ver todos los módulos. Asígnele un PIN abajo.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[760px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-slate-500">
              <th className="text-left p-2 w-56">Módulo</th>
              {perfiles.map((p) => (
                <th key={p.id} className="p-2 align-top min-w-[150px]">
                  <input
                    value={p.nombre}
                    onChange={(e) => editar(p.id, { nombre: e.target.value })}
                    className={claseInput + ' font-bold text-center normal-case'}
                    aria-label={`Nombre del perfil ${p.nombre}`}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRUPOS.map((g) => (
              <React.Fragment key={g}>
                <tr>
                  <td colSpan={perfiles.length + 1} className="pt-3 pb-1 px-2 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                    {g}
                  </td>
                </tr>
                {MODULOS_SISTEMA.filter((m) => m.grupo === g).map((m) => (
                  <tr key={m.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="p-2 text-slate-700 dark:text-slate-300">{m.label}</td>
                    {perfiles.map((p) => {
                      const esAdmin = p.id === ID_ADMINISTRACION;
                      return (
                        <td key={p.id} className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={esAdmin || p.modulos.includes(m.id)}
                            disabled={esAdmin}
                            onChange={() => alternar(p, m.id)}
                            aria-label={`${p.nombre}: ${m.label}`}
                            className="w-4 h-4 accent-emerald-600"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
            <tr className="border-t-2 border-slate-200 dark:border-slate-700">
              <td className="p-2 font-semibold text-slate-700 dark:text-slate-300">Descripción</td>
              {perfiles.map((p) => (
                <td key={p.id} className="p-2">
                  <textarea
                    rows={2}
                    value={p.descripcion}
                    onChange={(e) => editar(p.id, { descripcion: e.target.value })}
                    className={claseInput}
                    aria-label={`Descripción de ${p.nombre}`}
                  />
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-2 font-semibold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4" /> PIN (4 a 8 números)
                </span>
              </td>
              {perfiles.map((p) => (
                <td key={p.id} className="p-2 space-y-1">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    value={p.pin || ''}
                    onChange={(e) => editar(p.id, { pin: e.target.value.replace(/\D/g, ''), quitarPin: false })}
                    placeholder={p.tienePin && !p.quitarPin ? '•••• (sin cambio)' : 'Sin PIN'}
                    className={claseInput + ' text-center'}
                    aria-label={`PIN de ${p.nombre}`}
                    id={`pin-${p.id}`}
                  />
                  {p.tienePin && !p.quitarPin && (
                    <button type="button" onClick={() => editar(p.id, { quitarPin: true, pin: '' })} className="text-[10px] font-semibold text-rose-600">
                      Quitar PIN
                    </button>
                  )}
                  {p.quitarPin && <span className="block text-[10px] text-rose-600">Se quitará al guardar</span>}
                </td>
              ))}
            </tr>
            <tr>
              <td />
              {perfiles.map((p) => (
                <td key={p.id} className="p-2 text-center">
                  {p.id === ID_ADMINISTRACION ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                      <Lock className="w-3 h-3" /> Siempre ve todo
                    </span>
                  ) : (
                    <button type="button" onClick={() => setAEliminar(p)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600" aria-label={`Eliminar perfil ${p.nombre}`}>
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar
                    </button>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <ModalConfirmacion
        abierto={!!aEliminar}
        titulo="¿Eliminar el perfil?"
        mensaje={`"${aEliminar?.nombre}" deja de aparecer al ingresar (después de guardar). Los registros hechos con ese perfil no cambian.`}
        enConfirmar={() => {
          setPerfiles((ps) => ps!.filter((p) => p.id !== aEliminar!.id));
          setCambios(true);
          setAEliminar(null);
        }}
        enCancelar={() => setAEliminar(null)}
      />
      <ModalConfirmacion
        abierto={restaurar}
        tipo="advertencia"
        titulo="¿Restaurar los perfiles de fábrica?"
        mensaje="Vuelven Ventas, Compras y Gastos y Administración con sus módulos iniciales y sin PIN. Se pierden los perfiles creados."
        textoConfirmar="Restaurar"
        enConfirmar={async () => {
          setRestaurar(false);
          try {
            setPerfiles(await dataService.restaurarPerfiles());
            setCambios(false);
            mostrarToast('success', 'Perfiles restaurados', 'Se restauraron los perfiles de fábrica.');
          } catch (err: any) {
            mostrarToast('error', 'No se pudo restaurar', err?.message);
          }
        }}
        enCancelar={() => setRestaurar(false)}
      />
    </div>
  );
};
