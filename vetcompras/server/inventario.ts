/**
 * Mantiene el inventario al día cuando se guardan o borran compras y ventas,
 * desde cualquier pantalla (XML, PDF, registro manual, Excel, ventas).
 */
import type { BaseDatosLocal, Coleccion } from './basedatos';
import type { CompraDocumento, MovimientoInventario, Producto, Venta } from '../src/types';
import { CambiosInventario, movimientosAlEliminar, movimientosDeCompra, movimientosDeVenta } from '../src/utils/inventario';

function aplicar(bd: BaseDatosLocal, c: CambiosInventario) {
  const productos = [...c.productosNuevos, ...c.productosActualizados];
  if (productos.length) bd.lote('productos', productos as any[]);
  if (c.guardar.length || c.eliminar.length) bd.lote('movimientosInventario', c.guardar as any[], c.eliminar);
}

/** Llamar después de guardar o eliminar registros de compras o ventas. */
export function sincronizarInventario(bd: BaseDatosLocal, coleccion: Coleccion, guardados: any[] = [], eliminados: string[] = []): void {
  if (coleccion !== 'documentos' && coleccion !== 'ventas') return;
  try {
    let movimientos = bd.listar('movimientosInventario') as unknown as MovimientoInventario[];
    let productos = bd.listar('productos') as unknown as Producto[];
    if (eliminados.length) {
      const borrar = movimientosAlEliminar(eliminados, movimientos);
      if (borrar.length) bd.lote('movimientosInventario', [], borrar);
      movimientos = movimientos.filter((m) => !borrar.includes(m.id));
    }
    for (const r of guardados) {
      const cambios = coleccion === 'documentos'
        ? movimientosDeCompra(r as CompraDocumento, productos, movimientos)
        : movimientosDeVenta(r as Venta, productos, movimientos);
      aplicar(bd, cambios);
      productos = [
        ...productos.map((p) => cambios.productosActualizados.find((x) => x.id === p.id) || p),
        ...cambios.productosNuevos,
      ];
      movimientos = [...movimientos.filter((m) => !cambios.eliminar.includes(m.id) && !cambios.guardar.some((g) => g.id === m.id)), ...cambios.guardar];
    }
  } catch (err) {
    // El inventario es informativo: un error aquí nunca debe impedir guardar la compra o la venta
    console.error('[VetCompras] No se pudo actualizar el inventario:', err);
  }
}

/** Recalcula los movimientos automáticos de todas las compras y ventas (los editados a mano se conservan). */
export function recalcularInventario(bd: BaseDatosLocal): { compras: number; ventas: number } {
  const documentos = bd.listar('documentos');
  const ventas = bd.listar('ventas');
  // Movimientos automáticos de compras o ventas que ya no existen
  const existentes = new Set([...documentos, ...ventas].map((r: any) => r.id));
  const huerfanos = (bd.listar('movimientosInventario') as unknown as MovimientoInventario[])
    .filter((m) => m.origenId && !existentes.has(m.origenId) && !m.editado)
    .map((m) => m.id);
  if (huerfanos.length) bd.lote('movimientosInventario', [], huerfanos);
  sincronizarInventario(bd, 'documentos', documentos);
  sincronizarInventario(bd, 'ventas', ventas);
  return { compras: documentos.length, ventas: ventas.length };
}
