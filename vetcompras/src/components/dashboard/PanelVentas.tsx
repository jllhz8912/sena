import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Banknote, CreditCard, Plus, Receipt, ShoppingCart, Users, Wallet } from 'lucide-react';
import { Venta } from '../../types';
import { MEDIOS_PAGO_VENTA, formatCOP, formatFecha, getCategoriaVentaInfo } from '../../utils/formatters';
import { PERIODOS, Periodo, enRango, rangoPeriodo, resumenVentasPanel } from '../../utils/paneles';
import { resumenMensual, ventasPorCategoria } from '../../utils/resumenes';
import { saldoDeVenta } from '../../utils/ventas';
import { ESTILO_GENERICO, TarjetaResumen, definicionesCategoriasVenta } from '../common/TarjetaResumen';

interface PanelVentasProps {
  ventas: Venta[];
  onNuevaVenta?: () => void;
  onIrAVentas?: () => void;
}

const tarjeta = 'p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4';
const input = 'px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs';
const MEDIOS = [...MEDIOS_PAGO_VENTA, { id: 'credito' as const, label: 'Crédito (por cobrar)' }];

/** Selector de periodo compartido por los paneles de Ventas y de Compras y Gastos. */
export const SelectorPeriodo: React.FC<{
  periodo: Periodo;
  onPeriodo: (p: Periodo) => void;
  desde: string;
  hasta: string;
  onRango: (desde: string, hasta: string) => void;
}> = ({ periodo, onPeriodo, desde, hasta, onRango }) => (
  <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Periodo">
    {PERIODOS.map((p) => (
      <button
        key={p.id}
        type="button"
        id={`periodo-${p.id}`}
        aria-pressed={periodo === p.id}
        onClick={() => onPeriodo(p.id)}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
          periodo === p.id ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
        }`}
      >
        {p.label}
      </button>
    ))}
    {periodo === 'personalizado' && (
      <span className="flex items-center gap-1.5 text-xs">
        <input type="date" value={desde} onChange={(e) => onRango(e.target.value, hasta)} className={input} aria-label="Desde" />
        <span>a</span>
        <input type="date" value={hasta} onChange={(e) => onRango(desde, e.target.value)} className={input} aria-label="Hasta" />
      </span>
    )}
  </div>
);

export const Indicador: React.FC<{ titulo: string; valor: string; detalle?: string; icono: React.ReactNode; tono?: 'normal' | 'bueno' | 'alerta' }> = ({ titulo, valor, detalle, icono, tono = 'normal' }) => (
  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 min-w-0">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{titulo}</span>
      <span className="text-slate-400">{icono}</span>
    </div>
    <p
      className={`mt-1.5 text-lg 2xl:text-2xl font-black tabular-nums whitespace-nowrap ${
        tono === 'alerta' ? 'text-rose-600 dark:text-rose-400' : tono === 'bueno' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
      }`}
    >
      {valor}
    </p>
    {detalle && <p className="text-[11px] text-slate-500 mt-0.5">{detalle}</p>}
  </div>
);

/**
 * Panel del perfil Ventas: lo vendido en el periodo, cómo se cobró, por categoría,
 * lo más vendido, lo pendiente por cobrar y las últimas ventas para validarlas.
 */
export const PanelVentas: React.FC<PanelVentasProps> = ({ ventas, onNuevaVenta, onIrAVentas }) => {
  const [periodo, setPeriodo] = useState<Periodo>('hoy');
  const [rangoLibre, setRangoLibre] = useState(() => rangoPeriodo('mes'));
  const rango = useMemo(() => rangoPeriodo(periodo, new Date(), rangoLibre), [periodo, rangoLibre]);
  const delPeriodo = useMemo(() => ventas.filter((v) => enRango(v.fecha, rango)), [ventas, rango]);
  const r = useMemo(() => resumenVentasPanel(delPeriodo), [delPeriodo]);
  const categorias = useMemo(() => ventasPorCategoria(delPeriodo, definicionesCategoriasVenta(), (k) => getCategoriaVentaInfo(k).label), [delPeriodo]);
  const estilo = (k: string) => definicionesCategoriasVenta().find((d) => d.key === k) || ESTILO_GENERICO;
  const anio = Number(rango.hasta.slice(0, 4));
  const meses = useMemo(() => resumenMensual(ventas, [], anio), [ventas, anio]);
  const porCobrar = useMemo(() => ventas.filter((v) => saldoDeVenta(v) > 0).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')), [ventas]);
  const ultimas = useMemo(() => [...delPeriodo].sort((a, b) => (b.fecha + b.creadoEn).localeCompare(a.fecha + a.creadoEn)).slice(0, 12), [delPeriodo]);
  const etiquetaPeriodo = rango.desde === rango.hasta ? formatFecha(rango.desde) : `${formatFecha(rango.desde)} a ${formatFecha(rango.hasta)}`;

  return (
    <div className="space-y-6">
      <div className={`${tarjeta} !space-y-3`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Panel de Ventas</h2>
            <p className="text-xs text-slate-500">{etiquetaPeriodo} · para validar lo vendido y lo cobrado</p>
          </div>
          <div className="flex gap-2">
            {onIrAVentas && (
              <button onClick={onIrAVentas} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold">
                Ver todas las ventas <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
            {onNuevaVenta && (
              <button onClick={onNuevaVenta} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
                <Plus className="w-4 h-4" /> Nueva venta
              </button>
            )}
          </div>
        </div>
        <SelectorPeriodo periodo={periodo} onPeriodo={setPeriodo} desde={rangoLibre.desde} hasta={rangoLibre.hasta} onRango={(desde, hasta) => setRangoLibre({ desde, hasta })} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3" aria-label="Indicadores de ventas">
        <Indicador titulo="Total vendido" valor={formatCOP(r.total)} detalle={`${r.cantidad} venta(s)`} icono={<ShoppingCart className="w-4 h-4" />} />
        <Indicador titulo="Ticket promedio" valor={formatCOP(r.ticketPromedio)} detalle="por venta" icono={<Receipt className="w-4 h-4" />} />
        <Indicador titulo="Cobrado" valor={formatCOP(r.cobrado)} detalle="efectivo, transferencias y tarjeta" icono={<Wallet className="w-4 h-4" />} tono="bueno" />
        <Indicador titulo="Por cobrar del periodo" valor={formatCOP(r.porCobrar)} detalle="ventas a crédito" icono={<CreditCard className="w-4 h-4" />} tono={r.porCobrar > 0 ? 'alerta' : 'normal'} />
        <Indicador
          titulo="Cartera total por cobrar"
          valor={formatCOP(porCobrar.reduce((s, v) => s + saldoDeVenta(v), 0))}
          detalle={`${porCobrar.length} cliente(s) / venta(s)`}
          icono={<Users className="w-4 h-4" />}
          tono={porCobrar.length ? 'alerta' : 'normal'}
        />
      </div>

      <section className={tarjeta} aria-label="Cobrado por medio de pago">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Cómo se cobró (cuadre de caja)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {MEDIOS.map((m) => {
            const valor = r.porMedio[m.id] || 0;
            const pct = r.total > 0 ? (valor / r.total) * 100 : 0;
            return (
              <div key={m.id} className={`p-3 rounded-2xl border ${m.id === 'credito' ? 'border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/20' : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30'}`}>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <Banknote className="w-3.5 h-3.5" /> {m.label}
                </span>
                <p className="text-base font-black tabular-nums text-slate-900 dark:text-white mt-1">{formatCOP(valor)}</p>
                <span className="text-[10px] text-slate-500">{pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500">En efectivo puede aparecer más de lo vendido cuando el cliente pagó con billete grande (incluye el cambio entregado).</p>
      </section>

      <section className={tarjeta} aria-label="Ventas por categoría del periodo">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Ventas por categoría</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {categorias.map((c) => (
            <TarjetaResumen key={c.key} titulo={c.nombre} estilo={estilo(c.key)} total={c.total} porcentaje={c.porcentaje} detalle={`${c.cantidad} venta${c.cantidad !== 1 ? 's' : ''}`} />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className={tarjeta} aria-label="Lo más vendido">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Lo más vendido</h3>
          {r.masVendidos.length ? (
            <ul className="space-y-2.5">
              {r.masVendidos.map((t) => (
                <li key={t.concepto} className="space-y-1">
                  <div className="flex justify-between gap-3 text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{t.concepto}</span>
                    <span className="font-bold tabular-nums shrink-0">{formatCOP(t.total)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${r.total ? Math.min(100, (t.total / r.masVendidos[0].total) * 100) : 0}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-500 w-28 text-right shrink-0">
                      {t.cantidad.toLocaleString('es-CO')} und · {getCategoriaVentaInfo(t.categoria).label}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">Sin ventas en el periodo.</p>
          )}
        </section>

        <section className={tarjeta} aria-label="Ventas por cobrar">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Ventas a crédito por cobrar</h3>
          {porCobrar.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {porCobrar.slice(0, 10).map((v) => (
                <li key={v.id} className="py-2 flex justify-between gap-3">
                  <span className="min-w-0">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">{v.clienteNombre || 'Cliente de mostrador'}</span>
                    <span className="text-[10px] text-slate-500">{v.consecutivo} · {formatFecha(v.fecha)}</span>
                  </span>
                  <span className="font-bold tabular-nums text-rose-600 dark:text-rose-400 shrink-0">{formatCOP(saldoDeVenta(v))}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">No hay ventas pendientes por cobrar.</p>
          )}
        </section>
      </div>

      <section className={tarjeta} aria-label="Últimas ventas del periodo">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Últimas ventas del periodo (para validar)</h3>
        {ultimas.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[640px]">
              <thead className="text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-left py-2">Recibo</th>
                  <th className="text-left">Fecha</th>
                  <th className="text-left">Cliente</th>
                  <th className="text-left">Concepto</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Por cobrar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {ultimas.map((v) => (
                  <tr key={v.id}>
                    <td className="py-2 font-mono font-semibold">{v.consecutivo}</td>
                    <td>{formatFecha(v.fecha)}</td>
                    <td className="max-w-[160px] truncate">{v.clienteNombre || 'Mostrador'}</td>
                    <td className="max-w-[240px] truncate text-slate-500">{v.concepto}</td>
                    <td className="text-right font-bold tabular-nums">{formatCOP(v.monto)}</td>
                    <td className={`text-right tabular-nums ${saldoDeVenta(v) > 0 ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>{formatCOP(saldoDeVenta(v))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Sin ventas en el periodo. Cambie el periodo arriba o registre una venta.</p>
        )}
      </section>

      <section className={tarjeta} aria-label="Ventas mes a mes">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Ventas mes a mes ({anio})</h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {meses.map((m) => (
            <div key={m.mes} className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <span className="block text-[10px] font-bold text-slate-500 uppercase">{m.nombre}</span>
              <span className="font-bold tabular-nums text-slate-900 dark:text-white">{formatCOP(m.ventas)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
