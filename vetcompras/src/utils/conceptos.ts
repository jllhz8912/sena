/**
 * Catálogo único de conceptos: productos, servicios y conceptos de gasto que se
 * usan al vender, comprar o registrar gastos. Los productos creados antes de
 * esta versión no tienen tipo ni usos y se interpretan como productos de venta
 * y compra con control de inventario.
 */
import { Producto, UsoConcepto, Venta } from '../types';
import { buscarProducto, normalizarNombre } from './inventario';
import { itemsDeVenta } from './ventas';

export type TipoConcepto = NonNullable<Producto['tipo']>;

export const TIPOS_CONCEPTO: { id: TipoConcepto; label: string; ayuda: string }[] = [
  { id: 'producto', label: 'Producto', ayuda: 'Se compra y se vende; lleva existencias en Inventario.' },
  { id: 'servicio', label: 'Servicio', ayuda: 'Consultas, baños, cirugías…: se vende, no lleva existencias.' },
  { id: 'gasto', label: 'Concepto de gasto', ayuda: 'Arriendo, servicios públicos, honorarios…: se registra como gasto.' },
];

export const USOS_CONCEPTO: { id: UsoConcepto; label: string }[] = [
  { id: 'venta', label: 'Ventas' },
  { id: 'compra', label: 'Compras' },
  { id: 'gasto', label: 'Gastos' },
];

export const tipoDe = (p: Pick<Producto, 'tipo'>): TipoConcepto => p.tipo || 'producto';

export function usosPorDefecto(tipo: TipoConcepto): UsoConcepto[] {
  return tipo === 'servicio' ? ['venta'] : tipo === 'gasto' ? ['gasto'] : ['venta', 'compra'];
}

export function usosDe(p: Pick<Producto, 'tipo' | 'usos'>): UsoConcepto[] {
  return p.usos?.length ? p.usos : usosPorDefecto(tipoDe(p));
}

export const sirvePara = (p: Pick<Producto, 'tipo' | 'usos' | 'activo'>, uso: UsoConcepto): boolean =>
  p.activo !== false && usosDe(p).includes(uso);

/** ¿Lleva existencias? Solo productos, salvo que se haya desactivado a mano. */
export function controlaInventario(p: Pick<Producto, 'tipo' | 'controlaInventario'>): boolean {
  return tipoDe(p) === 'producto' && p.controlaInventario !== false;
}

/** Conceptos que sirven para un uso, por nombre. */
export function conceptosPara(productos: Producto[], uso: UsoConcepto | UsoConcepto[]): Producto[] {
  const usos = Array.isArray(uso) ? uso : [uso];
  return productos
    .filter((p) => usos.some((u) => sirvePara(p, u)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** ¿Ya existe otro concepto con el mismo nombre o código? */
export function conceptoDuplicado(productos: Producto[], c: Pick<Producto, 'id' | 'nombre' | 'codigo'>): Producto | undefined {
  const n = normalizarNombre(c.nombre);
  const cod = c.codigo?.trim().toLowerCase();
  return productos.find(
    (p) => p.id !== c.id && ((n && normalizarNombre(p.nombre) === n) || (!!cod && p.codigo?.trim().toLowerCase() === cod))
  );
}

export interface ConceptoVendido {
  nombre: string;
  categoria: string;
  subcategoria?: string;
  /** Último precio cobrado */
  precio: number;
  veces: number;
  tipo: 'producto' | 'servicio';
}

/**
 * Lo que se ha vendido escribiéndolo a mano y todavía no está en el catálogo,
 * para crearlo como concepto con su categoría y último precio.
 */
export function vendidosSinCatalogo(ventas: Venta[], productos: Producto[], esServicio: (categoria: string) => boolean): ConceptoVendido[] {
  const mapa = new Map<string, ConceptoVendido>();
  for (const v of [...ventas].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))) {
    for (const i of itemsDeVenta(v)) {
      const nombre = (i.concepto || '').trim();
      const k = normalizarNombre(nombre);
      if (!k || (i.productoId && productos.some((p) => p.id === i.productoId))) continue;
      if (buscarProducto(productos, { nombre })) continue;
      const previo = mapa.get(k);
      mapa.set(k, {
        nombre: previo?.nombre || nombre,
        categoria: i.categoria,
        subcategoria: i.subcategoria,
        precio: Number(i.precioUnitario) || previo?.precio || 0,
        veces: (previo?.veces || 0) + 1,
        tipo: esServicio(i.categoria) ? 'servicio' : 'producto',
      });
    }
  }
  return [...mapa.values()].sort((a, b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre, 'es'));
}
