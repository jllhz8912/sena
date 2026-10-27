import React, { useEffect, useRef, useState } from 'react';
import { Bell, BellRing, AlertTriangle, Clock, CalendarClock, MonitorSmartphone, DatabaseBackup } from 'lucide-react';
import { CompraDocumento } from '../../types';
import { formatCOP } from '../../utils/formatters';
import { resumenAlertas, sumaSaldos, textoDias } from '../../utils/cartera';
import type { EstadoCopias } from '../../services/dataService';
import { estadoRecordatorio } from '../respaldos/CopiasSeguridadView';

interface AlertasVencimientoProps {
  documentos: CompraDocumento[];
  onVerCartera: () => void;
  estadoCopias?: EstadoCopias | null;
  onVerCopias?: () => void;
}

/** Campana de la barra superior: facturas vencidas, que vencen hoy y mañana. */
export const AlertasVencimiento: React.FC<AlertasVencimientoProps> = ({ documentos, onVerCartera, estadoCopias, onVerCopias }) => {
  const [abierto, setAbierto] = useState(false);
  const [permisoAvisos, setPermisoAvisos] = useState(() => (typeof Notification !== 'undefined' ? Notification.permission : 'denied'));
  const contenedor = useRef<HTMLDivElement>(null);
  const r = resumenAlertas(documentos);
  const copia = estadoRecordatorio(estadoCopias);
  const total = r.urgentes + (copia.vencido ? 1 : 0);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, [abierto]);

  const grupos = [
    { titulo: 'Vencidas', docs: r.vencidas, icono: AlertTriangle, color: 'text-rose-600' },
    { titulo: 'Vencen hoy', docs: r.hoy, icono: Clock, color: 'text-orange-600' },
    { titulo: 'Vencen mañana', docs: r.manana, icono: CalendarClock, color: 'text-amber-600' },
  ].filter((g) => g.docs.length > 0);

  const activarAvisos = async () => {
    try {
      setPermisoAvisos(await Notification.requestPermission());
    } catch {
      setPermisoAvisos('denied');
    }
  };

  return (
    <div className="relative" ref={contenedor}>
      <button
        onClick={() => setAbierto(!abierto)}
        className="relative p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        title={total > 0 ? `${total} alerta(s): pagos por vencer o copia de seguridad pendiente` : 'Sin alertas'}
        aria-label="Alertas de vencimiento"
      >
        {total > 0 ? <BellRing className="w-4 h-4 text-amber-600" /> : <Bell className="w-4 h-4" />}
        {total > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
            {total}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-32px)] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <p className="text-sm font-bold text-slate-900 dark:text-white">Alertas</p>
            <p className="text-[11px] text-slate-500">Pagos a proveedores y copias de seguridad</p>
          </div>
          {copia.vencido && (
            <div className="m-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs space-y-2">
              <p className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <DatabaseBackup className="w-3.5 h-3.5" /> Copia de seguridad pendiente
              </p>
              <p className="text-amber-800 dark:text-amber-300">{copia.texto}</p>
              {onVerCopias && (
                <button
                  onClick={() => {
                    setAbierto(false);
                    onVerCopias();
                  }}
                  className="w-full py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  Hacer copia ahora
                </button>
              )}
            </div>
          )}
          <div className="max-h-80 overflow-y-auto p-2 space-y-2">
            {grupos.length === 0 && <p className="text-xs text-slate-500 p-3">No hay facturas de proveedores vencidas ni por vencer mañana.</p>}
            {grupos.map(({ titulo, docs, icono: Icono, color }) => (
              <div key={titulo}>
                <p className={`px-2 text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5 ${color}`}>
                  <Icono className="w-3.5 h-3.5" /> {titulo} · {formatCOP(sumaSaldos(docs))}
                </p>
                {docs.map((d) => (
                  <div key={d.id} className="px-2 py-1.5 text-xs flex justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block font-semibold truncate text-slate-800 dark:text-slate-100">{d.proveedor?.razonSocial}</span>
                      <span className="text-slate-500">
                        {d.prefijo}
                        {d.folio} · {textoDias(d)}
                      </span>
                    </span>
                    <span className="font-bold tabular-nums whitespace-nowrap">{formatCOP(d.saldoPendiente)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
            <button
              onClick={() => {
                setAbierto(false);
                onVerCartera();
              }}
              className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
            >
              Ver cuentas por pagar
            </button>
            {permisoAvisos === 'default' && (
              <button onClick={activarAvisos} className="w-full py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5">
                <MonitorSmartphone className="w-3.5 h-3.5" /> Activar avisos de Windows
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
