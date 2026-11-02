/**
 * Reportes de cada perfil: filtros y agrupaciones de ventas (perfil Ventas) y de
 * compras y gastos (perfil Compras y Gastos). Cada fila de detalle conserva el id
 * del registro para poder editarlo desde el reporte.
 */
import { Categoria, CompraDocumento, FormaPago, Venta } from '../types';
import { Rango, enRango } from './paneles';
import { categoriaNormalizada, itemsDeVenta, montosPorMedio, saldoDeVenta } from './ventas';
import { EstadoFactura, estadoFactura, etiquetaFormaPago } from './pagosCompra';
import { normalizarNombre } from './inventario';

/** Fila genérica: `clave` y `etiqueta` siempre; el resto según la agrupación. */
export interface FilaReporte {
  clave: string;
  etiqueta: string;
  ventaId?: string;
  documentoId?: string;
  [campo: string]: string | number | undefined;
}

const coincide = (texto: string | undefined, pajar: string) => {
  const palabras = normalizarNombre(texto || '').split(' ').filter(Boolean);
  const p = normalizarNombre(pajar);
  return palabras.every((x) => p.includes(x));
};
const ordenar = (filas: FilaReporte[]) => filas.sort((a, b) => Number(b.total || 0) - Number(a.total || 0) || a.etiqueta.localeCompare(b.etiqueta, 'es'));

// ------------------------------------------------------------------ ventas

export interface FiltrosVentas {
  rango: Rango;
  texto?: string;
  categoria?: string;
  medio?: string;
  estado?: '' | 'pagadas' | 'credito';
}

export type AgrupacionVentas = 'venta' | 'item' | 'categoria' | 'cliente' | 'dia' | 'medio';

export const AGRUPACIONES_VENTAS: { id: AgrupacionVentas; label: string }[] = [
  { id: 'venta', label: 'Detalle por venta' },
  { id: 'item', label: 'Por producto o servicio' },
  { id: 'categoria', label: 'Por categoría' },
  { id: 'cliente', label: 'Por cliente' },
  { id: 'dia', label: 'Por día' },
  { id: 'medio', label: 'Por medio de pago' },
];

export function filtrarVentas(ventas: Venta[], f: FiltrosVentas): Venta[] {
  return ventas.filter((v) => {
    if (!enRango(v.fecha, f.rango)) return false;
    const items = itemsDeVenta(v);
    if (f.categoria && !items.some((i) => categoriaNormalizada(i.categoria) === f.categoria)) return false;
    if (f.medio && !(montosPorMedio(v) as Record<string, number>)[f.medio]) return false;
    if (f.estado === 'pagadas' && saldoDeVenta(v) > 0) return false;
    if (f.estado === 'credito' && !(saldoDeVenta(v) > 0)) return false;
    if (f.texto && !coincide(f.texto, [v.consecutivo, v.clienteNombre, v.clienteDocumento, v.mascotaNombre, v.observaciones, ...items.map((i) => i.concepto)].join(' '))) return false;
    return true;
  });
}

export function agruparVentas(ventas: Venta[], por: AgrupacionVentas, nombreCategoria: (id: string) => string, nombreMedio: (id: string) => string): FilaReporte[] {
  if (por === 'venta') {
    return [...ventas]
      .sort((a, b) => (b.fecha + (b.creadoEn || '')).localeCompare(a.fecha + (a.creadoEn || '')))
      .map((v) => {
        const saldo = saldoDeVenta(v);
        return {
          clave: v.id,
          ventaId: v.id,
          etiqueta: v.consecutivo,
          fecha: v.fecha,
          cliente: v.clienteNombre || 'Mostrador',
          concepto: v.concepto,
          medio: Object.keys(montosPorMedio(v)).filter((m) => m !== 'credito').map(nombreMedio).join(' + ') || '—',
          total: Number(v.monto) || 0,
          pagado: (Number(v.monto) || 0) - saldo,
          saldo,
        };
      });
  }
  const mapa = new Map<string, FilaReporte>();
  const sumar = (clave: string, etiqueta: string, valores: Record<string, number>, contar = true) => {
    const f = mapa.get(clave) || { clave, etiqueta, cantidad: 0, total: 0 };
    for (const [k, v] of Object.entries(valores)) f[k] = Number(f[k] || 0) + v;
    if (contar) f.cantidad = Number(f.cantidad) + 1;
    mapa.set(clave, f);
  };
  for (const v of ventas) {
    const saldo = saldoDeVenta(v);
    if (por === 'cliente') sumar(normalizarNombre(v.clienteNombre || 'mostrador'), v.clienteNombre || 'Cliente de mostrador', { total: Number(v.monto) || 0, saldo });
    else if (por === 'dia') sumar(v.fecha, v.fecha, { total: Number(v.monto) || 0, saldo });
    else if (por === 'medio') for (const [m, valor] of Object.entries(montosPorMedio(v))) sumar(m, nombreMedio(m), { total: valor || 0 });
    else {
      const vistas = new Set<string>();
      for (const i of itemsDeVenta(v)) {
        const clave = por === 'categoria' ? categoriaNormalizada(i.categoria) : normalizarNombre(i.concepto) || 'sin-concepto';
        const etiqueta = por === 'categoria' ? nombreCategoria(clave) : i.concepto;
        sumar(clave, etiqueta, { total: Number(i.subtotal) || 0, unidades: Number(i.cantidad) || 0 }, !vistas.has(clave));
        vistas.add(clave);
        if (por === 'item') mapa.get(clave)!.categoria = nombreCategoria(categoriaNormalizada(i.categoria));
      }
    }
  }
  const filas = [...mapa.values()];
  if (por === 'dia') return filas.sort((a, b) => b.clave.localeCompare(a.clave));
  if (por === 'item') for (const f of filas) f.precioPromedio = Number(f.unidades) ? Math.round(Number(f.total) / Number(f.unidades)) : 0;
  return ordenar(filas);
}

// ------------------------------------------------------------------ compras y gastos

export interface FiltrosCompras {
  rango: Rango;
  texto?: string;
  proveedor?: string;
  categoriaId?: string;
  naturaleza?: '' | 'compra' | 'gasto';
  estado?: '' | EstadoFactura;
  formaPago?: '' | FormaPago;
}

export type AgrupacionCompras = 'documento' | 'proveedor' | 'categoria' | 'mes' | 'producto' | 'iva' | 'retenciones';

export const AGRUPACIONES_COMPRAS: { id: AgrupacionCompras; label: string }[] = [
  { id: 'documento', label: 'Detalle por documento' },
  { id: 'proveedor', label: 'Por proveedor' },
  { id: 'categoria', label: 'Por categoría' },
  { id: 'mes', label: 'Por mes' },
  { id: 'producto', label: 'Por producto (líneas)' },
  { id: 'iva', label: 'IVA descontable por tarifa (F300)' },
  { id: 'retenciones', label: 'Retenciones por tercero (F350)' },
];

export function filtrarCompras(documentos: CompraDocumento[], f: FiltrosCompras, hoy?: Date): CompraDocumento[] {
  return documentos.filter((d) => {
    if (!enRango(d.fechaEmision, f.rango)) return false;
    if (f.proveedor && d.proveedor?.nit !== f.proveedor) return false;
    if (f.categoriaId && d.categoriaId !== f.categoriaId) return false;
    if (f.naturaleza === 'compra' && d.esGasto) return false;
    if (f.naturaleza === 'gasto' && !d.esGasto) return false;
    if (f.formaPago && (d.formaPago || 'contado') !== f.formaPago) return false;
    if (f.estado && (d.tipoDocumento === 'nota_credito' || estadoFactura(d, hoy) !== f.estado)) return false;
    if (f.texto && !coincide(f.texto, [d.prefijo, d.folio, d.cufe, d.proveedor?.razonSocial, d.proveedor?.nit, d.observaciones, ...(d.lineas || []).map((l) => l.descripcion)].join(' '))) return false;
    return true;
  });
}

const n = (v: unknown) => Number(v) || 0;
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export function agruparCompras(documentos: CompraDocumento[], por: AgrupacionCompras, categorias: Categoria[], hoy?: Date): FilaReporte[] {
  const nombreCat = (id: string) => categorias.find((c) => c.id === id)?.nombre || 'Sin categoría';
  if (por === 'documento') {
    return [...documentos]
      .sort((a, b) => b.fechaEmision.localeCompare(a.fechaEmision) || (b.creadoEn || '').localeCompare(a.creadoEn || ''))
      .map((d) => ({
        clave: d.id,
        documentoId: d.id,
        etiqueta: `${d.prefijo || ''}${d.folio}`,
        fecha: d.fechaEmision,
        proveedor: d.proveedor?.razonSocial || '',
        nit: d.proveedor?.nit || '',
        categoria: nombreCat(d.categoriaId),
        naturaleza: d.esGasto ? 'Gasto' : 'Compra',
        formaPago: etiquetaFormaPago(d.formaPago),
        subtotal: n(d.subtotal) - n(d.descuentos),
        iva: n(d.totalIva),
        retenciones: n(d.totalRetenciones),
        total: n(d.total),
        saldo: Math.max(0, n(d.saldoPendiente)),
        vence: d.saldoPendiente > 0 ? d.fechaVencimiento : '',
        estado: d.tipoDocumento === 'nota_credito' ? 'Nota crédito' : ({ pagada: 'Pagada', con_saldo: 'Con saldo', por_pagar: 'Por pagar', vencida: 'Vencida' } as const)[estadoFactura(d, hoy)],
      }));
  }
  if (por === 'iva') {
    const t = { b0: 0, b5: 0, i5: 0, b19: 0, i19: 0 };
    for (const d of documentos) (t.b0 += n(d.baseIva0)), (t.b5 += n(d.baseIva5)), (t.i5 += n(d.iva5)), (t.b19 += n(d.baseIva19)), (t.i19 += n(d.iva19));
    return [
      { clave: 'iva0', etiqueta: 'Excluido / exento (0 %)', base: t.b0, iva: 0, total: t.b0 },
      { clave: 'iva5', etiqueta: 'Tarifa 5 %', base: t.b5, iva: t.i5, total: t.b5 + t.i5 },
      { clave: 'iva19', etiqueta: 'Tarifa general 19 %', base: t.b19, iva: t.i19, total: t.b19 + t.i19 },
    ];
  }
  const mapa = new Map<string, FilaReporte>();
  const sumar = (clave: string, etiqueta: string, valores: Record<string, number>, extra: Record<string, string> = {}, contar = true) => {
    const f = mapa.get(clave) || { clave, etiqueta, cantidad: 0, total: 0, ...extra };
    for (const [k, v] of Object.entries(valores)) f[k] = Number(f[k] || 0) + v;
    if (contar) f.cantidad = Number(f.cantidad) + 1;
    mapa.set(clave, f);
  };
  for (const d of documentos) {
    const base = { total: n(d.total), iva: n(d.totalIva), retenciones: n(d.totalRetenciones), saldo: Math.max(0, n(d.saldoPendiente)) };
    if (por === 'proveedor') sumar(d.proveedor?.nit || 'sin-nit', d.proveedor?.razonSocial || 'Sin proveedor', base, { nit: d.proveedor?.nit || '' });
    else if (por === 'categoria') sumar(d.categoriaId || 'sin', nombreCat(d.categoriaId), base, { naturaleza: d.esGasto ? 'Gasto' : 'Compra' });
    else if (por === 'mes') {
      const [a, m] = d.fechaEmision.split('-');
      sumar(`${a}-${m}`, `${MESES[Number(m) - 1]} ${a}`, { ...base, compras: d.esGasto ? 0 : n(d.total), gastos: d.esGasto ? n(d.total) : 0 });
    } else if (por === 'retenciones') {
      const retenido = n(d.reteFuente) + n(d.reteIva) + n(d.reteIca);
      if (!retenido) continue;
      sumar(d.proveedor?.nit || 'sin-nit', d.proveedor?.razonSocial || 'Sin proveedor', {
        base: n(d.subtotal) - n(d.descuentos),
        reteFuente: n(d.reteFuente),
        reteIva: n(d.reteIva),
        reteIca: n(d.reteIca),
        total: retenido,
      }, { nit: d.proveedor?.nit || '' });
    } else {
      for (const l of d.lineas || []) {
        if (l.resumen || l.id === 'lin-global') continue;
        const clave = normalizarNombre(l.descripcion) || 'sin-descripcion';
        const baseLinea = n(l.cantidad) * n(l.valorUnitario) - n(l.descuento);
        sumar(clave, l.descripcion, { unidades: n(l.cantidad), base: baseLinea, iva: n(l.valorIva), total: n(l.totalLinea) });
      }
    }
  }
  const filas = [...mapa.values()];
  if (por === 'mes') return filas.sort((a, b) => b.clave.localeCompare(a.clave));
  if (por === 'producto') for (const f of filas) f.costoPromedio = Number(f.unidades) ? Math.round(Number(f.base) / Number(f.unidades)) : 0;
  return ordenar(filas);
}

/** Suma de las columnas numéricas para la fila de totales. */
export function totalesReporte(filas: FilaReporte[], campos: string[]): Record<string, number> {
  const r: Record<string, number> = {};
  for (const c of campos) r[c] = filas.reduce((s, f) => s + (typeof f[c] === 'number' ? (f[c] as number) : 0), 0);
  return r;
}
