/**
 * Cartera de compras a crédito (cuentas por pagar a proveedores).
 */
import type { CompraDocumento } from '../types';
import { diasParaVencimiento } from './formatters';

export type EstadoVencimiento = 'vencida' | 'hoy' | 'manana' | 'semana' | 'al_dia' | 'pagada';

export const ETIQUETA_VENCIMIENTO: Record<EstadoVencimiento, string> = {
  vencida: 'Vencida',
  hoy: 'Vence hoy',
  manana: 'Vence mañana',
  semana: 'Vence esta semana',
  al_dia: 'Al día',
  pagada: 'Pagada',
};

/** Clasifica una factura según los días que faltan para su vencimiento. */
export function estadoVencimiento(doc: CompraDocumento, hoy?: Date): EstadoVencimiento {
  if (!(doc.saldoPendiente > 0)) return 'pagada';
  const dias = diasHasta(doc.fechaVencimiento, hoy);
  if (dias === null) return 'al_dia';
  if (dias < 0) return 'vencida';
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'manana';
  if (dias <= 7) return 'semana';
  return 'al_dia';
}

export function diasHasta(fecha: string | undefined, hoy?: Date): number | null {
  if (!hoy) return diasParaVencimiento(fecha);
  if (!fecha) return null;
  const [y, m, d] = fecha.split('T')[0].split('-').map(Number);
  const base = new Date(hoy);
  base.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d).getTime() - base.getTime()) / 86400000);
}

/** Texto corto para la columna de días: "Vencida hace 3 días", "Vence mañana", "Faltan 12 días". */
export function textoDias(doc: CompraDocumento, hoy?: Date): string {
  const dias = diasHasta(doc.fechaVencimiento, hoy);
  if (!(doc.saldoPendiente > 0)) return 'Pagada';
  if (dias === null) return 'Sin fecha';
  if (dias < 0) return `Vencida hace ${-dias} día${dias === -1 ? '' : 's'}`;
  if (dias === 0) return 'Vence hoy';
  if (dias === 1) return 'Vence mañana';
  return `Faltan ${dias} días`;
}

export function totalAbonado(doc: CompraDocumento): number {
  return (doc.pagos || []).reduce((s, p) => s + (Number(p.monto) || 0), 0);
}

/** Lo que se le paga al proveedor: total de la factura menos retenciones practicadas. */
export function netoAPagar(doc: CompraDocumento): number {
  return Math.max(0, Math.abs(doc.total) - Math.abs(doc.totalRetenciones || 0));
}

/** Facturas con saldo, de la más urgente a la menos urgente. */
export function cuentasPorPagar(documentos: CompraDocumento[]): CompraDocumento[] {
  return documentos
    .filter((d) => d.saldoPendiente > 0)
    .sort((a, b) => (a.fechaVencimiento || '9999').localeCompare(b.fechaVencimiento || '9999'));
}

export interface ResumenAlertas {
  vencidas: CompraDocumento[];
  hoy: CompraDocumento[];
  manana: CompraDocumento[];
  semana: CompraDocumento[];
  urgentes: number; // vencidas + hoy + mañana
}

export function resumenAlertas(documentos: CompraDocumento[], hoy?: Date): ResumenAlertas {
  const r: ResumenAlertas = { vencidas: [], hoy: [], manana: [], semana: [], urgentes: 0 };
  for (const d of cuentasPorPagar(documentos)) {
    const e = estadoVencimiento(d, hoy);
    if (e === 'vencida') r.vencidas.push(d);
    else if (e === 'hoy') r.hoy.push(d);
    else if (e === 'manana') r.manana.push(d);
    else if (e === 'semana') r.semana.push(d);
  }
  r.urgentes = r.vencidas.length + r.hoy.length + r.manana.length;
  return r;
}

export const sumaSaldos = (docs: CompraDocumento[]) => docs.reduce((s, d) => s + d.saldoPendiente, 0);
