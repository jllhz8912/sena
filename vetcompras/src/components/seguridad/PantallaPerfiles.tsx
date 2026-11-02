import React, { useState } from 'react';
import { KeyRound, Loader2, LogOut, Settings2, ShoppingCart, ReceiptText, ShieldCheck, UserRound } from 'lucide-react';
import { dataService } from '../../services/dataService';
import { logoDe } from '../../data/marca';
import { ID_ADMINISTRACION, MODULOS_SISTEMA, PerfilAcceso, modulosDe } from '../../utils/perfiles';

interface PantallaPerfilesProps {
  perfiles: PerfilAcceso[];
  onElegido: (perfil: PerfilAcceso) => void;
  onSalir: () => void;
}

const icono = (id: string) => (id === 'ventas' ? ShoppingCart : id === 'compras' ? ReceiptText : id === ID_ADMINISTRACION ? ShieldCheck : UserRound);

/** Después de "Ingresar": elegir con qué perfil se trabaja (y su PIN, si lo tiene). */
export const PantallaPerfiles: React.FC<PantallaPerfilesProps> = ({ perfiles, onElegido, onSalir }) => {
  const empresa = dataService.obtenerDatosEmpresa();
  const [conPin, setConPin] = useState<PerfilAcceso | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [entrando, setEntrando] = useState<string | null>(null);

  const entrar = async (perfil: PerfilAcceso, pinEscrito?: string) => {
    setError('');
    setEntrando(perfil.id);
    try {
      onElegido(await dataService.entrarConPerfil(perfil.id, pinEscrito));
    } catch (err: any) {
      setError(err?.message || 'No se pudo entrar con ese perfil.');
      setPin('');
    } finally {
      setEntrando(null);
    }
  };

  const elegir = (perfil: PerfilAcceso) => {
    if (perfil.tienePin) {
      setConPin(perfil);
      setPin('');
      setError('');
    } else entrar(perfil);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl space-y-8">
        <header className="flex flex-col items-center text-center gap-3">
          {logoDe(empresa) && <img src={logoDe(empresa)} alt="" className="w-20 h-20 rounded-full object-contain bg-white border border-slate-200 dark:border-slate-700 shadow-sm" />}
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">¿Con qué perfil va a trabajar?</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl">Cada perfil ve solo los módulos de su área. Administración ve todo y define los permisos.</p>
        </header>

        <div className={`grid grid-cols-1 gap-4 ${perfiles.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`} role="list">
          {perfiles.map((p) => {
            const Icono = icono(p.id);
            const modulos = MODULOS_SISTEMA.filter((m) => modulosDe(p).has(m.id));
            const esAdmin = p.id === ID_ADMINISTRACION;
            return (
              <button
                key={p.id}
                role="listitem"
                id={`perfil-${p.id}`}
                type="button"
                disabled={!!entrando}
                onClick={() => elegir(p)}
                className={`group text-left p-6 rounded-3xl border-2 bg-white dark:bg-slate-900 transition-all hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400 disabled:opacity-60 ${
                  esAdmin ? 'border-slate-800 dark:border-slate-300' : 'border-emerald-200 dark:border-emerald-900 hover:border-emerald-500'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className={`w-14 h-14 rounded-2xl flex items-center justify-center ${esAdmin ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'}`}>
                    <Icono className="w-7 h-7" />
                  </span>
                  {p.tienePin && (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      <KeyRound className="w-3.5 h-3.5" /> Con PIN
                    </span>
                  )}
                </div>
                <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">{p.nombre}</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 min-h-[2.5rem]">{p.descripcion}</p>
                <ul className="mt-3 flex flex-wrap gap-1">
                  {modulos.slice(0, esAdmin ? 4 : 8).map((m) => (
                    <li key={m.id} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                      {m.label.split(' (')[0]}
                    </li>
                  ))}
                  {esAdmin && <li className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300">y todos los demás</li>}
                </ul>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  {entrando === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Entrar como {p.nombre}
                </span>
              </button>
            );
          })}
        </div>

        {error && !conPin && <p className="text-center text-sm font-semibold text-rose-600" role="alert">{error}</p>}

        <div className="flex justify-center">
          <button onClick={onSalir} className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
            <LogOut className="w-4 h-4" /> Volver a la pantalla de inicio
          </button>
        </div>
      </div>

      {conPin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="pin-titulo">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              entrar(conPin, pin);
            }}
            className="w-full max-w-sm p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-emerald-600" />
              <h2 id="pin-titulo" className="text-lg font-bold text-slate-900 dark:text-white">PIN de {conPin.nombre}</h2>
            </div>
            <input
              id="pin-perfil"
              autoFocus
              inputMode="numeric"
              type="password"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-2xl tracking-[0.5em] text-center font-bold"
              aria-label="PIN"
            />
            {error && <p className="text-sm font-semibold text-rose-600" role="alert">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setConPin(null)} className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold">
                Cancelar
              </button>
              <button type="submit" id="pin-entrar" disabled={pin.length < 4 || !!entrando} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50">
                Entrar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
