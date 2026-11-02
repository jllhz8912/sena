/**
 * Subcategorías de las categorías de compras y gastos (p. ej. Servicios públicos →
 * Energía, Agua, Gas, Internet). Eliminar una la deja inactiva: no se ofrece al
 * registrar, pero los documentos que ya la usan conservan su nombre.
 */
import { Categoria, SubcategoriaCompra } from '../types';
import { idDesdeNombre } from './formatters';
import { normalizarNombre } from './inventario';

export const subcategoriasActivas = (c: Categoria | undefined): SubcategoriaCompra[] => (c?.subcategorias || []).filter((s) => s.activo !== false);

/** Nombre de la subcategoría de un documento (aunque se haya eliminado después). */
export function nombreSubcategoria(categorias: Categoria[], categoriaId: string | undefined, subcategoriaId: string | undefined): string {
  if (!subcategoriaId) return '';
  const cat = categorias.find((c) => c.id === categoriaId);
  return cat?.subcategorias?.find((s) => s.id === subcategoriaId)?.nombre || '';
}

/**
 * Lista final al guardar la categoría: las escritas (con id nuevo si no lo tienen) y las
 * anteriores que se quitaron, como inactivas. Sin nombres vacíos ni repetidos.
 */
export function prepararSubcategorias(editadas: { id?: string; nombre: string }[], anteriores: SubcategoriaCompra[] = []): SubcategoriaCompra[] {
  const resultado: SubcategoriaCompra[] = [];
  const nombres = new Set<string>();
  const ids = new Set(anteriores.map((s) => s.id));
  for (const e of editadas) {
    const nombre = e.nombre.trim();
    const clave = normalizarNombre(nombre);
    if (!nombre || nombres.has(clave)) continue;
    nombres.add(clave);
    const id = e.id || idDesdeNombre(nombre, [...ids]);
    ids.add(id);
    resultado.push({ id, nombre });
  }
  for (const a of anteriores) {
    if (!resultado.some((r) => r.id === a.id)) resultado.push({ ...a, activo: false });
  }
  return resultado;
}
