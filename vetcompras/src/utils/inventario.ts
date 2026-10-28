/**
 * Inventario informativo: cálculo de saldos y movimientos automáticos a partir de
 * compras y ventas. Funciones puras: las usan el servidor local y la demostración.
 */
import { CompraDocumento, MovimientoInventario, Producto, Venta } from '../types';

export const MOTIVOS_BAJA = ['Daño o rotura', 'Pérdida o robo', 'Vencimiento', 'Consumo interno (clínica)', 'Muestra o donación', 'Otro'];

export function normalizarNombre(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const ahora = () => new Date().toISOString();
const slug = (t: string) => normalizarNombre(t).replace(/\s+/g, '-').slice(0, 30) || 'producto';

/** Busca el producto por id, código, nombre o alias (sin tildes ni mayúsculas). */
export function buscarProducto(
  productos: Producto[],
  { id, codigo, nombre }: { id?: string; codigo?: string; nombre?: string }
): Producto | undefined {
  if (id) {
    const p = productos.find((x) => x.id === id);
    if (p) return p;
  }
  if (codigo?.trim()) {
    const c = codigo.trim().toLowerCase();
    const p = productos.find((x) => x.codigo?.trim().toLowerCase() === c);
    if (p) return p;
  }
  const n = normalizarNombre(nombre || '');
  if (!n) return undefined;
  return productos.find((x) => normalizarNombre(x.nombre) === n || (x.alias || []).some((a) => normalizarNombre(a) === n));
}

export interface CambiosInventario {
  productosNuevos: Producto[];
  productosActualizados: Producto[];
  guardar: MovimientoInventario[];
  eliminar: string[];
}

const vacio = (): CambiosInventario => ({ productosNuevos: [], productosActualizados: [], guardar: [], eliminar: [] });

/** ¿La compra mueve inventario? Solo mercancía (no gastos) con líneas de detalle. */
/** Línea que resume la factura (sin detalle de productos): registros rápidos o PDF sin detalle. */
const esResumen = (l: { id?: string; resumen?: boolean }) => !!l.resumen || l.id === 'lin-global';

export function compraMueveInventario(doc: Partial<CompraDocumento>): boolean {
  return !doc.esGasto && Array.isArray(doc.lineas) && doc.lineas.some((l) => !esResumen(l) && Math.abs(Number(l.cantidad) || 0) > 0 && l.descripcion?.trim());
}

/**
 * Movimientos de entrada de una compra. Crea los productos que no existan. Los
 * movimientos que alguien editó a mano se respetan; los demás se recalculan.
 */
export function movimientosDeCompra(
  doc: CompraDocumento,
  productos: Producto[],
  existentes: MovimientoInventario[]
): CambiosInventario {
  const r = vacio();
  const propios = existentes.filter((m) => m.origenId === doc.id);
  const editadas = new Set(propios.filter((m) => m.editado).map((m) => m.origenLineaId));
  const catalogo = [...productos];
  const esNota = doc.tipoDocumento === 'nota_credito';
  const vigentes = new Set<string>();
  const referencia = `${doc.prefijo || ''}${doc.folio || ''} · ${doc.proveedor?.razonSocial || ''}`.trim();

  if (compraMueveInventario(doc)) {
    for (const linea of doc.lineas) {
      const cantidad = Math.abs(Number(linea.cantidad) || 0);
      if (esResumen(linea) || !cantidad || !linea.descripcion?.trim()) continue;
      const idMov = `mov-c-${doc.id}-${linea.id}`;
      vigentes.add(idMov);
      if (editadas.has(linea.id)) continue;
      const costo = Math.abs(Number(linea.valorUnitario) || 0);
      let prod = buscarProducto(catalogo, { id: linea.productoId, codigo: linea.codigo, nombre: linea.descripcion });
      if (!prod) {
        prod = {
          id: `prod-${slug(linea.descripcion)}-${Math.random().toString(36).slice(2, 7)}`,
          codigo: linea.codigo || undefined,
          nombre: linea.descripcion.trim(),
          unidad: linea.unidad || 'UND',
          costoUltimo: costo || undefined,
          activo: true,
          creadoEn: ahora(),
          actualizadoEn: ahora(),
        };
        catalogo.push(prod);
        r.productosNuevos.push(prod);
      } else if (costo && !esNota && prod.costoUltimo !== costo) {
        const act = { ...prod, costoUltimo: costo, actualizadoEn: ahora() };
        r.productosActualizados.push(act);
        catalogo[catalogo.indexOf(prod)] = act;
      }
      const previo = propios.find((m) => m.id === idMov);
      r.guardar.push({
        id: idMov,
        fecha: doc.fechaEmision,
        productoId: prod.id,
        // Nota crédito: devolución al proveedor, resta unidades
        tipo: esNota ? 'ajuste' : 'entrada',
        cantidad: esNota ? -cantidad : cantidad,
        costoUnitario: costo || undefined,
        origen: 'compra',
        origenId: doc.id,
        origenLineaId: linea.id,
        referencia,
        motivo: esNota ? 'Nota crédito (devolución al proveedor)' : undefined,
        creadoEn: previo?.creadoEn || ahora(),
        actualizadoEn: ahora(),
      });
    }
  }
  for (const m of propios) if (!m.editado && !vigentes.has(m.id)) r.eliminar.push(m.id);
  return r;
}

/** Salidas por una venta: solo los ítems que correspondan a un producto del inventario. */
export function movimientosDeVenta(
  venta: Venta,
  productos: Producto[],
  existentes: MovimientoInventario[]
): CambiosInventario {
  const r = vacio();
  const propios = existentes.filter((m) => m.origenId === venta.id);
  const editadas = new Set(propios.filter((m) => m.editado).map((m) => m.origenLineaId));
  const vigentes = new Set<string>();
  const referencia = `${venta.consecutivo || ''} · ${venta.clienteNombre || 'Cliente de mostrador'}`;
  for (const item of venta.items || []) {
    const cantidad = Math.abs(Number(item.cantidad) || 0);
    if (!cantidad) continue;
    const prod = buscarProducto(productos, { id: item.productoId, nombre: item.concepto });
    if (!prod) continue; // servicio (consulta, baño…) o producto sin crear: no mueve inventario
    const idMov = `mov-v-${venta.id}-${item.id}`;
    vigentes.add(idMov);
    if (editadas.has(item.id)) continue;
    const previo = propios.find((m) => m.id === idMov);
    r.guardar.push({
      id: idMov,
      fecha: venta.fecha,
      productoId: prod.id,
      tipo: 'salida',
      cantidad,
      origen: 'venta',
      origenId: venta.id,
      origenLineaId: item.id,
      referencia,
      creadoEn: previo?.creadoEn || ahora(),
      actualizadoEn: ahora(),
    });
  }
  for (const m of propios) if (!m.editado && !vigentes.has(m.id)) r.eliminar.push(m.id);
  return r;
}

/** Al borrar una compra o venta se borran sus movimientos automáticos (los editados a mano se conservan). */
export function movimientosAlEliminar(origenIds: string[], existentes: MovimientoInventario[]): string[] {
  const ids = new Set(origenIds);
  return existentes.filter((m) => m.origenId && ids.has(m.origenId) && !m.editado).map((m) => m.id);
}

/** Efecto del movimiento sobre el saldo. */
export function efecto(m: Pick<MovimientoInventario, 'tipo' | 'cantidad'>): number {
  const c = Number(m.cantidad) || 0;
  return m.tipo === 'entrada' ? Math.abs(c) : m.tipo === 'ajuste' ? c : -Math.abs(c);
}

export interface SaldoProducto {
  producto: Producto;
  entradas: number;
  salidas: number;
  bajas: number;
  ajustes: number;
  saldo: number;
  costoPromedio: number;
  valor: number;
  ultimoMovimiento?: string;
  estado: 'negativo' | 'agotado' | 'bajo' | 'ok';
}

/** Saldos por producto con costo promedio ponderado de las entradas (informativo). */
export function calcularSaldos(productos: Producto[], movimientos: MovimientoInventario[], hasta?: string): SaldoProducto[] {
  const porProducto = new Map<string, MovimientoInventario[]>();
  for (const m of movimientos) {
    if (hasta && m.fecha > hasta) continue;
    const l = porProducto.get(m.productoId) || [];
    l.push(m);
    porProducto.set(m.productoId, l);
  }
  return productos.map((producto) => {
    const lista = porProducto.get(producto.id) || [];
    let entradas = 0, salidas = 0, bajas = 0, ajustes = 0, unidadesConCosto = 0, costoTotal = 0;
    let ultimo: string | undefined;
    for (const m of lista) {
      const c = Number(m.cantidad) || 0;
      if (m.tipo === 'entrada') {
        entradas += Math.abs(c);
        if (m.costoUnitario) {
          unidadesConCosto += Math.abs(c);
          costoTotal += Math.abs(c) * m.costoUnitario;
        }
      } else if (m.tipo === 'salida') salidas += Math.abs(c);
      else if (m.tipo === 'baja') bajas += Math.abs(c);
      else ajustes += c;
      if (!ultimo || m.fecha > ultimo) ultimo = m.fecha;
    }
    const saldo = Math.round((entradas - salidas - bajas + ajustes) * 1000) / 1000;
    const costoPromedio = unidadesConCosto ? Math.round(costoTotal / unidadesConCosto) : producto.costoUltimo || 0;
    const estado = saldo < 0 ? 'negativo' : saldo === 0 ? 'agotado' : producto.stockMinimo && saldo <= producto.stockMinimo ? 'bajo' : 'ok';
    return { producto, entradas, salidas, bajas, ajustes, saldo, costoPromedio, valor: Math.max(0, saldo) * costoPromedio, ultimoMovimiento: ultimo, estado };
  });
}

/** Movimiento de ajuste que deja el saldo en el valor indicado (conteo físico). */
export function ajusteASaldo(productoId: string, saldoActual: number, saldoContado: number, fecha: string, observaciones?: string): MovimientoInventario | null {
  const diferencia = Math.round((saldoContado - saldoActual) * 1000) / 1000;
  if (!diferencia) return null;
  return {
    id: `mov-a-${productoId}-${Date.now()}`,
    fecha,
    productoId,
    tipo: 'ajuste',
    cantidad: diferencia,
    origen: 'manual',
    motivo: 'Ajuste por conteo físico',
    observaciones,
    creadoEn: ahora(),
    actualizadoEn: ahora(),
  };
}
