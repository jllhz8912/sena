import React, { useRef, useState } from 'react';
import { CheckCircle2, ClipboardCopy, FileKey2, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { dataService, EstadoLicencia } from '../../services/dataService';
import { PRODUCTO } from '../../data/marca';

interface Props {
  estado: EstadoLicencia;
  onActivada: (estado: EstadoLicencia) => void;
}

/**
 * Primera pantalla de un equipo sin licencia: muestra el código de este PC para
 * pedir la licencia al proveedor y recibe la clave (pegada o en archivo .lic).
 */
export const PantallaActivacion: React.FC<Props> = ({ estado, onActivada }) => {
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(estado.cliente ? estado.motivo || null : null);
  const [copiado, setCopiado] = useState<'codigo' | 'solicitud' | null>(null);
  const [activando, setActivando] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);

  const copiar = async (texto: string, que: 'codigo' | 'solicitud') => {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      const t = document.createElement('textarea');
      t.value = texto;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
    setCopiado(que);
    setTimeout(() => setCopiado(null), 2500);
  };

  const solicitud = `Solicitud de licencia - ${PRODUCTO.nombreCompleto}\nCódigo de equipo: ${estado.equipo}\nEmpresa: \nNIT o cédula: \nContacto: `;

  const activar = async (valor = clave) => {
    if (!valor.trim()) return setError('Pegue la clave de licencia o cargue el archivo .lic que le envió su proveedor.');
    setActivando(true);
    setError(null);
    try {
      onActivada(await dataService.activarLicencia(valor.trim()));
    } catch (e: any) {
      setError(e?.message || 'No fue posible activar la licencia.');
    } finally {
      setActivando(false);
    }
  };

  const cargarArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const texto = (await f.text()).trim();
    setClave(texto);
    activar(texto);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-8 bg-gradient-to-b from-slate-50 to-slate-200 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 sm:px-8 py-6 bg-emerald-700 text-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/75">{PRODUCTO.nombreCompleto}</p>
            <h1 className="text-xl sm:text-2xl font-bold">Activación de la licencia</h1>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Este programa se activa una sola vez por equipo. La licencia queda ligada a este computador y no funciona si se copia a otro.
          </p>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">1. Envíe este código a su proveedor</h2>
            <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span id="codigo-equipo" className="font-mono text-2xl sm:text-3xl font-black tracking-wider text-slate-900 dark:text-white select-all">
                {estado.equipo}
              </span>
              <div className="flex gap-2 ml-auto">
                <button type="button" id="copiar-codigo" onClick={() => copiar(estado.equipo, 'codigo')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-semibold">
                  {copiado === 'codigo' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <ClipboardCopy className="w-4 h-4" />} Copiar código
                </button>
                <button type="button" id="copiar-solicitud" onClick={() => copiar(solicitud, 'solicitud')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-semibold">
                  {copiado === 'solicitud' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <ClipboardCopy className="w-4 h-4" />} Copiar solicitud
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500">“Copiar solicitud” prepara un mensaje con el código para enviarlo por WhatsApp o correo. Agregue el nombre y el NIT de la empresa.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">2. Pegue la clave que le enviaron o cargue el archivo .lic</h2>
            <textarea
              id="clave-licencia"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              rows={4}
              spellCheck={false}
              placeholder="SC2-…"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono text-xs break-all"
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" id="activar-licencia" onClick={() => activar()} disabled={activando} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold disabled:opacity-60">
                {activando ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Activar
              </button>
              <button type="button" onClick={() => archivo.current?.click()} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-semibold">
                <FileKey2 className="w-4 h-4" /> Cargar archivo .lic
              </button>
              <input ref={archivo} id="archivo-licencia" type="file" accept=".lic,.txt" className="hidden" onChange={cargarArchivo} />
            </div>
            {error && (
              <p className="text-sm font-semibold text-rose-600" role="alert">
                {error}
              </p>
            )}
          </section>

          <p className="text-[11px] text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-4">
            {PRODUCTO.nombreCompleto} · versión {dataService.version() || PRODUCTO.version}. Uso sujeto a la licencia otorgada por el titular de los derechos de autor. Prohibida su copia o
            distribución sin autorización.
          </p>
        </div>
      </div>
    </div>
  );
};
