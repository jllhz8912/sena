/**
 * Resúmenes del Panel Central: ventas por categoría, compras y gastos por
 * categoría y movimiento mes a mes. Funciones puras sobre los registros.
 */
import { Categoria, CompraDocumento, Venta } from '../types';
import { categoriaNormalizada, itemsDeVenta } from './ventas';

export interface ResumenCategoriaVenta {
  key: string;
  nombre: string;
  total: number;
  /** Ventas en que aparece la categoría */
  cantidad: number;
  porcentaje: number;
}

const pct = (parte: number, total: number) => (total > 0 ? (parte / total) * 100 : 0);
const porTotal = <T extends { total: number; nombre: string }>(a: T, b: T) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es');

/** Ventas por categoría: todas las categorías vigentes (aunque estén en cero) y las de ventas antiguas. */
export function ventasPorCategoria(ventas: Venta[], categorias: { key: string; label: string }[], nombreDe: (key: string) => string): ResumenCategoriaVenta[] {
  const mapa = new Map<string, ResumenCategoriaVenta>();
  for (const c of categorias) mapa.set(c.key, { key: c.key, nombre: c.label, total: 0, cantidad: 0, porcentaje: 0 });
  for (const v of ventas) {
    const contadas = new Set<string>();
    for (const item of itemsDeVenta(v)) {
      const key = categoriaNormalizada(item.categoria);
      const e = mapa.get(key) || { key, nombre: nombreDe(key), total: 0, cantidad: 0, porcentaje: 0 };
      if (!contadas.has(key)) e.cantidad += 1;
      contadas.add(key);
      e.total += Number(item.subtotal) || 0;
      mapa.set(key, e);
    }
  }
  const lista = [...mapa.values()];
  const gran = lista.reduce((s, x) => s + x.total, 0);
  return lista.map((x) => ({ ...x, porcentaje: pct(x.total, gran) })).sort(porTotal);
}

export interface ResumenCategoriaCompra {
  id: string;
  nombre: string;
  esGasto: boolean;
  color?: string;
  total: number;
  /** Facturas o documentos */
  cantidad: number;
  porcentaje: number;
}

/** Compras y gastos por categoría, con su participación sobre el total de egresos. */
export function comprasPorCategoria(documentos: CompraDocumento[], categorias: Categoria[]): ResumenCategoriaCompra[] {
  const mapa = new Map<string, ResumenCategoriaCompra>();
  for (const c of categorias) {
    if (c.activo === false) continue;
    mapa.set(c.id, { id: c.id, nombre: c.nombre, esGasto: !!c.esGasto, color: c.color, total: 0, cantidad: 0, porcentaje: 0 });
  }
  for (const d of documentos) {
    const id = d.categoriaId || 'sin-categoria';
    const c = categorias.find((x) => x.id === id);
    const e = mapa.get(id) || { id, nombre: c?.nombre || 'Sin categoría', esGasto: !!d.esGasto, color: c?.color, total: 0, cantidad: 0, porcentaje: 0 };
    e.total += Number(d.total) || 0;
    e.cantidad += 1;
    mapa.set(id, e);
  }
  const lista = [...mapa.values()];
  const gran = lista.reduce((s, x) => s + x.total, 0);
  return lista.map((x) => ({ ...x, porcentaje: pct(x.total, gran) })).sort(porTotal);
}

export interface ResumenMes {
  mes: number;
  nombre: string;
  ventas: number;
  compras: number;
  gastos: number;
  /** Ventas menos compras y gastos */
  resultado: number;
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** Ventas, compras, gastos y resultado de cada mes del año. */
export function resumenMensual(ventas: Venta[], documentos: CompraDocumento[], anio: number): ResumenMes[] {
  const meses = MESES.map((nombre, i) => ({ mes: i + 1, nombre, ventas: 0, compras: 0, gastos: 0, resultado: 0 }));
  const mesDe = (fecha: string | undefined) => {
    const [a, m] = (fecha || '').split('-').map((x) => parseInt(x, 10));
    return a === anio && m >= 1 && m <= 12 ? meses[m - 1] : undefined;
  };
  for (const v of ventas) {
    const m = mesDe(v.fecha);
    if (m) m.ventas += Number(v.monto) || 0;
  }
  for (const d of documentos) {
    const m = mesDe(d.fechaEmision);
    if (!m) continue;
    if (d.esGasto) m.gastos += Number(d.total) || 0;
    else m.compras += Number(d.total) || 0;
  }
  return meses.map((m) => ({ ...m, resultado: m.ventas - m.compras - m.gastos }));
}
