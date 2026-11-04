import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CloudUpload, HardDriveDownload, ShieldCheck } from 'lucide-react';
import { dataService } from '../../services/dataService';
import { DIAS_ALERTA_COPIA, EstadoAlertaCopia } from '../../utils/alertaCopia';

/** Evento y marca para abrir "Copias de Seguridad" al aceptar la alerta. */
export const EVENTO_IR_A_COPIAS = 'vetcompras:ir-a-copias';
const MARCA_IR_A_COPIAS = 'vetcompras_ir_a_copias';

/** ¿La alerta pidió abrir Copias de Seguridad al ingresar? (se consume una sola vez) */
export function pedidoIrACopias(): boolean {
  try {
    const si = sessionStorage.getItem(MARCA_IR_A_COPIAS) === '1';
    sessionStorage.removeItem(MARCA_IR_A_COPIAS);
    return si;
  } catch {
    return false;
  }
}

const REVISAR_CADA_MS = 15 * 60 * 1000;

const haceDias = (n: number | null) => (n === null ? 'nunca se ha hecho' : n === 0 ? 'se hizo hoy' : n === 1 ? 'se hizo hace 1 día' : `se hizo hace ${n} días`);

/**
 * Alerta roja semanal obligatoria: cubre toda la pantalla (también la de inicio) y
 * no deja ingresar ni trabajar hasta que se pulse "Aceptar". Se revisa al abrir,
 * cada 15 minutos y al volver a la ventana, para equipos que pasan días abiertos.
 */
export const AlertaCopiaSemanal: React.FC = () => {
  const [estado, setEstado] = useState<EstadoAlertaCopia | null>(null);
  const [aceptando, setAceptando] = useState(false);
  const [error, setError] = useState('');

  const revisar = useCallback(() => {
    dataService
      .obtenerAlertaCopia()
      .then(setEstado)
      .catch(() => undefined); // sin servidor: la pantalla de "VetCompras no está abierto" ya lo indica
  }, []);

  useEffect(() => {
    revisar();
    const t = window.setInterval(revisar, REVISAR_CADA_MS);
    const alVolver = () => document.visibilityState === 'visible' && revisar();
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [revisar]);

  const visible = !!estado?.pendiente;

  // Contenedor propio: todo lo demás de la página (aplicación, ventanas abiertas) queda
  // sin clics ni teclado mientras la alerta esté en pantalla
  const [contenedor] = useState(() => {
    const div = document.createElement('div');
    div.id = 'alerta-copia-semanal';
    return div;
  });
  useEffect(() => {
    if (!visible) return;
    document.body.appendChild(contenedor);
    const bloquear = () => {
      for (const el of Array.from(document.body.children) as HTMLElement[]) {
        if (el !== contenedor && el.tagName !== 'SCRIPT') el.inert = true;
      }
    };
    bloquear();
    // El teclado no sale de la alerta: Tab recorre solo sus botones
    const alTeclear = (e: KeyboardEvent) => {
      const botones = Array.from(contenedor.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
      if (!botones.length) return;
      if (e.key === 'Escape') e.preventDefault();
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const i = botones.indexOf(document.activeElement as HTMLButtonElement);
      botones[(i + (e.shiftKey ? -1 : 1) + botones.length) % botones.length].focus();
    };
    document.addEventListener('keydown', alTeclear, true);
    // Ventanas que se abran mientras tanto también quedan bloqueadas
    const observador = new MutationObserver(bloquear);
    observador.observe(document.body, { childList: true });
    return () => {
      document.removeEventListener('keydown', alTeclear, true);
      observador.disconnect();
      for (const el of Array.from(document.body.children) as HTMLElement[]) el.inert = false;
      contenedor.remove();
    };
  }, [visible, contenedor]);

  const aceptar = async (irACopias: boolean) => {
    setAceptando(true);
    setError('');
    try {
      setEstado(await dataService.aceptarAlertaCopia());
      if (irACopias) {
        try {
          sessionStorage.setItem(MARCA_IR_A_COPIAS, '1');
        } catch {
          // Sin almacenamiento de sesión: el evento abre la pestaña si ya ingresó
        }
        window.dispatchEvent(new Event(EVENTO_IR_A_COPIAS));
      }
    } catch (err: any) {
      setError(err?.message || 'No se pudo registrar la aceptación. Intente de nuevo.');
    } finally {
      setAceptando(false);
    }
  };

  if (!visible || !estado) return null;

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alerta-copia-titulo"
      aria-describedby="alerta-copia-texto"
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-red-950/85 backdrop-blur-sm overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-3xl bg-red-600 text-white shadow-2xl ring-4 ring-red-300/60 my-auto">
        <div className="p-6 sm:p-8 space-y-5">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-16 h-16 rounded-2xl bg-white text-red-600 flex items-center justify-center animate-pulse">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-red-100">Alerta semanal obligatoria</p>
              <h2 id="alerta-copia-titulo" className="text-2xl sm:text-3xl font-black leading-tight">
                HAGA LA COPIA DE SEGURIDAD Y SÚBALA A LA NUBE (DRIVE)
              </h2>
            </div>
          </div>

          <p id="alerta-copia-texto" className="text-base sm:text-lg font-medium text-red-50">
            Si el computador se daña, se pierde o se lo roban, la información de la empresa solo se recupera con una copia guardada fuera de
            este PC. La última copia de seguridad <strong className="text-white underline">{haceDias(estado.diasSinCopia)}</strong>.
          </p>

          <ol className="space-y-2.5 text-sm sm:text-base">
            <li className="flex gap-3 p-3 rounded-2xl bg-red-700/60">
              <HardDriveDownload className="w-6 h-6 shrink-0" />
              <span>
                <strong>1. Haga la copia:</strong> menú <strong>Copias de Seguridad</strong> → botón <strong>“Copiar y descargar”</strong>. Se descarga un
                archivo <code className="px-1 rounded bg-red-800">.db</code>.
              </span>
            </li>
            <li className="flex gap-3 p-3 rounded-2xl bg-red-700/60">
              <CloudUpload className="w-6 h-6 shrink-0" />
              <span>
                <strong>2. Súbala a la nube:</strong> abra <strong>Google Drive</strong> (drive.google.com) u OneDrive y arrastre allí el archivo
                descargado, en una carpeta “Copias Sistema de Control”.
              </span>
            </li>
            <li className="flex gap-3 p-3 rounded-2xl bg-red-700/60">
              <ShieldCheck className="w-6 h-6 shrink-0" />
              <span>
                <strong>3. Verifique</strong> que el archivo aparece en Drive con la fecha de hoy.
              </span>
            </li>
          </ol>

          {error && <p className="p-3 rounded-xl bg-white text-red-700 text-sm font-semibold">{error}</p>}

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              id="alerta-copia-aceptar"
              type="button"
              autoFocus
              disabled={aceptando}
              onClick={() => aceptar(false)}
              className="flex-1 py-4 rounded-2xl bg-white text-red-700 text-xl font-black tracking-wide shadow-lg hover:bg-red-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300 disabled:opacity-60"
            >
              {aceptando ? 'Registrando…' : 'ACEPTAR'}
            </button>
            <button
              id="alerta-copia-ir"
              type="button"
              disabled={aceptando}
              onClick={() => aceptar(true)}
              className="sm:w-64 py-4 px-4 rounded-2xl border-2 border-white text-white text-sm font-bold hover:bg-red-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300 disabled:opacity-60"
            >
              Aceptar e ir a Copias de Seguridad
            </button>
          </div>
          <p className="text-xs text-red-100">
            Este aviso aparece cada {DIAS_ALERTA_COPIA} días y no deja usar el sistema hasta que se acepte. Queda registrado en la bitácora.
          </p>
        </div>
      </div>
    </div>,
    contenedor
  );
};
