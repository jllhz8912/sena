/**
 * Cálculo de precios de venta y rentabilidad.
 *
 *   costo directo   = Σ cantidad × valor unitario
 *   costo total     = costo directo × (1 + gastos generales %)
 *   precio sin IVA  = base;  precio cobrado = base × (1 + IVA %)
 *   comisión        = precio cobrado × comisión %   (datáfono, plataforma…)
 *   ganancia        = base − comisión − costo total
 *   margen %        = ganancia / base          (rentabilidad sobre la venta)
 *   markup %        = ganancia / costo total   (ganancia sobre el costo)
 *
 * Despejando la base para el % deseado:
 *   por margen:  base = costo / (1 − m − c·(1+i))
 *   por markup:  base = costo·(1 + k) / (1 − c·(1+i))
 */
import { FichaPrecio } from '../types';

export interface ResultadoPrecio {
  costoDirecto: number;
  gastosGenerales: number;
  costoTotal: number;
  /** Precio sugerido con IVA, ya redondeado (0 si el % pedido es imposible) */
  precioSugerido: number;
  sugeridoSinIva: number;
  /** El margen + comisión llega al 100 %: no existe precio que lo cumpla */
  imposible: boolean;
}

export interface Rentabilidad {
  precioSinIva: number;
  iva: number;
  comision: number;
  ganancia: number;
  margen: number;
  markup: number;
  /** Precio mínimo (con IVA) para no perder: ganancia 0 */
  puntoEquilibrio: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function costoDirecto(f: Pick<FichaPrecio, 'costos'>): number {
  return f.costos.reduce((a, c) => a + (Number(c.cantidad) || 0) * (Number(c.valorUnitario) || 0), 0);
}

export function redondearArriba(valor: number, multiplo: number): number {
  if (!multiplo || multiplo <= 0) return Math.round(valor);
  return Math.ceil(Math.round(valor * 100) / 100 / multiplo) * multiplo;
}

export function calcularPrecio(f: Pick<FichaPrecio, 'costos' | 'gastosGeneralesPct' | 'metodo' | 'porcentajeObjetivo' | 'comisionPct' | 'ivaPct' | 'redondeo'>): ResultadoPrecio {
  const directo = costoDirecto(f);
  const gastos = directo * ((Number(f.gastosGeneralesPct) || 0) / 100);
  const costo = directo + gastos;
  const i = (Number(f.ivaPct) || 0) / 100;
  const c = (Number(f.comisionPct) || 0) / 100;
  const p = (Number(f.porcentajeObjetivo) || 0) / 100;
  const divisor = f.metodo === 'margen' ? 1 - p - c * (1 + i) : 1 - c * (1 + i);
  const imposible = divisor <= 0;
  const base = imposible ? 0 : (f.metodo === 'margen' ? costo : costo * (1 + p)) / divisor;
  const sugerido = imposible ? 0 : redondearArriba(base * (1 + i), Number(f.redondeo) || 0);
  return { costoDirecto: r2(directo), gastosGenerales: r2(gastos), costoTotal: r2(costo), precioSugerido: sugerido, sugeridoSinIva: r2(base), imposible };
}

/** Rentabilidad real de vender a un precio dado (con IVA). */
export function rentabilidad(precioVenta: number, costoTotal: number, ivaPct: number, comisionPct: number): Rentabilidad {
  const i = (Number(ivaPct) || 0) / 100;
  const c = (Number(comisionPct) || 0) / 100;
  const base = (Number(precioVenta) || 0) / (1 + i);
  const comision = (Number(precioVenta) || 0) * c;
  const ganancia = base - comision - costoTotal;
  const divisorEq = 1 - c * (1 + i);
  return {
    precioSinIva: r2(base),
    iva: r2((Number(precioVenta) || 0) - base),
    comision: r2(comision),
    ganancia: r2(ganancia),
    margen: base ? r2((ganancia / base) * 100) : 0,
    markup: costoTotal ? r2((ganancia / costoTotal) * 100) : 0,
    puntoEquilibrio: divisorEq > 0 ? Math.ceil((costoTotal / divisorEq) * (1 + i)) : 0,
  };
}

/** Plantillas de costos para empezar una ficha nueva. */
export const PLANTILLA_COSTOS: Record<FichaPrecio['tipo'], { concepto: string; cantidad: number }[]> = {
  producto: [
    { concepto: 'Costo de compra (sin IVA)', cantidad: 1 },
    { concepto: 'Flete o transporte', cantidad: 1 },
  ],
  servicio: [
    { concepto: 'Insumos y medicamentos', cantidad: 1 },
    { concepto: 'Mano de obra (minutos)', cantidad: 30 },
    { concepto: 'Desechables (guantes, jeringas…)', cantidad: 1 },
  ],
};
