import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Categoria, CompraDocumento, FormaPago } from '../../types';
import { Periodo, rangoPeriodo } from '../../utils/paneles';
import { AGRUPACIONES_COMPRAS, AgrupacionCompras, agruparCompras, filtrarCompras } from '../../utils/reportesPerfil';
import { ESTADOS_FACTURA, EstadoFactura, FORMAS_PAGO } from '../../utils/pagosCompra';
import { SelectorPeriodo } from '../dashboard/PanelVentas';
import { ColumnaReporte, TablaReporte } from './TablaReporte';

interface Props {
  documentos: CompraDocumento[];
  categorias: Categoria[];
  onEditarDocumento?: (doc: CompraDocumento) => void;
}

const input = 'px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs';

const COLUMNAS: Record<AgrupacionCompras, ColumnaReporte[]> = {
  documento: [
    { id: 'fecha', label: 'Fecha', tipo: 'fecha' },
    { id: 'etiqueta', label: 'Número', tipo: 'texto' },
    { id: 'proveedor', label: 'Proveedor', tipo: 'texto' },
    { id: 'nit', label: 'NIT', tipo: 'texto', visible: false },
    { id: 'categoria', label: 'Categoría', tipo: 'texto' },
    { id: 'naturaleza', label: 'Compra / gasto', tipo: 'texto', visible: false },
    { id: 'formaPago', label: 'Forma de pago', tipo: 'texto' },
    { id: 'subtotal', label: 'Base', tipo: 'pesos', visible: false },
    { id: 'iva', label: 'IVA', tipo: 'pesos', visible: false },
    { id: 'retenciones', label: 'Retenciones', tipo: 'pesos', visible: false },
    { id: 'total', label: 'Total', tipo: 'pesos' },
    { id: 'saldo', label: 'Saldo', tipo: 'pesos' },
    { id: 'vence', label: 'Vence', tipo: 'fecha', visible: false },
    { id: 'estado', label: 'Estado', tipo: 'texto' },
  ],
  proveedor: [
    { id: 'etiqueta', label: 'Proveedor', tipo: 'texto' },
    { id: 'nit', label: 'NIT', tipo: 'texto' },
    { id: 'cantidad', label: 'Documentos', tipo: 'numero' },
    { id: 'iva', label: 'IVA', tipo: 'pesos', visible: false },
    { id: 'retenciones', label: 'Retenciones', tipo: 'pesos', visible: false },
    { id: 'total', label: 'Total', tipo: 'pesos' },
    { id: 'saldo', label: 'Saldo por pagar', tipo: 'pesos' },
  ],
  categoria: [
    { id: 'etiqueta', label: 'Categoría', tipo: 'texto' },
    { id: 'naturaleza', label: 'Compra / gasto', tipo: 'texto' },
    { id: 'cantidad', label: 'Documentos', tipo: 'numero' },
    { id: 'iva', label: 'IVA', tipo: 'pesos', visible: false },
    { id: 'total', label: 'Total', tipo: 'pesos' },
    { id: 'saldo', label: 'Saldo por pagar', tipo: 'pesos' },
  ],
  mes: [
    { id: 'etiqueta', label: 'Mes', tipo: 'texto' },
    { id: 'cantidad', label: 'Documentos', tipo: 'numero' },
    { id: 'compras', label: 'Compras', tipo: 'pesos' },
    { id: 'gastos', label: 'Gastos', tipo: 'pesos' },
    { id: 'iva', label: 'IVA', tipo: 'pesos' },
    { id: 'total', label: 'Total', tipo: 'pesos' },
    { id: 'saldo', label: 'Saldo por pagar', tipo: 'pesos' },
  ],
  producto: [
    { id: 'etiqueta', label: 'Producto', tipo: 'texto' },
    { id: 'cantidad', label: 'Líneas', tipo: 'numero', visible: false },
    { id: 'unidades', label: 'Unidades', tipo: 'numero' },
    { id: 'costoPromedio', label: 'Costo promedio', tipo: 'pesos', sinTotal: true },
    { id: 'base', label: 'Base', tipo: 'pesos' },
    { id: 'iva', label: 'IVA', tipo: 'pesos' },
    { id: 'total', label: 'Total', tipo: 'pesos' },
  ],
  iva: [
    { id: 'etiqueta', label: 'Tarifa', tipo: 'texto' },
    { id: 'base', label: 'Base gravable', tipo: 'pesos' },
    { id: 'iva', label: 'IVA descontable', tipo: 'pesos' },
    { id: 'total', label: 'Total', tipo: 'pesos' },
  ],
  retenciones: [
    { id: 'etiqueta', label: 'Tercero', tipo: 'texto' },
    { id: 'nit', label: 'NIT', tipo: 'texto' },
    { id: 'cantidad', label: 'Documentos', tipo: 'numero' },
    { id: 'base', label: 'Base', tipo: 'pesos' },
    { id: 'reteFuente', label: 'ReteFuente', tipo: 'pesos' },
    { id: 'reteIva', label: 'ReteIVA', tipo: 'pesos' },
    { id: 'reteIca', label: 'ReteICA', tipo: 'pesos' },
    { id: 'total', label: 'Total retenido', tipo: 'pesos' },
  ],
};

/** Reportes del perfil Compras y Gastos: consulta con filtros y agrupaciones, Excel y edición. */
export const ReportesComprasPerfil: React.FC<Props> = ({ documentos, categorias, onEditarDocumento }) => {
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [rangoLibre, setRangoLibre] = useState(() => rangoPeriodo('mes'));
  const [agrupacion, setAgrupacion] = useState<AgrupacionCompras>('documento');
  const [texto, setTexto] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [naturaleza, setNaturaleza] = useState<'' | 'compra' | 'gasto'>('');
  const [estado, setEstado] = useState<'' | EstadoFactura>('');
  const [formaPago, setFormaPago] = useState<'' | FormaPago>('');

  const proveedores = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of documentos) if (d.proveedor?.nit) m.set(d.proveedor.nit, d.proveedor.razonSocial || d.proveedor.nit);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  }, [documentos]);
  const rango = useMemo(() => rangoPeriodo(periodo, new Date(), rangoLibre), [periodo, rangoLibre]);
  const filtrados = useMemo(
    () => filtrarCompras(documentos, { rango, texto, proveedor, categoriaId, naturaleza, estado, formaPago }),
    [documentos, rango, texto, proveedor, categoriaId, naturaleza, estado, formaPago]
  );
  const filas = useMemo(() => agruparCompras(filtrados, agrupacion, categorias), [filtrados, agrupacion, categorias]);
  const titulo = `Reporte compras ${AGRUPACIONES_COMPRAS.find((a) => a.id === agrupacion)?.label} ${rango.desde} a ${rango.hasta}`;

  return (
    <div className="space-y-5">
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Reportes de Compras y Gastos</h2>
          <p className="text-xs text-slate-500">
            Consulte compras y gastos con los filtros que necesite, agrúpelos (incluye IVA por tarifa y retenciones por tercero), expórtelos a Excel y corrija cualquier
            documento con el lápiz.
          </p>
        </div>
        <SelectorPeriodo periodo={periodo} onPeriodo={setPeriodo} desde={rangoLibre.desde} hasta={rangoLibre.hasta} onRango={(desde, hasta) => setRangoLibre({ desde, hasta })} />
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input id="rc-texto" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar número, CUFE, proveedor o producto…" className={input + ' w-full pl-9'} />
          </div>
          <select id="rc-proveedor" value={proveedor} onChange={(e) => setProveedor(e.target.value)} className={input + ' max-w-[220px]'} aria-label="Proveedor">
            <option value="">Todos los proveedores</option>
            {proveedores.map(([nit, nombre]) => (
              <option key={nit} value={nit}>
                {nombre}
              </option>
            ))}
          </select>
          <select id="rc-categoria" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={input} aria-label="Categoría">
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <select id="rc-naturaleza" value={naturaleza} onChange={(e) => setNaturaleza(e.target.value as typeof naturaleza)} className={input} aria-label="Compra o gasto">
            <option value="">Compras y gastos</option>
            <option value="compra">Solo compras</option>
            <option value="gasto">Solo gastos</option>
          </select>
          <select id="rc-estado" value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)} className={input} aria-label="Estado de pago">
            <option value="">Cualquier estado</option>
            {ESTADOS_FACTURA.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
          <select id="rc-forma" value={formaPago} onChange={(e) => setFormaPago(e.target.value as typeof formaPago)} className={input} aria-label="Forma de pago">
            <option value="">Cualquier forma de pago</option>
            {FORMAS_PAGO.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Agrupar por">
          {AGRUPACIONES_COMPRAS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              id={`rc-agrupar-${a.id}`}
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
          claveColumnas={`vetcompras_cols_rc_${agrupacion}`}
          onEditar={agrupacion === 'documento' && onEditarDocumento ? (f) => {
            const d = documentos.find((x) => x.id === f.documentoId);
            if (d) onEditarDocumento(d);
          } : undefined}
          textoVacio="No hay compras ni gastos con estos filtros en el periodo."
        />
        {agrupacion !== 'documento' && (
          <p className="text-[11px] text-slate-500 mt-3">Para corregir un documento, vuelva a “Detalle por documento” y use el lápiz de la fila.</p>
        )}
      </div>
    </div>
  );
};
