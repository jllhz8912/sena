/**
 * Reglas de negocio de las ventas (ítems, pagos y saldos).
 *
 * Las ventas registradas antes de la venta multi-ítem tienen un solo concepto
 * y un solo medio de pago; estas funciones las presentan con la misma forma
 * que las nuevas para que listados y reportes no distingan entre ellas.
 */
import type { MedioPagoVenta, PagoVenta, Venta, VentaItem } from '../types';

export const redondear = (v: number) => Math.round(Number(v) || 0);

export function subtotalItem(item: Pick<VentaItem, 'cantidad' | 'precioUnitario' | 'descuento'>): number {
  return Math.max(0, redondear((Number(item.cantidad) || 0) * (Number(item.precioUnitario) || 0) - (Number(item.descuento) || 0)));
}

export function itemsDeVenta(v: Venta): VentaItem[] {
  if (v.items && v.items.length > 0) return v.items;
  return [
    {
      id: `${v.id}-1`,
      categoria: v.categoria,
      subcategoria: v.subcategoria,
      concepto: v.concepto,
      cantidad: 1,
      precioUnitario: v.monto,
      subtotal: v.monto,
    },
  ];
}

export function pagosDeVenta(v: Venta): PagoVenta[] {
  if (v.pagos) return v.pagos;
  // Venta antigua: un solo medio; si fue a crédito o quedó pendiente no hubo pago
  if (v.medioPago === 'credito' || v.medioPago === 'mixto' || v.estado === 'pendiente') return [];
  return [{ id: `${v.id}-p1`, medio: v.medioPago, monto: v.monto }];
}

export function totalPagado(v: Pick<Venta, 'pagos'> | PagoVenta[]): number {
  const pagos = Array.isArray(v) ? v : v.pagos || [];
  return pagos.reduce((s, p) => s + redondear(p.monto), 0);
}

export function saldoDeVenta(v: Venta): number {
  if (typeof v.saldoPendiente === 'number') return v.saldoPendiente;
  return Math.max(0, v.monto - totalPagado(pagosDeVenta(v)));
}

/** Valor por medio de pago, incluido lo que quedó a crédito. */
export function montosPorMedio(v: Venta): Partial<Record<MedioPagoVenta, number>> {
  const r: Partial<Record<MedioPagoVenta, number>> = {};
  for (const p of pagosDeVenta(v)) r[p.medio] = (r[p.medio] || 0) + redondear(p.monto);
  const saldo = saldoDeVenta(v);
  if (saldo > 0) r.credito = (r.credito || 0) + saldo;
  return r;
}

export function resumirConcepto(items: VentaItem[]): string {
  if (items.length === 0) return '';
  const nombres = items.map((i) => (i.cantidad > 1 ? `${i.concepto} x${i.cantidad}` : i.concepto));
  const texto = nombres.join(', ');
  return texto.length > 160 ? texto.slice(0, 157) + '...' : texto;
}

/**
 * Completa los campos derivados (total, categoría principal, concepto,
 * medio principal, saldo y estado) a partir de ítems y pagos.
 */
export function cerrarVenta(base: Omit<Venta, 'monto' | 'categoria' | 'concepto' | 'medioPago' | 'estado' | 'saldoPendiente'>): Venta {
  const items = (base.items || []).map((i) => ({ ...i, subtotal: subtotalItem(i) }));
  const monto = items.reduce((s, i) => s + i.subtotal, 0);
  const pagos = (base.pagos || []).filter((p) => redondear(p.monto) > 0).map((p) => ({ ...p, monto: redondear(p.monto) }));
  const pagado = totalPagado(pagos);
  const saldo = Math.max(0, monto - pagado);
  const principal = [...items].sort((a, b) => b.subtotal - a.subtotal)[0];
  const mediosDistintos = new Set(pagos.map((p) => p.medio));

  let medioPago: Venta['medioPago'];
  if (pagos.length === 0) medioPago = 'credito';
  else if (mediosDistintos.size > 1 || saldo > 0) medioPago = 'mixto';
  else medioPago = pagos[0].medio;

  return {
    ...base,
    items,
    pagos,
    monto,
    saldoPendiente: saldo,
    categoria: principal?.categoria || 'varios',
    subcategoria: principal?.subcategoria,
    concepto: resumirConcepto(items),
    medioPago,
    estado: saldo === 0 ? 'pagada' : pagado > 0 ? 'parcial' : 'pendiente',
  };
}

/** Cambio a devolver cuando el cliente entrega más efectivo del que paga. */
export function cambioEfectivo(pagos: PagoVenta[]): number {
  return pagos
    .filter((p) => p.medio === 'efectivo' && p.recibido && p.recibido > p.monto)
    .reduce((s, p) => s + (redondear(p.recibido!) - redondear(p.monto)), 0);
}

/** Categorías antiguas equivalentes a las actuales. */
export function categoriaNormalizada(categoria: string): string {
  const alias: Record<string, string> = {
    pet_shop: 'vitrina',
    clinica: 'consultas_clinica',
    purinas: 'purinas_empaque',
    medicamentos: 'tratamientos_clinica',
  };
  return alias[categoria] || categoria;
}
