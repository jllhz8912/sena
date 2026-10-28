import React, { useCallback, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { guardarExcel } from '../../services/descargaExcel';
import { FileSpreadsheet, MessageSquare } from 'lucide-react';
import { dataService, Observacion } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { fechaLocal } from '../../utils/formatters';

const ETIQUETA_TIPO: Record<Observacion['tipo'], string> = { error: 'Error', mejora: 'Sugerencia', duda: 'Duda' };
const COLOR_ESTADO: Record<Observacion['estado'], string> = {
  nueva: 'bg-amber-100 text-amber-800',
  revisada: 'bg-sky-100 text-sky-800',
  resuelta: 'bg-emerald-100 text-emerald-800',
};

/** Revisión de las observaciones que dejan los probadores. */
export const PanelObservaciones: React.FC = () => {
  const { mostrarToast } = useToast();
  const [lista, setLista] = useState<Observacion[]>([]);
  const [filtro, setFiltro] = useState<'todas' | Observacion['estado']>('todas');

  const cargar = useCallback(() => {
    dataService.obtenerObservaciones().then(setLista).catch((e) => mostrarToast('error', 'Observaciones', e.message));
  }, [mostrarToast]);
  useEffect(cargar, [cargar]);

  const actualizar = async (o: Observacion, cambios: Partial<Observacion>) => {
    try {
      await dataService.guardarObservacion({ ...o, ...cambios });
      cargar();
    } catch (e: any) {
      mostrarToast('error', 'No se actualizó', e.message);
    }
  };

  const exportar = () => {
    const filas = [
      ['Fecha', 'Usuario', 'Pantalla', 'Tipo', 'Descripción', 'Estado', 'Respuesta'],
      ...lista.map((o) => [new Date(o.fecha).toLocaleString('es-CO'), o.usuario, o.modulo, ETIQUETA_TIPO[o.tipo], o.descripcion, o.estado, o.respuesta || '']),
    ];
    const ws = XLSX.utils.aoa_to_sheet(filas);
    ws['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 28 }, { wch: 12 }, { wch: 70 }, { wch: 10 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Observaciones');
    guardarExcel(wb, `VetCompras_Observaciones_${fechaLocal()}.xlsx`);
  };

  const visibles = lista.filter((o) => filtro === 'todas' || o.estado === filtro);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-amber-600" /> Observaciones de los probadores ({lista.length})
        </h3>
        <div className="flex gap-2">
          <select value={filtro} onChange={(e) => setFiltro(e.target.value as any)} className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs">
            <option value="todas">Todas</option>
            <option value="nueva">Nuevas</option>
            <option value="revisada">Revisadas</option>
            <option value="resuelta">Resueltas</option>
          </select>
          <button onClick={exportar} disabled={lista.length === 0} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-600 text-emerald-700 text-xs font-semibold disabled:opacity-40">
            <FileSpreadsheet className="w-4 h-4" /> Exportar a Excel
          </button>
        </div>
      </div>
      {visibles.length === 0 && <p className="text-xs text-slate-500">No hay observaciones {filtro !== 'todas' ? 'con este estado' : 'todavía'}.</p>}
      <div className="space-y-2">
        {visibles.map((o) => (
          <div key={o.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs space-y-2">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <span className="text-slate-500">
                {new Date(o.fecha).toLocaleString('es-CO')} · <strong className="text-slate-800 dark:text-slate-100">{o.usuario}</strong> · {o.modulo} ·{' '}
                {ETIQUETA_TIPO[o.tipo]}
              </span>
              <select
                value={o.estado}
                onChange={(e) => actualizar(o, { estado: e.target.value as Observacion['estado'] })}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold ${COLOR_ESTADO[o.estado]}`}
              >
                <option value="nueva">Nueva</option>
                <option value="revisada">Revisada</option>
                <option value="resuelta">Resuelta</option>
              </select>
            </div>
            <p className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{o.descripcion}</p>
            <input
              defaultValue={o.respuesta || ''}
              onBlur={(e) => e.target.value !== (o.respuesta || '') && actualizar(o, { respuesta: e.target.value })}
              placeholder="Respuesta o nota interna (se guarda al salir del campo)"
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
