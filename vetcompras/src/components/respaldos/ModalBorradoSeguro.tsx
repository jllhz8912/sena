import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, DatabaseBackup, Download, Loader2, Trash2, X } from 'lucide-react';
import { dataService } from '../../services/dataService';

interface ModalBorradoSeguroProps {
  abierto: boolean;
  titulo: string;
  /** Qué se borra */
  borra: string[];
  /** Qué se conserva */
  conserva?: string[];
  textoBoton: string;
  /** Si se indica, hay que escribirla para confirmar (para "Borrar todo") */
  palabraConfirmacion?: string;
  onEjecutar: () => Promise<void>;
  onCerrar: () => void;
}

type Paso = 'copia' | 'confirmar';

/**
 * Antes de cualquier borrado masivo pregunta: "¿Desea hacer una copia de seguridad?".
 * Con "Sí" crea la copia en la carpeta de respaldos (y la descarga si se pide); después
 * pide la confirmación final. Aunque se responda "No", el servidor deja una copia
 * automática interna antes de borrar.
 */
export const ModalBorradoSeguro: React.FC<ModalBorradoSeguroProps> = ({
  abierto,
  titulo,
  borra,
  conserva = [],
  textoBoton,
  palabraConfirmacion,
  onEjecutar,
  onCerrar,
}) => {
  const [paso, setPaso] = useState<Paso>('copia');
  const [copia, setCopia] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [palabra, setPalabra] = useState('');

  useEffect(() => {
    if (abierto) {
      setPaso('copia');
      setCopia(null);
      setError(null);
      setPalabra('');
    }
  }, [abierto]);

  if (!abierto) return null;

  const hacerCopia = async (descargar: boolean) => {
    setTrabajando(true);
    setError(null);
    try {
      const ruta = await dataService.crearRespaldoEnDisco();
      setCopia(ruta);
      if (descargar) window.location.href = dataService.urlDescargaRespaldo(ruta.split(/[\\/]/).pop()!);
      setPaso('confirmar');
    } catch (e: any) {
      setError(`No se pudo hacer la copia: ${e?.message || 'error desconocido'}. No se borró nada.`);
    } finally {
      setTrabajando(false);
    }
  };

  const ejecutar = async () => {
    setTrabajando(true);
    setError(null);
    try {
      await onEjecutar();
      onCerrar();
    } catch (e: any) {
      setError(e?.message || 'No se pudo completar el borrado.');
    } finally {
      setTrabajando(false);
    }
  };

  const palabraOk = !palabraConfirmacion || palabra.trim().toUpperCase() === palabraConfirmacion;

  // Portal al body: si se abre desde la barra superior (con desenfoque), "fixed" quedaría atrapado en ella
  return createPortal(
    <div className="fixed inset-0 z-[80] bg-slate-950/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-900 dark:text-white">{titulo}</h3>
            <p className="text-[11px] font-semibold text-slate-400">Paso {paso === 'copia' ? 1 : 2} de 2</p>
          </div>
          <button onClick={onCerrar} disabled={trabajando} className="text-slate-400 hover:text-slate-600" title="Cancelar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-3">
            <p className="font-bold text-rose-800 dark:text-rose-300 mb-1">Se borra</p>
            <ul className="list-disc pl-4 space-y-0.5 text-rose-900 dark:text-rose-200">
              {borra.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
          {conserva.length > 0 && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-3">
              <p className="font-bold text-emerald-800 dark:text-emerald-300 mb-1">Se conserva</p>
              <ul className="list-disc pl-4 space-y-0.5 text-emerald-900 dark:text-emerald-200">
                {conserva.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {paso === 'copia' ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 p-4 flex gap-3">
              <DatabaseBackup className="w-6 h-6 text-amber-600 shrink-0" />
              <div>
                <p className="font-bold text-amber-900 dark:text-amber-200">¿Desea hacer una copia de seguridad antes de borrar?</p>
                <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                  La copia queda en la carpeta de respaldos y la puede restaurar desde “Copias de Seguridad” si se arrepiente.
                </p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <button
                onClick={() => hacerCopia(false)}
                disabled={trabajando}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold"
              >
                {trabajando ? <Loader2 className="w-4 h-4 animate-spin" /> : <DatabaseBackup className="w-4 h-4" />} Sí, hacer copia
              </button>
              <button
                onClick={() => hacerCopia(true)}
                disabled={trabajando}
                className="flex items-center justify-center gap-2 py-3 rounded-xl border border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 disabled:opacity-60 text-sm font-bold"
              >
                <Download className="w-4 h-4" /> Sí, y descargarla (USB)
              </button>
            </div>
            <div className="flex justify-between gap-2">
              <button onClick={onCerrar} disabled={trabajando} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Cancelar
              </button>
              <button
                onClick={() => setPaso('confirmar')}
                disabled={trabajando}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                No, continuar sin copia
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {copia ? (
              <p className="text-xs rounded-xl px-3 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-900 flex gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="break-all">Copia de seguridad guardada: {copia}</span>
              </p>
            ) : (
              <p className="text-xs rounded-xl px-3 py-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-900 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Eligió no hacer copia. El sistema igual deja una copia automática interna (“antes de borrar”) en Copias de Seguridad.
              </p>
            )}
            {palabraConfirmacion && (
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Para confirmar, escriba <strong className="text-rose-600">{palabraConfirmacion}</strong>
                </span>
                <input
                  value={palabra}
                  onChange={(e) => setPalabra(e.target.value)}
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </label>
            )}
            <div className="flex justify-between gap-2">
              <button onClick={onCerrar} disabled={trabajando} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Cancelar
              </button>
              <button
                onClick={ejecutar}
                disabled={trabajando || !palabraOk}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-bold"
              >
                {trabajando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} {textoBoton}
              </button>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-xs rounded-xl px-3 py-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-900">
            {error}
          </p>
        )}
      </div>
    </div>,
    document.body
  );
};
