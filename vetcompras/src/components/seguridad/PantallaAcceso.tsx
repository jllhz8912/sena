import React, { useState } from 'react';
import { Stethoscope, Lock, User, Eye, EyeOff, Loader2, ShieldCheck, Building2, ArrowRight, KeyRound } from 'lucide-react';
import { dataService, UsuarioActual } from '../../services/dataService';

type Modo = 'configuracion' | 'ingreso' | 'cambio_clave';

interface PantallaAccesoProps {
  modo: Modo;
  mensaje?: string;
  usuario?: UsuarioActual | null;
  onListo: (usuario: UsuarioActual) => void | Promise<void>;
}

const claseInput =
  'w-full pl-10 pr-3 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500';

/** Revisa la contraseña en el navegador para dar ayuda inmediata (el servidor vuelve a validarla). */
export function problemaClave(clave: string, confirmacion: string): string | null {
  if (clave.length < 8) return 'Use al menos 8 caracteres.';
  if (!/[a-zA-Z]/.test(clave) || !/\d/.test(clave)) return 'Combine letras y números.';
  if (clave !== confirmacion) return 'Las dos contraseñas no coinciden.';
  return null;
}

const Campo: React.FC<{
  icono: React.ElementType;
  etiqueta: string;
  children: React.ReactNode;
}> = ({ icono: Icono, etiqueta, children }) => (
  <label className="block space-y-1.5">
    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{etiqueta}</span>
    <div className="relative">
      <Icono className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
      {children}
    </div>
  </label>
);

const CampoClave: React.FC<{
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  autoComplete: string;
  autoFocus?: boolean;
}> = ({ etiqueta, valor, onChange, autoComplete, autoFocus }) => {
  const [ver, setVer] = useState(false);
  return (
    <Campo icono={Lock} etiqueta={etiqueta}>
      <input
        type={ver ? 'text' : 'password'}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className={claseInput + ' pr-10'}
      />
      <button
        type="button"
        onClick={() => setVer(!ver)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        title={ver ? 'Ocultar contraseña' : 'Ver contraseña'}
        tabIndex={-1}
      >
        {ver ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </Campo>
  );
};

export const PantallaAcceso: React.FC<PantallaAccesoProps> = ({ modo, mensaje, usuario, onListo }) => {
  const [paso, setPaso] = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ingreso
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [clave, setClave] = useState('');
  // Configuración inicial
  const [razonSocial, setRazonSocial] = useState('');
  const [nit, setNit] = useState('');
  const [nombrePersona, setNombrePersona] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  // Cambio de clave
  const [claveActual, setClaveActual] = useState('');

  const ejecutar = async (accion: () => Promise<UsuarioActual>) => {
    setEnviando(true);
    setError(null);
    try {
      await onListo(await accion());
    } catch (err: any) {
      setError(err?.message || 'No fue posible completar la operación.');
    } finally {
      setEnviando(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modo === 'ingreso') {
      if (!nombreUsuario.trim() || !clave) return setError('Escriba su usuario y contraseña.');
      return ejecutar(() => dataService.ingresar(nombreUsuario, clave));
    }
    if (modo === 'cambio_clave') {
      const problema = problemaClave(clave, confirmacion);
      if (problema) return setError(problema);
      return ejecutar(async () => {
        await dataService.cambiarClave(claveActual, clave);
        return { ...(usuario as UsuarioActual), debeCambiarClave: false };
      });
    }
    // Configuración inicial en dos pasos
    if (paso === 1) {
      if (!razonSocial.trim()) return setError('Escriba el nombre de la veterinaria.');
      setError(null);
      return setPaso(2);
    }
    if (!nombrePersona.trim()) return setError('Escriba el nombre de la persona administradora.');
    const problema = problemaClave(clave, confirmacion);
    if (problema) return setError(problema);
    return ejecutar(() =>
      dataService.configuracionInicial({
        usuario: nombreUsuario,
        nombre: nombrePersona,
        clave,
        empresa: { razonSocial: razonSocial.trim(), nombreComercial: razonSocial.trim(), nit: nit.trim() },
      })
    );
  };

  const titulos: Record<Modo, { titulo: string; subtitulo: string }> = {
    ingreso: { titulo: 'Ingresar a VetCompras', subtitulo: 'Escriba su usuario y contraseña.' },
    cambio_clave: {
      titulo: 'Cree su contraseña personal',
      subtitulo: 'Por seguridad, cambie la contraseña temporal que le asignaron antes de continuar.',
    },
    configuracion: {
      titulo: paso === 1 ? 'Bienvenido a VetCompras' : 'Cree el usuario administrador',
      subtitulo:
        paso === 1
          ? 'Primer uso: escriba los datos básicos de la veterinaria. Podrá completarlos después en Configuración.'
          : 'Esta persona podrá crear otros usuarios, restaurar respaldos y cambiar la configuración. Guarde bien la contraseña.',
    },
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-teal-50 dark:from-slate-950 dark:via-slate-950 dark:to-emerald-950/30 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 space-y-5"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30">
            {modo === 'cambio_clave' ? <KeyRound className="w-6 h-6" /> : <Stethoscope className="w-6 h-6" />}
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">{titulos[modo].titulo}</h1>
            {modo === 'configuracion' && <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">Paso {paso} de 2</p>}
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">{titulos[modo].subtitulo}</p>

        {mensaje && !error && (
          <div className="text-xs rounded-xl px-3 py-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-900">
            {mensaje}
          </div>
        )}

        {modo === 'ingreso' && (
          <>
            <Campo icono={User} etiqueta="Usuario">
              <input
                value={nombreUsuario}
                onChange={(e) => setNombreUsuario(e.target.value)}
                autoComplete="username"
                autoFocus
                className={claseInput}
              />
            </Campo>
            <CampoClave etiqueta="Contraseña" valor={clave} onChange={setClave} autoComplete="current-password" />
          </>
        )}

        {modo === 'cambio_clave' && (
          <>
            <CampoClave etiqueta="Contraseña temporal (la que le dieron)" valor={claveActual} onChange={setClaveActual} autoComplete="current-password" autoFocus />
            <CampoClave etiqueta="Nueva contraseña" valor={clave} onChange={setClave} autoComplete="new-password" />
            <CampoClave etiqueta="Repita la nueva contraseña" valor={confirmacion} onChange={setConfirmacion} autoComplete="new-password" />
            <p className="text-[11px] text-slate-500">Mínimo 8 caracteres, combinando letras y números.</p>
          </>
        )}

        {modo === 'configuracion' && paso === 1 && (
          <>
            <Campo icono={Building2} etiqueta="Nombre o razón social de la veterinaria">
              <input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} autoFocus className={claseInput} />
            </Campo>
            <Campo icono={ShieldCheck} etiqueta="NIT (opcional)">
              <input value={nit} onChange={(e) => setNit(e.target.value)} inputMode="numeric" className={claseInput} />
            </Campo>
          </>
        )}

        {modo === 'configuracion' && paso === 2 && (
          <>
            <Campo icono={User} etiqueta="Nombre de la persona">
              <input value={nombrePersona} onChange={(e) => setNombrePersona(e.target.value)} autoFocus className={claseInput} />
            </Campo>
            <Campo icono={User} etiqueta="Usuario para ingresar (sin espacios, ej. admin)">
              <input
                value={nombreUsuario}
                onChange={(e) => setNombreUsuario(e.target.value.replace(/\s/g, '').toLowerCase())}
                autoComplete="username"
                className={claseInput}
              />
            </Campo>
            <CampoClave etiqueta="Contraseña" valor={clave} onChange={setClave} autoComplete="new-password" />
            <CampoClave etiqueta="Repita la contraseña" valor={confirmacion} onChange={setConfirmacion} autoComplete="new-password" />
            <p className="text-[11px] text-slate-500">Mínimo 8 caracteres, combinando letras y números.</p>
          </>
        )}

        {error && (
          <div role="alert" className="text-xs rounded-xl px-3 py-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-900">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          {modo === 'configuracion' && paso === 2 && (
            <button
              type="button"
              onClick={() => {
                setPaso(1);
                setError(null);
              }}
              className="px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
              Atrás
            </button>
          )}
          <button
            type="submit"
            disabled={enviando}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold shadow-md transition-colors"
          >
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {modo === 'ingreso' ? 'Ingresar' : modo === 'cambio_clave' ? 'Guardar y continuar' : paso === 1 ? 'Siguiente' : 'Crear y empezar'}
          </button>
        </div>

        <p className="text-[11px] text-center text-slate-400">
          VetCompras {dataService.version()}
          {dataService.etapa() === 'prueba' && <strong className="text-amber-600"> · versión de prueba: use datos de ensayo</strong>}
        </p>

        {modo === 'ingreso' && (
          <p className="text-[11px] text-center text-slate-400">
            ¿Olvidó su contraseña? Un administrador puede asignarle una temporal en “Seguridad y Respaldos”.
          </p>
        )}
      </form>
    </div>
  );
};
