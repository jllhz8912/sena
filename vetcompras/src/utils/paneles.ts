/**
 * Cálculos de los paneles por perfil (Ventas y Compras y Gastos): periodo,
 * indicadores, medios de pago, lo más vendido y vencimientos próximos.
 */
import { CompraDocumento, MedioPagoVenta, Venta } from '../types';
import { diasHasta } from './cartera';
import { itemsDeVenta, montosPorMedio, saldoDeVenta } from './ventas';

export type Periodo = 'hoy' | 'semana' | 'mes' | 'anio' | 'personalizado';

export const PERIODOS: { id: Periodo; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mes' },
  { id: 'anio', label: 'Este año' },
  { id: 'personalizado', label: 'Rango de fechas' },
];

export interface Rango {
  desde: string;
  hasta: string;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Fechas del periodo (la semana empieza el lunes). */
export function rangoPeriodo(periodo: Periodo, hoy: Date = new Date(), personalizado?: Partial<Rango>): Rango {
  const h = iso(hoy);
  if (periodo === 'hoy') return { desde: h, hasta: h };
  if (periodo === 'semana') {
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
    return { desde: iso(lunes), hasta: h };
  }
  if (periodo === 'mes') return { desde: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: h };
  if (periodo === 'anio') return { desde: `${hoy.getFullYear()}-01-01`, hasta: h };
  const desde = personalizado?.desde || iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const hasta = personalizado?.hasta || h;
  return desde <= hasta ? { desde, hasta } : { desde: hasta, hasta: desde };
}

export const enRango = (fecha: string | undefined, r: Rango) => !!fecha && fecha.slice(0, 10) >= r.desde && fecha.slice(0, 10) <= r.hasta;

export interface ResumenVentasPanel {
  total: number;
  cantidad: number;
  ticketPromedio: number;
  cobrado: number;
  porCobrar: number;
  porMedio: Partial<Record<MedioPagoVenta, number>>;
  masVendidos: { concepto: string; categoria: string; cantidad: number; total: number }[];
}

/** Indicadores de las ventas del periodo (ya filtradas). */
export function resumenVentasPanel(ventas: Venta[], limiteTop = 10): ResumenVentasPanel {
  const porMedio: ResumenVentasPanel['porMedio'] = {};
  const top = new Map<string, { concepto: string; categoria: string; cantidad: number; total: number }>();
  let total = 0;
  let porCobrar = 0;
  for (const v of ventas) {
    total += Number(v.monto) || 0;
    const saldo = saldoDeVenta(v);
    porCobrar += saldo;
    // Incluye "credito" con lo que quedó por cobrar
    for (const [m, valor] of Object.entries(montosPorMedio(v))) porMedio[m as MedioPagoVenta] = (porMedio[m as MedioPagoVenta] || 0) + (valor || 0);
    for (const i of itemsDeVenta(v)) {
      const clave = (i.concepto || '').trim().toLowerCase();
      if (!clave) continue;
      const e = top.get(clave) || { concepto: i.concepto.trim(), categoria: i.categoria, cantidad: 0, total: 0 };
      e.cantidad += Number(i.cantidad) || 0;
      e.total += Number(i.subtotal) || 0;
      top.set(clave, e);
    }
  }
  return {
    total,
    cantidad: ventas.length,
    ticketPromedio: ventas.length ? Math.round(total / ventas.length) : 0,
    cobrado: total - porCobrar,
    porCobrar,
    porMedio,
    masVendidos: [...top.values()].sort((a, b) => b.total - a.total || b.cantidad - a.cantidad).slice(0, limiteTop),
  };
}

export interface ResumenComprasPanel {
  compras: number;
  gastos: number;
  total: number;
  ivaDescontable: number;
  retenciones: number;
  cantidad: number;
  /** Compras de mercancía que sumaron al inventario */
  conInventario: number;
  pagado: number;
  porPagar: number;
}

/** Indicadores de compras y gastos del periodo (ya filtrados). Las notas crédito restan. */
export function resumenComprasPanel(documentos: CompraDocumento[]): ResumenComprasPanel {
  const r: ResumenComprasPanel = { compras: 0, gastos: 0, total: 0, ivaDescontable: 0, retenciones: 0, cantidad: 0, conInventario: 0, pagado: 0, porPagar: 0 };
  for (const d of documentos) {
    const t = Number(d.total) || 0;
    if (d.esGasto) r.gastos += t;
    else r.compras += t;
    r.ivaDescontable += Number(d.totalIva) || 0;
    r.retenciones += Number(d.totalRetenciones) || 0;
    r.cantidad += 1;
    if (d.afectaInventario) r.conInventario += 1;
    r.porPagar += Math.max(0, Number(d.saldoPendiente) || 0);
  }
  r.total = r.compras + r.gastos;
  r.pagado = Math.max(0, r.total - r.retenciones - r.porPagar);
  return r;
}

/** Facturas con saldo vencidas o que vencen en los próximos días, de la más urgente a la menos. */
export function proximosVencimientos(documentos: CompraDocumento[], dias = 7, hoy?: Date): (CompraDocumento & { diasRestantes: number })[] {
  return documentos
    .filter((d) => d.saldoPendiente > 0)
    .map((d) => ({ ...d, diasRestantes: diasHasta(d.fechaVencimiento, hoy) ?? 9999 }))
    .filter((d) => d.diasRestantes <= dias)
    .sort((a, b) => a.diasRestantes - b.diasRestantes);
}
