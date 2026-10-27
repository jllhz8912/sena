import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Loader2, Stethoscope } from 'lucide-react';
import { dataService, EstadoSesion, UsuarioActual } from '../../services/dataService';

interface PantallaInicioProps {
  marca: NonNullable<EstadoSesion['marca']>;
  mensaje?: string;
  onListo: (usuario: UsuarioActual) => void | Promise<void>;
}

/** Pantalla de bienvenida: logo y nombre de la veterinaria, y un botón grande para ingresar. */
export const PantallaInicio: React.FC<PantallaInicioProps> = ({ marca, mensaje, onListo }) => {
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enCurso = useRef(false);

  const ingresar = async () => {
    if (enCurso.current) return;
    enCurso.current = true;
    setEntrando(true);
    setError(null);
    try {
      await onListo(await dataService.ingresarLibre());
    } catch (err: any) {
      setError(err?.message || 'No fue posible ingresar.');
      setEntrando(false);
      enCurso.current = false;
    }
  };

  // Enter también ingresa
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      // Sobre el botón, Enter ya produce el clic
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) ingresar();
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  });

  const color = marca.colorPrimario || '#059669';

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center p-6 text-center"
      style={{ background: `radial-gradient(circle at 50% 35%, ${color}22 0%, transparent 60%), linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)` }}
    >
      <div className="flex flex-col items-center gap-6 max-w-lg w-full">
        {marca.logoUrl ? (
          <img
            src={marca.logoUrl}
            alt={`Logo de ${marca.nombre}`}
            className="w-44 h-44 sm:w-56 sm:h-56 object-contain rounded-3xl bg-white shadow-xl p-4"
          />
        ) : (
          <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-[2.5rem] flex items-center justify-center text-white shadow-xl" style={{ backgroundColor: color }}>
            <Stethoscope className="w-20 h-20 sm:w-24 sm:h-24" strokeWidth={1.5} />
          </div>
        )}

        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight" style={{ textWrap: 'balance' } as React.CSSProperties}>
            {marca.nombre}
          </h1>
          {marca.slogan && <p className="text-base text-slate-600">{marca.slogan}</p>}
        </div>

        {mensaje && !error && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">{mensaje}</p>}
        {error && (
          <p role="alert" className="text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2">
            {error}
          </p>
        )}

        <button
          onClick={ingresar}
          disabled={entrando}
          autoFocus
          className="w-full sm:w-80 flex items-center justify-center gap-3 py-5 rounded-2xl text-white text-xl font-bold shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-2"
          style={{ backgroundColor: color }}
        >
          {entrando ? <Loader2 className="w-6 h-6 animate-spin" /> : <ArrowRight className="w-6 h-6" />}
          Ingresar
        </button>

        <p className="text-xs text-slate-400">
          VetCompras {dataService.version()}
          {dataService.etapa() === 'prueba' && <strong className="text-amber-600"> · versión de prueba: use datos de ensayo</strong>}
        </p>
      </div>
    </div>
  );
};
