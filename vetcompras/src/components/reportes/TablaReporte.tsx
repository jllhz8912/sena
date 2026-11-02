import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { ArrowDownUp, Columns3, FileSpreadsheet, Pencil } from 'lucide-react';
import { formatCOP, formatFecha } from '../../utils/formatters';
import { FilaReporte, totalesReporte } from '../../utils/reportesPerfil';
import { guardarExcel } from '../../services/descargaExcel';

export interface ColumnaReporte {
  id: string;
  label: string;
  tipo: 'texto' | 'pesos' | 'numero' | 'fecha';
  /** Visible al abrir el reporte (las demás se activan en "Columnas") */
  visible?: boolean;
  /** Promedios y similares: no se suman en la fila de totales */
  sinTotal?: boolean;
}

interface TablaReporteProps {
  columnas: ColumnaReporte[];
  filas: FilaReporte[];
  /** Nombre del archivo de Excel y del título de la hoja */
  titulo: string;
  /** Guarda en este equipo qué columnas eligió la persona */
  claveColumnas: string;
  onEditar?: (fila: FilaReporte) => void;
  textoVacio?: string;
}

const leerColumnas = (clave: string): string[] | null => {
  try {
    const v = localStorage.getItem(clave);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
};

/** Tabla de reporte: columnas a elección, orden por columna, totales, Excel y edición de cada registro. */
export const TablaReporte: React.FC<TablaReporteProps> = ({ columnas, filas, titulo, claveColumnas, onEditar, textoVacio }) => {
  const [visibles, setVisibles] = useState<string[]>(() => {
    const guardadas = leerColumnas(claveColumnas)?.filter((id) => columnas.some((c) => c.id === id));
    return guardadas?.length ? guardadas : columnas.filter((c) => c.visible !== false).map((c) => c.id);
  });
  const [menuColumnas, setMenuColumnas] = useState(false);
  const [orden, setOrden] = useState<{ id: string; asc: boolean } | null>(null);
  const cols = columnas.filter((c) => visibles.includes(c.id));
  const numericas = cols.filter((c) => (c.tipo === 'pesos' || c.tipo === 'numero') && !c.sinTotal).map((c) => c.id);
  const totales = useMemo(() => totalesReporte(filas, numericas), [filas, numericas.join()]);

  const ordenadas = useMemo(() => {
    if (!orden) return filas;
    const col = columnas.find((c) => c.id === orden.id);
    return [...filas].sort((a, b) => {
      const x = a[orden.id];
      const y = b[orden.id];
      const r = col?.tipo === 'pesos' || col?.tipo === 'numero' ? Number(x || 0) - Number(y || 0) : String(x ?? '').localeCompare(String(y ?? ''), 'es');
      return orden.asc ? r : -r;
    });
  }, [filas, orden, columnas]);

  const alternarColumna = (id: string) => {
    const nuevas = visibles.includes(id) ? visibles.filter((x) => x !== id) : columnas.filter((c) => c.id === id || visibles.includes(c.id)).map((c) => c.id);
    if (!nuevas.length) return;
    setVisibles(nuevas);
    try {
      localStorage.setItem(claveColumnas, JSON.stringify(nuevas));
    } catch {
      // Sin almacenamiento: la elección dura mientras la pantalla esté abierta
    }
  };

  const valor = (c: ColumnaReporte, v: unknown) =>
    v === undefined || v === '' || v === null ? '—' : c.tipo === 'pesos' ? formatCOP(Number(v)) : c.tipo === 'numero' ? Number(v).toLocaleString('es-CO') : c.tipo === 'fecha' ? formatFecha(String(v)) : String(v);

  const exportar = () => {
    const datos = [
      cols.map((c) => c.label),
      ...ordenadas.map((f) => cols.map((c) => (c.tipo === 'pesos' || c.tipo === 'numero' ? Number(f[c.id] || 0) : f[c.id] ?? ''))),
      cols.map((c, i) => (i === 0 ? 'TOTAL' : numericas.includes(c.id) ? totales[c.id] : '')),
    ];
    const hoja = XLSX.utils.aoa_to_sheet(datos);
    hoja['!cols'] = cols.map((c) => ({ wch: c.tipo === 'texto' ? 32 : 16 }));
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, titulo.slice(0, 31));
    guardarExcel(libro, `${titulo.replace(/[^\wÁÉÍÓÚáéíóúñÑ ]+/g, '').replace(/\s+/g, '_')}.xlsx`);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-500">{filas.length.toLocaleString('es-CO')} fila(s){onEditar ? ' · el lápiz abre el registro para corregirlo' : ''}</span>
        <div className="flex gap-2 relative">
          <button type="button" onClick={() => setMenuColumnas(!menuColumnas)} aria-expanded={menuColumnas} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold">
            <Columns3 className="w-4 h-4" /> Columnas
          </button>
          <button type="button" id="exportar-reporte" onClick={exportar} disabled={!filas.length} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">
            <FileSpreadsheet className="w-4 h-4" /> Exportar a Excel
          </button>
          {menuColumnas && (
            <div className="absolute right-0 top-11 z-30 w-60 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-1.5">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Columnas a mostrar</p>
              {columnas.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={visibles.includes(c.id)} onChange={() => alternarColumna(c.id)} className="accent-emerald-600" />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              {cols.map((c) => (
                <th key={c.id} className={`p-2.5 whitespace-nowrap ${c.tipo === 'pesos' || c.tipo === 'numero' ? 'text-right' : 'text-left'}`}>
                  <button
                    type="button"
                    onClick={() => setOrden(orden?.id === c.id ? { id: c.id, asc: !orden.asc } : { id: c.id, asc: c.tipo === 'texto' || c.tipo === 'fecha' })}
                    className="inline-flex items-center gap-1 uppercase hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    {c.label}
                    <ArrowDownUp className={`w-3 h-3 ${orden?.id === c.id ? 'text-emerald-600' : 'opacity-30'}`} />
                  </button>
                </th>
              ))}
              {onEditar && <th className="p-2.5 text-right">Editar</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {ordenadas.map((f) => (
              <tr key={f.clave} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                {cols.map((c) => (
                  <td key={c.id} className={`p-2.5 ${c.tipo === 'pesos' || c.tipo === 'numero' ? 'text-right tabular-nums whitespace-nowrap' : 'max-w-[260px] truncate'} ${c.id === 'saldo' && Number(f.saldo) > 0 ? 'text-rose-600 font-semibold' : ''} ${c.id === 'total' ? 'font-bold' : ''}`} title={c.tipo === 'texto' ? String(f[c.id] ?? '') : undefined}>
                    {valor(c, f[c.id])}
                  </td>
                ))}
                {onEditar && (
                  <td className="p-2.5 text-right">
                    {(f.ventaId || f.documentoId) && (
                      <button type="button" onClick={() => onEditar(f)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40" aria-label={`Editar ${f.etiqueta}`} title="Editar registro">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {!filas.length && (
              <tr>
                <td colSpan={cols.length + (onEditar ? 1 : 0)} className="p-8 text-center text-slate-500">
                  {textoVacio || 'No hay registros con estos filtros.'}
                </td>
              </tr>
            )}
          </tbody>
          {!!filas.length && (
            <tfoot className="bg-slate-50 dark:bg-slate-800/60 font-bold">
              <tr>
                {cols.map((c, i) => (
                  <td key={c.id} className={`p-2.5 ${numericas.includes(c.id) ? 'text-right tabular-nums whitespace-nowrap' : ''}`}>
                    {i === 0 ? 'TOTAL' : numericas.includes(c.id) ? valor(c, totales[c.id]) : ''}
                  </td>
                ))}
                {onEditar && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
