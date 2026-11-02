import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Venta } from '../../types';
import { CATEGORIAS_VENTA, MEDIOS_PAGO_VENTA, getCategoriaVentaInfo } from '../../utils/formatters';
import { Periodo, rangoPeriodo } from '../../utils/paneles';
import { AGRUPACIONES_VENTAS, AgrupacionVentas, agruparVentas, filtrarVentas } from '../../utils/reportesPerfil';
import { SelectorPeriodo } from '../dashboard/PanelVentas';
import { ColumnaReporte, TablaReporte } from './TablaReporte';

interface Props {
  ventas: Venta[];
  onEditarVenta?: (venta: Venta) => void;
}

const input = 'px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs';
const nombreMedio = (m: string) => (m === 'credito' ? 'Crédito (por cobrar)' : MEDIOS_PAGO_VENTA.find((x) => x.id === m)?.label || m);

const COLUMNAS: Record<AgrupacionVentas, ColumnaReporte[]> = {
  venta: [
    { id: 'etiqueta', label: 'Recibo', tipo: 'texto' },
    { id: 'fecha', label: 'Fecha', tipo: 'fecha' },
    { id: 'cliente', label: 'Cliente', tipo: 'texto' },
    { id: 'concepto', label: 'Concepto', tipo: 'texto' },
    { id: 'medio', label: 'Medio de pago', tipo: 'texto' },
    { id: 'total', label: 'Total', tipo: 'pesos' },
    { id: 'pagado', label: 'Pagado', tipo: 'pesos', visible: false },
    { id: 'saldo', label: 'Por cobrar', tipo: 'pesos' },
  ],
  item: [
    { id: 'etiqueta', label: 'Producto o servicio', tipo: 'texto' },
    { id: 'categoria', label: 'Categoría', tipo: 'texto' },
    { id: 'cantidad', label: 'Ventas', tipo: 'numero' },
    { id: 'unidades', label: 'Unidades', tipo: 'numero' },
    { id: 'precioPromedio', label: 'Precio promedio', tipo: 'pesos', sinTotal: true },
    { id: 'total', label: 'Total vendido', tipo: 'pesos' },
  ],
  categoria: [
    { id: 'etiqueta', label: 'Categoría', tipo: 'texto' },
    { id: 'cantidad', label: 'Ventas', tipo: 'numero' },
    { id: 'unidades', label: 'Unidades', tipo: 'numero' },
    { id: 'total', label: 'Total vendido', tipo: 'pesos' },
  ],
  cliente: [
    { id: 'etiqueta', label: 'Cliente', tipo: 'texto' },
    { id: 'cantidad', label: 'Ventas', tipo: 'numero' },
    { id: 'total', label: 'Total comprado', tipo: 'pesos' },
    { id: 'saldo', label: 'Por cobrar', tipo: 'pesos' },
  ],
  dia: [
    { id: 'etiqueta', label: 'Día', tipo: 'fecha' },
    { id: 'cantidad', label: 'Ventas', tipo: 'numero' },
    { id: 'total', label: 'Total vendido', tipo: 'pesos' },
    { id: 'saldo', label: 'Por cobrar', tipo: 'pesos' },
  ],
  medio: [
    { id: 'etiqueta', label: 'Medio de pago', tipo: 'texto' },
    { id: 'cantidad', label: 'Ventas', tipo: 'numero' },
    { id: 'total', label: 'Valor', tipo: 'pesos' },
  ],
};

/** Reportes del perfil Ventas: consulta de ventas con filtros y agrupaciones, Excel y edición. */
export const ReportesVentasPerfil: React.FC<Props> = ({ ventas, onEditarVenta }) => {
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [rangoLibre, setRangoLibre] = useState(() => rangoPeriodo('mes'));
  const [agrupacion, setAgrupacion] = useState<AgrupacionVentas>('venta');
  const [texto, setTexto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [medio, setMedio] = useState('');
  const [estado, setEstado] = useState<'' | 'pagadas' | 'credito'>('');

  const rango = useMemo(() => rangoPeriodo(periodo, new Date(), rangoLibre), [periodo, rangoLibre]);
  const filtradas = useMemo(() => filtrarVentas(ventas, { rango, texto, categoria, medio, estado }), [ventas, rango, texto, categoria, medio, estado]);
  const filas = useMemo(() => agruparVentas(filtradas, agrupacion, (k) => getCategoriaVentaInfo(k).label, nombreMedio), [filtradas, agrupacion]);
  const titulo = `Reporte ventas ${AGRUPACIONES_VENTAS.find((a) => a.id === agrupacion)?.label} ${rango.desde} a ${rango.hasta}`;

  return (
    <div className="space-y-5">
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Reportes de Ventas</h2>
          <p className="text-xs text-slate-500">Consulte las ventas con los filtros que necesite, agrúpelas, expórtelas a Excel y corrija cualquier venta con el lápiz.</p>
        </div>
        <SelectorPeriodo periodo={periodo} onPeriodo={setPeriodo} desde={rangoLibre.desde} hasta={rangoLibre.hasta} onRango={(desde, hasta) => setRangoLibre({ desde, hasta })} />
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input id="rv-texto" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar recibo, cliente, mascota o producto…" className={input + ' w-full pl-9'} />
          </div>
          <select id="rv-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} className={input} aria-label="Categoría">
            <option value="">Todas las categorías</option>
            {CATEGORIAS_VENTA.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <select id="rv-medio" value={medio} onChange={(e) => setMedio(e.target.value)} className={input} aria-label="Medio de pago">
            <option value="">Todos los medios</option>
            {[...MEDIOS_PAGO_VENTA.map((m) => m.id), 'credito'].map((m) => (
              <option key={m} value={m}>
                {nombreMedio(m)}
              </option>
            ))}
          </select>
          <select id="rv-estado" value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)} className={input} aria-label="Estado">
            <option value="">Pagadas y a crédito</option>
            <option value="pagadas">Solo pagadas</option>
            <option value="credito">Solo con saldo por cobrar</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Agrupar por">
          {AGRUPACIONES_VENTAS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              id={`rv-agrupar-${a.id}`}
              aria-selected={agrupacion === a.id}
              onClick={() => setAgrupacion(a.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                agrupacion === a.id ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <TablaReporte
          key={agrupacion}
          columnas={COLUMNAS[agrupacion]}
          filas={filas}
          titulo={titulo}
          claveColumnas={`vetcompras_cols_rv_${agrupacion}`}
          onEditar={agrupacion === 'venta' && onEditarVenta ? (f) => {
            const v = ventas.find((x) => x.id === f.ventaId);
            if (v) onEditarVenta(v);
          } : undefined}
          textoVacio="No hay ventas con estos filtros en el periodo."
        />
        {agrupacion !== 'venta' && (
          <p className="text-[11px] text-slate-500 mt-3">Para corregir una venta, vuelva a “Detalle por venta” y use el lápiz de la fila.</p>
        )}
      </div>
    </div>
  );
};
