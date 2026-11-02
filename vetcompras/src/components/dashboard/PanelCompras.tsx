import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpRight, Boxes, CalendarClock, FileText, Percent, Plus, ReceiptText, Wallet } from 'lucide-react';
import { Categoria, CompraDocumento } from '../../types';
import { formatCOP, formatFecha } from '../../utils/formatters';
import { Periodo, enRango, proximosVencimientos, rangoPeriodo, resumenComprasPanel } from '../../utils/paneles';
import { comprasPorCategoria, resumenMensual } from '../../utils/resumenes';
import { ESTADOS_FACTURA, estadoFactura, etiquetaFormaPago, resumenFacturas } from '../../utils/pagosCompra';
import { ESTILO_COMPRA, ESTILO_GASTO, TarjetaResumen } from '../common/TarjetaResumen';
import { Indicador, SelectorPeriodo } from './PanelVentas';

interface PanelComprasProps {
  documentos: CompraDocumento[];
  categorias: Categoria[];
  onNuevaCompra?: () => void;
  onIrACompras?: () => void;
  onIrACuentasPorPagar?: () => void;
}

const tarjeta = 'p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4';
const COLOR_ESTADO: Record<string, string> = {
  pagada: 'text-emerald-700 dark:text-emerald-400',
  con_saldo: 'text-amber-600 dark:text-amber-400',
  por_pagar: 'text-amber-600 dark:text-amber-400',
  vencida: 'text-rose-600 dark:text-rose-400',
};

/**
 * Panel del perfil Compras y Gastos: lo comprado y gastado en el periodo, IVA y
 * retenciones, control de facturas, vencimientos, categorías, proveedores y los
 * últimos documentos registrados para validarlos.
 */
export const PanelCompras: React.FC<PanelComprasProps> = ({ documentos, categorias, onNuevaCompra, onIrACompras, onIrACuentasPorPagar }) => {
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [rangoLibre, setRangoLibre] = useState(() => rangoPeriodo('mes'));
  const rango = useMemo(() => rangoPeriodo(periodo, new Date(), rangoLibre), [periodo, rangoLibre]);
  const delPeriodo = useMemo(() => documentos.filter((d) => enRango(d.fechaEmision, rango)), [documentos, rango]);
  const r = useMemo(() => resumenComprasPanel(delPeriodo), [delPeriodo]);
  const control = useMemo(() => resumenFacturas(documentos), [documentos]);
  const vencimientos = useMemo(() => proximosVencimientos(documentos, 7), [documentos]);
  const categoriasPeriodo = useMemo(() => comprasPorCategoria(delPeriodo, categorias).filter((c) => c.total !== 0 || c.cantidad), [delPeriodo, categorias]);
  const proveedores = useMemo(() => {
    const m = new Map<string, { nombre: string; total: number; cantidad: number; saldo: number }>();
    for (const d of delPeriodo) {
      const nombre = d.proveedor?.razonSocial || 'Sin proveedor';
      const e = m.get(nombre) || { nombre, total: 0, cantidad: 0, saldo: 0 };
      e.total += Number(d.total) || 0;
      e.cantidad += 1;
      e.saldo += Math.max(0, d.saldoPendiente || 0);
      m.set(nombre, e);
    }
    return [...m.values()].sort((a, b) => b.total - a.total).slice(0, 8);
  }, [delPeriodo]);
  const anio = Number(rango.hasta.slice(0, 4));
  const meses = useMemo(() => resumenMensual([], documentos, anio), [documentos, anio]);
  const ultimos = useMemo(() => [...delPeriodo].sort((a, b) => (b.creadoEn || b.fechaEmision).localeCompare(a.creadoEn || a.fechaEmision)).slice(0, 12), [delPeriodo]);
  const etiquetaPeriodo = rango.desde === rango.hasta ? formatFecha(rango.desde) : `${formatFecha(rango.desde)} a ${formatFecha(rango.hasta)}`;

  return (
    <div className="space-y-6">
      <div className={`${tarjeta} !space-y-3`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Panel de Compras y Gastos</h2>
            <p className="text-xs text-slate-500">{etiquetaPeriodo} · para validar lo comprado, lo gastado y lo que se debe</p>
          </div>
          <div className="flex gap-2">
            {onIrACompras && (
              <button onClick={onIrACompras} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold">
                Ver compras y gastos <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
            {onNuevaCompra && (
              <button onClick={onNuevaCompra} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
                <Plus className="w-4 h-4" /> Registrar compra o gasto
              </button>
            )}
          </div>
        </div>
        <SelectorPeriodo periodo={periodo} onPeriodo={setPeriodo} desde={rangoLibre.desde} hasta={rangoLibre.hasta} onRango={(desde, hasta) => setRangoLibre({ desde, hasta })} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3" aria-label="Indicadores de compras y gastos">
        <Indicador titulo="Compras" valor={formatCOP(r.compras)} detalle="mercancía e insumos" icono={<ReceiptText className="w-4 h-4" />} />
        <Indicador titulo="Gastos" valor={formatCOP(r.gastos)} detalle="arriendo, servicios, nómina…" icono={<FileText className="w-4 h-4" />} />
        <Indicador titulo="Total egresos" valor={formatCOP(r.total)} detalle={`${r.cantidad} documento(s)`} icono={<Wallet className="w-4 h-4" />} />
        <Indicador titulo="IVA descontable" valor={formatCOP(r.ivaDescontable)} detalle="Formulario 300" icono={<Percent className="w-4 h-4" />} />
        <Indicador titulo="Retenciones" valor={formatCOP(r.retenciones)} detalle="practicadas (F350)" icono={<Percent className="w-4 h-4" />} />
        <Indicador titulo="Al inventario" valor={String(r.conInventario)} detalle="compras que sumaron existencias" icono={<Boxes className="w-4 h-4" />} />
      </div>

      <section className={tarjeta} aria-label="Control de facturas">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Control de facturas (todas las fechas)</h3>
            <p className="text-xs text-slate-500">Cuánto se debe, qué tiene saldo, qué está vencido y qué está pagado.</p>
          </div>
          {onIrACuentasPorPagar && (
            <button onClick={onIrACuentasPorPagar} className="flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
              Ir a Cuentas por Pagar <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {ESTADOS_FACTURA.map((e) => {
            const c = control[e.id];
            const pagadas = e.id === 'pagada';
            return (
              <div key={e.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
                <span className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {e.label} <span className={`text-base font-black ${COLOR_ESTADO[e.id]}`}>{c.cantidad}</span>
                </span>
                <p className="text-lg font-black tabular-nums text-slate-900 dark:text-white mt-1">{formatCOP(pagadas ? c.total : c.saldo)}</p>
                <span className="text-[10px] text-slate-500">{pagadas ? 'valor facturado' : 'saldo por pagar'}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className={tarjeta} aria-label="Vencimientos próximos">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
          <CalendarClock className="w-4 h-4 text-amber-600" /> Vencidas y por vencer en los próximos 7 días
        </h3>
        {vencimientos.length ? (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {vencimientos.slice(0, 10).map((d) => (
              <li key={d.id} className="py-2 flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">{d.proveedor?.razonSocial}</span>
                  <span className="text-[10px] text-slate-500">
                    {d.prefijo}
                    {d.folio} · vence {formatFecha(d.fechaVencimiento)}
                  </span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block font-bold tabular-nums">{formatCOP(d.saldoPendiente)}</span>
                  <span className={`text-[10px] font-semibold ${d.diasRestantes < 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                    {d.diasRestantes < 0 ? (
                      <span className="inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> vencida hace {-d.diasRestantes} día(s)</span>
                    ) : d.diasRestantes === 0 ? 'vence hoy' : `faltan ${d.diasRestantes} día(s)`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500">No hay facturas vencidas ni por vencer esta semana.</p>
        )}
      </section>

      <section className={tarjeta} aria-label="Compras y gastos por categoría del periodo">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Compras y gastos por categoría</h3>
        {categoriasPeriodo.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {categoriasPeriodo.map((c) => (
              <TarjetaResumen
                key={c.id}
                titulo={c.nombre}
                estilo={c.esGasto ? ESTILO_GASTO : ESTILO_COMPRA}
                colorPunto={c.color}
                total={c.total}
                porcentaje={c.porcentaje}
                detalle={`${c.cantidad} documento${c.cantidad !== 1 ? 's' : ''} · ${c.esGasto ? 'Gasto' : 'Compra'}`}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Sin compras ni gastos en el periodo.</p>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className={tarjeta} aria-label="Proveedores del periodo">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Proveedores del periodo</h3>
          {proveedores.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {proveedores.map((p) => (
                <li key={p.nombre} className="py-2 flex justify-between gap-3">
                  <span className="min-w-0">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">{p.nombre}</span>
                    <span className="text-[10px] text-slate-500">{p.cantidad} documento(s){p.saldo > 0 ? ` · debe ${formatCOP(p.saldo)}` : ''}</span>
                  </span>
                  <span className="font-bold tabular-nums shrink-0">{formatCOP(p.total)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">Sin compras en el periodo.</p>
          )}
        </section>

        <section className={tarjeta} aria-label="Compras y gastos mes a mes">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Compras y gastos mes a mes ({anio})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {meses.map((m) => (
              <div key={m.mes} className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px]">
                <span className="block text-[10px] font-bold text-slate-500 uppercase">{m.nombre}</span>
                <span className="flex justify-between gap-1"><span className="text-slate-500">Compras</span><span className="font-semibold tabular-nums">{formatCOP(m.compras)}</span></span>
                <span className="flex justify-between gap-1"><span className="text-slate-500">Gastos</span><span className="font-semibold tabular-nums">{formatCOP(m.gastos)}</span></span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className={tarjeta} aria-label="Últimos documentos del periodo">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Últimos documentos registrados (para validar)</h3>
        {ultimos.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[760px]">
              <thead className="text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-left py-2">Fecha</th>
                  <th className="text-left">Proveedor</th>
                  <th className="text-left">Número</th>
                  <th className="text-left">Tipo</th>
                  <th className="text-left">Forma de pago</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Saldo</th>
                  <th className="text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {ultimos.map((d) => {
                  const e = estadoFactura(d);
                  return (
                    <tr key={d.id}>
                      <td className="py-2">{formatFecha(d.fechaEmision)}</td>
                      <td className="max-w-[180px] truncate">{d.proveedor?.razonSocial}</td>
                      <td className="font-mono">
                        {d.prefijo}
                        {d.folio}
                      </td>
                      <td>
                        {d.esGasto ? 'Gasto' : 'Compra'}
                        {d.afectaInventario ? ' · inventario' : ''}
                      </td>
                      <td>{etiquetaFormaPago(d.formaPago)}</td>
                      <td className="text-right font-bold tabular-nums">{formatCOP(d.total)}</td>
                      <td className="text-right tabular-nums">{formatCOP(d.saldoPendiente)}</td>
                      <td className={`text-right font-semibold ${COLOR_ESTADO[e]}`}>{ESTADOS_FACTURA.find((x) => x.id === e)?.label.replace(/s$/, '')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Sin documentos en el periodo. Cambie el periodo arriba o registre una compra.</p>
        )}
      </section>
    </div>
  );
};
