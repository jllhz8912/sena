import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock,
  HandCoins,
  Search,
  Trash2,
  Wallet,
} from 'lucide-react';
import { CompraDocumento } from '../../types';
import { formatCOP, formatFecha } from '../../utils/formatters';
import {
  cuentasPorPagar,
  estadoVencimiento,
  EstadoVencimiento,
  netoAPagar,
  resumenAlertas,
  sumaSaldos,
  textoDias,
  totalAbonado,
} from '../../utils/cartera';
import { dataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { RegistrarAbonoModal } from '../listado/RegistrarAbonoModal';

interface CuentasPorPagarViewProps {
  documentos: CompraDocumento[];
  onDatosActualizados: () => void;
}

const COLOR_ESTADO: Record<EstadoVencimiento, string> = {
  vencida: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
  hoy: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800',
  manana: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  semana: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
  al_dia: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  pagada: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

type Filtro = 'todas' | 'urgentes' | EstadoVencimiento;

export const CuentasPorPagarView: React.FC<CuentasPorPagarViewProps> = ({ documentos, onDatosActualizados }) => {
  const { mostrarToast } = useToast();
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [expandida, setExpandida] = useState<string | null>(null);
  const [pago, setPago] = useState<{ doc: CompraDocumento; modo: 'abono' | 'total' } | null>(null);
  const [anulando, setAnulando] = useState<{ doc: CompraDocumento; pagoId: string } | null>(null);
  const [motivo, setMotivo] = useState('');
  const esAdmin = dataService.esAdministrador();

  const pendientes = useMemo(() => cuentasPorPagar(documentos), [documentos]);
  const alertas = useMemo(() => resumenAlertas(documentos), [documentos]);
  const alDia = pendientes.filter((d) => estadoVencimiento(d) === 'al_dia');

  const visibles = pendientes.filter((d) => {
    const e = estadoVencimiento(d);
    if (filtro === 'urgentes' && !['vencida', 'hoy', 'manana'].includes(e)) return false;
    if (filtro !== 'todas' && filtro !== 'urgentes' && e !== filtro) return false;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      return `${d.proveedor?.razonSocial} ${d.proveedor?.nit} ${d.prefijo}${d.folio}`.toLowerCase().includes(q);
    }
    return true;
  });

  // Deuda agrupada por proveedor
  const porProveedor = useMemo(() => {
    const mapa = new Map<string, { nombre: string; saldo: number; facturas: number; vencido: number }>();
    for (const d of pendientes) {
      const clave = (d.proveedor?.nit || d.proveedor?.razonSocial || '').replace(/\D/g, '') || d.proveedor?.razonSocial || '?';
      const r = mapa.get(clave) || { nombre: d.proveedor?.razonSocial || 'Proveedor', saldo: 0, facturas: 0, vencido: 0 };
      r.saldo += d.saldoPendiente;
      r.facturas += 1;
      if (estadoVencimiento(d) === 'vencida') r.vencido += d.saldoPendiente;
      mapa.set(clave, r);
    }
    return [...mapa.values()].sort((a, b) => b.saldo - a.saldo);
  }, [pendientes]);

  const confirmarAnulacion = async () => {
    if (!anulando) return;
    if (!motivo.trim()) {
      mostrarToast('warning', 'Escriba el motivo', 'Queda registrado en el historial de la factura.');
      return;
    }
    try {
      await dataService.anularAbono(anulando.doc.id, anulando.pagoId, motivo.trim());
      mostrarToast('success', 'Abono anulado', 'El valor volvió al saldo de la factura.');
      setAnulando(null);
      setMotivo('');
      onDatosActualizados();
    } catch (err: any) {
      mostrarToast('error', 'No se anuló el abono', err?.message);
    }
  };

  const tarjetas: { id: Filtro; titulo: string; docs: CompraDocumento[]; icono: React.ElementType; color: string }[] = [
    { id: 'todas', titulo: 'Total por pagar', docs: pendientes, icono: Wallet, color: 'text-slate-900 dark:text-white' },
    { id: 'vencida', titulo: 'Vencidas', docs: alertas.vencidas, icono: AlertTriangle, color: 'text-rose-700 dark:text-rose-300' },
    { id: 'hoy', titulo: 'Vencen hoy', docs: alertas.hoy, icono: Clock, color: 'text-orange-700 dark:text-orange-300' },
    { id: 'manana', titulo: 'Vencen mañana', docs: alertas.manana, icono: CalendarClock, color: 'text-amber-700 dark:text-amber-300' },
    { id: 'semana', titulo: 'Próximos 7 días', docs: alertas.semana, icono: CalendarClock, color: 'text-sky-700 dark:text-sky-300' },
    { id: 'al_dia', titulo: 'Al día', docs: alDia, icono: CheckCircle2, color: 'text-emerald-700 dark:text-emerald-300' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <HandCoins className="w-5 h-5 text-emerald-600" /> Cuentas por pagar a proveedores
        </h2>
        <p className="text-xs text-slate-500">
          Facturas a crédito con saldo. El saldo es el valor de la factura menos retenciones practicadas y abonos.
        </p>
      </div>

      {/* Resumen por vencimiento: cada tarjeta filtra la tabla */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {tarjetas.map(({ id, titulo, docs, icono: Icono, color }) => (
          <button
            key={id}
            onClick={() => setFiltro(id)}
            className={`text-left p-4 rounded-2xl border bg-white dark:bg-slate-900 transition-shadow hover:shadow-md ${
              filtro === id ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{titulo}</span>
              <Icono className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`text-lg font-black tabular-nums ${color}`}>{formatCOP(sumaSaldos(docs))}</p>
            <p className="text-[11px] text-slate-500">{docs.length} factura(s)</p>
          </button>
        ))}
      </div>

      <div className="grid 2xl:grid-cols-4 gap-5">
        {/* Tabla de facturas */}
        <div className="2xl:col-span-3 min-w-0 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar proveedor, NIT o factura"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              />
            </div>
            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value as Filtro)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            >
              <option value="todas">Todas las facturas con saldo</option>
              <option value="urgentes">Urgentes (vencidas, hoy y mañana)</option>
              <option value="vencida">Vencidas</option>
              <option value="hoy">Vencen hoy</option>
              <option value="manana">Vencen mañana</option>
              <option value="semana">Próximos 7 días</option>
              <option value="al_dia">Al día</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[860px]">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wide text-[10px]">
                <tr>
                  <th className="w-8" />
                  <th className="text-left py-2.5 px-2">Proveedor / Factura</th>
                  <th className="text-left px-2">Emisión</th>
                  <th className="text-left px-2">Vencimiento</th>
                  <th className="text-left px-2">Estado</th>
                  <th className="text-right px-2">Neto a pagar</th>
                  <th className="text-right px-2">Abonado</th>
                  <th className="text-right px-2">Saldo</th>
                  <th className="text-right px-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visibles.map((d) => {
                  const estado = estadoVencimiento(d);
                  const neto = netoAPagar(d);
                  const abonado = totalAbonado(d);
                  const avance = neto > 0 ? Math.min(100, (abonado / neto) * 100) : 0;
                  const abierta = expandida === d.id;
                  return (
                    <React.Fragment key={d.id}>
                      <tr className={estado === 'vencida' ? 'bg-rose-50/40 dark:bg-rose-950/10' : ''}>
                        <td className="pl-2">
                          <button
                            onClick={() => setExpandida(abierta ? null : d.id)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700"
                            title="Ver abonos"
                            aria-expanded={abierta}
                          >
                            {abierta ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="py-2.5 px-2">
                          <p className="font-semibold text-slate-900 dark:text-white">{d.proveedor?.razonSocial}</p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {d.prefijo}
                            {d.folio} · NIT {d.proveedor?.nit}
                          </p>
                        </td>
                        <td className="px-2 whitespace-nowrap">{formatFecha(d.fechaEmision)}</td>
                        <td className="px-2 whitespace-nowrap font-semibold">{formatFecha(d.fechaVencimiento)}</td>
                        <td className="px-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap ${COLOR_ESTADO[estado]}`}>
                            {textoDias(d)}
                          </span>
                        </td>
                        <td className="px-2 text-right tabular-nums">{formatCOP(neto)}</td>
                        <td className="px-2 text-right tabular-nums">
                          {formatCOP(abonado)}
                          <div className="h-1 mt-1 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${avance}%` }} />
                          </div>
                        </td>
                        <td className="px-2 text-right font-black tabular-nums text-slate-900 dark:text-white">{formatCOP(d.saldoPendiente)}</td>
                        <td className="px-3 text-right whitespace-nowrap space-x-1.5">
                          <button
                            onClick={() => setPago({ doc: d, modo: 'abono' })}
                            className="px-2.5 py-1.5 rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-300 font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          >
                            Abonar
                          </button>
                          <button
                            onClick={() => setPago({ doc: d, modo: 'total' })}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                          >
                            Pagar todo
                          </button>
                        </td>
                      </tr>
                      {abierta && (
                        <tr>
                          <td />
                          <td colSpan={8} className="pb-3 px-2">
                            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3 space-y-1.5">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                Abonos ({(d.pagos || []).length}) · Total factura {formatCOP(Math.abs(d.total))}
                                {d.totalRetenciones ? ` · Retenciones ${formatCOP(Math.abs(d.totalRetenciones))}` : ''}
                              </p>
                              {(d.pagos || []).length === 0 && <p className="text-xs text-slate-400">Sin abonos registrados.</p>}
                              {(d.pagos || []).map((p) => (
                                <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                                  <span>
                                    <strong>{formatFecha(p.fecha)}</strong> · {p.medio}
                                    {p.referencia ? ` · Ref. ${p.referencia}` : ''}
                                    {p.nota ? ` · ${p.nota}` : ''}
                                  </span>
                                  <span className="flex items-center gap-2">
                                    <span className="font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{formatCOP(p.monto)}</span>
                                    {esAdmin && (
                                      <button
                                        onClick={() => setAnulando({ doc: d, pagoId: p.id })}
                                        className="p-1 rounded text-slate-400 hover:text-rose-600"
                                        title="Anular este abono"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400">
                      <CircleDollarSign className="w-6 h-6 mx-auto mb-2" />
                      {pendientes.length === 0 ? 'No hay facturas por pagar. ¡Todo al día!' : 'Ninguna factura coincide con el filtro.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Deuda por proveedor */}
        <aside className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 h-fit">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Deuda por proveedor</h3>
          {porProveedor.length === 0 && <p className="text-xs text-slate-400">Sin deudas.</p>}
          {porProveedor.map((p) => (
            <button
              key={p.nombre}
              onClick={() => setBusqueda(p.nombre)}
              className="w-full text-left text-xs flex items-start justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg p-1.5"
              title="Ver solo las facturas de este proveedor"
            >
              <span className="min-w-0">
                <span className="block font-semibold text-slate-800 dark:text-slate-100 truncate">{p.nombre}</span>
                <span className="text-slate-500">
                  {p.facturas} factura(s){p.vencido > 0 ? ` · vencido ${formatCOP(p.vencido)}` : ''}
                </span>
              </span>
              <span className="font-bold tabular-nums whitespace-nowrap">{formatCOP(p.saldo)}</span>
            </button>
          ))}
        </aside>
      </div>

      {pago && (
        <RegistrarAbonoModal
          documento={pago.doc}
          modo={pago.modo}
          onAbonoRegistrado={onDatosActualizados}
          onCerrar={() => setPago(null)}
        />
      )}

      {anulando && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm space-y-3 shadow-2xl">
            <h3 className="font-bold">¿Anular este abono?</h3>
            <p className="text-xs text-slate-500">
              El valor vuelve al saldo de la factura {anulando.doc.prefijo}
              {anulando.doc.folio}. Queda constancia en el historial y en la bitácora.
            </p>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo (ej. valor digitado por error)"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setAnulando(null)} className="px-4 py-2 rounded-xl border text-sm">
                Cancelar
              </button>
              <button onClick={confirmarAnulacion} className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold">
                Anular abono
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

