import React, { useState } from 'react';
import { KeyRound, X } from 'lucide-react';
import { dataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { problemaClave } from './PantallaAcceso';

const claseInput =
  'w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';

export const ModalCambiarClave: React.FC<{ onCerrar: () => void }> = ({ onCerrar }) => {
  const { mostrarToast } = useToast();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const problema = problemaClave(nueva, confirmacion);
    if (problema) return setError(problema);
    setGuardando(true);
    try {
      await dataService.cambiarClave(actual, nueva);
      mostrarToast('success', 'Contraseña actualizada', 'Se cerraron sus sesiones abiertas en otros equipos.');
      onCerrar();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
      <form onSubmit={guardar} className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm space-y-3 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-emerald-600" /> Cambiar mi contraseña
          </h3>
          <button type="button" onClick={onCerrar} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <input type="password" placeholder="Contraseña actual" value={actual} onChange={(e) => setActual(e.target.value)} className={claseInput} autoComplete="current-password" autoFocus />
        <input type="password" placeholder="Nueva contraseña" value={nueva} onChange={(e) => setNueva(e.target.value)} className={claseInput} autoComplete="new-password" />
        <input type="password" placeholder="Repita la nueva contraseña" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} className={claseInput} autoComplete="new-password" />
        <p className="text-[11px] text-slate-500">Mínimo 8 caracteres, combinando letras y números.</p>
        {error && <p className="text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2">{error}</p>}
        <button disabled={guardando} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-60">
          Guardar
        </button>
      </form>
    </div>
  );
};
