/**
 * Catálogo para facturar rápido: reúne en una sola lista lo que se puede vender
 * (fichas de precio, productos del inventario, servicios predefinidos y lo vendido
 * antes) y lo busca por varias variables a la vez.
 */
import { FichaPrecio, Producto, Venta } from '../types';
import { CATEGORIAS_VENTA, SUBCATEGORIAS_POR_CATEGORIA } from './formatters';
import { normalizarNombre } from './inventario';
import { itemsDeVenta } from './ventas';

export type TipoCatalogo = 'producto' | 'servicio';
export type OrigenCatalogo = 'ficha' | 'inventario' | 'historial' | 'catalogo';

export interface EntradaCatalogo {
  clave: string;
  nombre: string;
  tipo: TipoCatalogo;
  categoria: string;
  subcategoria?: string;
  precio: number;
  productoId?: string;
  codigo?: string;
  grupo?: string;
  alias: string[];
  unidad?: string;
  existencia?: number;
  /** Veces vendido (para "más vendidos" y para ordenar) */
  vendidos: number;
  origen: OrigenCatalogo;
}

/** Categorías de venta que corresponden a servicios (el resto son productos). */
export const CATEGORIAS_SERVICIO = new Set(['consultas_clinica', 'tratamientos_clinica', 'vacunas', 'banos']);
const tipoDeCategoria = (c: string): TipoCatalogo => (CATEGORIAS_SERVICIO.has(c) ? 'servicio' : 'producto');
const nombreCategoria = (c: string) => CATEGORIAS_VENTA.find((x) => x.id === c)?.label || c;

export function construirCatalogo(opciones: {
  fichas?: FichaPrecio[];
  productos?: Producto[];
  existencias?: Map<string, number>;
  ventas?: Venta[];
}): EntradaCatalogo[] {
  const { fichas = [], productos = [], existencias = new Map(), ventas = [] } = opciones;
  const mapa = new Map<string, EntradaCatalogo>();
  const vendidos = new Map<string, { veces: number; precio: number; categoria: string }>();
  // Ventas en orden cronológico: el último precio cobrado queda guardado
  for (const v of [...ventas].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))) {
    for (const i of itemsDeVenta(v)) {
      const k = normalizarNombre(i.concepto);
      if (!k) continue;
      const prev = vendidos.get(k);
      vendidos.set(k, { veces: (prev?.veces || 0) + (Number(i.cantidad) || 1), precio: i.precioUnitario || prev?.precio || 0, categoria: i.categoria });
    }
  }
  const agregar = (e: Omit<EntradaCatalogo, 'clave' | 'vendidos'>) => {
    const clave = normalizarNombre(e.nombre);
    if (!clave || mapa.has(clave)) return; // la fuente con más prioridad ya lo agregó
    mapa.set(clave, { ...e, clave, vendidos: vendidos.get(clave)?.veces || 0 });
  };

  // 1) Fichas de precio (precio decidido por la veterinaria)
  for (const f of fichas) {
    if (f.activo === false || !f.nombre) continue;
    const p = f.productoId ? productos.find((x) => x.id === f.productoId) : undefined;
    agregar({
      nombre: f.nombre, tipo: f.tipo, categoria: f.categoriaVenta, precio: f.precioVenta || 0, productoId: f.productoId,
      codigo: p?.codigo, grupo: p?.grupo, alias: p?.alias || [], unidad: f.unidad, existencia: f.productoId ? existencias.get(f.productoId) : undefined, origen: 'ficha',
    });
  }
  // 2) Productos del inventario
  for (const p of productos) {
    if (p.activo === false) continue;
    const vendido = vendidos.get(normalizarNombre(p.nombre));
    agregar({
      nombre: p.nombre, tipo: 'producto', categoria: vendido?.categoria || 'vitrina', precio: p.precioVenta || vendido?.precio || 0, productoId: p.id,
      codigo: p.codigo, grupo: p.grupo, alias: p.alias || [], unidad: p.unidad, existencia: existencias.get(p.id), origen: 'inventario',
    });
  }
  // 3) Lo vendido antes (con su último precio)
  for (const [k, v] of vendidos) {
    if (mapa.has(k)) continue;
    const original = ventas.flatMap(itemsDeVenta).find((i) => normalizarNombre(i.concepto) === k);
    agregar({ nombre: original?.concepto || k, tipo: tipoDeCategoria(v.categoria), categoria: v.categoria, precio: v.precio, alias: [], origen: 'historial' });
  }
  // 4) Servicios y productos predefinidos por categoría (sin precio)
  for (const [cat, lista] of Object.entries(SUBCATEGORIAS_POR_CATEGORIA)) {
    for (const s of lista) agregar({ nombre: s.nombreCorto, tipo: tipoDeCategoria(cat), categoria: cat, subcategoria: s.value, precio: 0, alias: [s.label], origen: 'catalogo' });
  }
  return [...mapa.values()];
}

export interface FiltroCatalogo {
  texto: string;
  categoria?: string;
  tipo?: TipoCatalogo;
  soloFrecuentes?: boolean;
}

/**
 * Busca por palabras sueltas en cualquier orden y sin tildes: cada palabra debe
 * aparecer en el nombre, código, otros nombres, grupo, categoría o tipo. Ordena
 * por coincidencia (código exacto, inicio del nombre, inicio de palabra) y ventas.
 */
export function buscarEnCatalogo(catalogo: EntradaCatalogo[], f: FiltroCatalogo, limite = 30): EntradaCatalogo[] {
  const palabras = normalizarNombre(f.texto).split(' ').filter(Boolean);
  const resultados: { e: EntradaCatalogo; puntos: number }[] = [];
  for (const e of catalogo) {
    if (f.categoria && e.categoria !== f.categoria) continue;
    if (f.tipo && e.tipo !== f.tipo) continue;
    if (f.soloFrecuentes && !e.vendidos) continue;
    const nombre = normalizarNombre(e.nombre);
    const codigo = normalizarNombre(e.codigo || '');
    const pajar = [nombre, codigo, ...e.alias.map(normalizarNombre), normalizarNombre(e.grupo || ''), normalizarNombre(nombreCategoria(e.categoria)), e.tipo].join(' ');
    let puntos = 0;
    let ok = true;
    for (const p of palabras) {
      if (codigo && codigo === p) puntos += 100;
      else if (nombre.startsWith(p)) puntos += 40;
      else if (new RegExp(`(^|\\s)${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(nombre)) puntos += 25;
      else if (nombre.includes(p)) puntos += 12;
      else if (pajar.includes(p)) puntos += 5;
      else {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    puntos += Math.min(30, e.vendidos * 2) + (e.precio > 0 ? 8 : 0) + (e.origen === 'ficha' ? 6 : e.origen === 'inventario' ? 4 : 0);
    resultados.push({ e, puntos });
  }
  return resultados
    .sort((a, b) => b.puntos - a.puntos || a.e.nombre.localeCompare(b.e.nombre, 'es'))
    .slice(0, limite)
    .map((r) => r.e);
}

/** "3*nexgard", "3 x nexgard" o "3 nexgard" → cantidad 3 y texto "nexgard". */
export function separarCantidad(texto: string): { cantidad: number; texto: string } {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(?:\*|x\s+)\s*(.+)$/i.exec(texto);
  if (m) return { cantidad: Number(m[1].replace(',', '.')) || 1, texto: m[2] };
  return { cantidad: 1, texto };
}
