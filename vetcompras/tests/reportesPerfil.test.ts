import { describe, expect, it } from 'vitest';
import { agruparCompras, agruparVentas, filtrarCompras, filtrarVentas, totalesReporte } from '../src/utils/reportesPerfil';

const rango = { desde: '2026-11-01', hasta: '2026-11-30' };
const ventas = [
  { id: 'v1', consecutivo: 'VNT-001', fecha: '2026-11-03', clienteNombre: 'Ana Ruiz', monto: 150000, concepto: 'Nexgard x2, Consulta',
    pagos: [{ medio: 'efectivo', monto: 150000 }],
    items: [
      { id: 'a', categoria: 'vitrina', concepto: 'Nexgard', cantidad: 2, precioUnitario: 50000, subtotal: 100000 },
      { id: 'b', categoria: 'consultas_clinica', concepto: 'Consulta', cantidad: 1, precioUnitario: 50000, subtotal: 50000 },
    ] },
  { id: 'v2', consecutivo: 'VNT-002', fecha: '2026-11-04', clienteNombre: 'ana ruiz', monto: 60000, concepto: 'Nexgard',
    pagos: [{ medio: 'nequi', monto: 20000 }],
    items: [{ id: 'c', categoria: 'pet_shop', concepto: 'Nexgard', cantidad: 1, precioUnitario: 60000, subtotal: 60000 }] },
  { id: 'v3', consecutivo: 'VNT-003', fecha: '2026-10-30', clienteNombre: 'Otro', monto: 10000, concepto: 'X', pagos: [{ medio: 'efectivo', monto: 10000 }],
    items: [{ id: 'd', categoria: 'varios', concepto: 'X', cantidad: 1, precioUnitario: 10000, subtotal: 10000 }] },
] as any;
const nombre = (k: string) => k;

describe('reportes de ventas', () => {
  it('filtra por periodo, texto, categoría (con alias), medio y crédito', () => {
    expect(filtrarVentas(ventas, { rango }).map((v) => v.id)).toEqual(['v1', 'v2']);
    expect(filtrarVentas(ventas, { rango, texto: 'ana nexg' }).length).toBe(2);
    expect(filtrarVentas(ventas, { rango, categoria: 'vitrina' }).map((v) => v.id)).toEqual(['v1', 'v2']);
    expect(filtrarVentas(ventas, { rango, medio: 'nequi' }).map((v) => v.id)).toEqual(['v2']);
    expect(filtrarVentas(ventas, { rango, estado: 'credito' }).map((v) => v.id)).toEqual(['v2']);
    expect(filtrarVentas(ventas, { rango, estado: 'pagadas' }).map((v) => v.id)).toEqual(['v1']);
  });
  it('detalle por venta conserva el id para editar', () => {
    const f = agruparVentas(filtrarVentas(ventas, { rango }), 'venta', nombre, nombre);
    expect(f.map((x) => [x.ventaId, x.total, x.saldo])).toEqual([['v2', 60000, 40000], ['v1', 150000, 0]]);
  });
  it('por producto, categoría, cliente, día y medio', () => {
    const v = filtrarVentas(ventas, { rango });
    expect(agruparVentas(v, 'item', nombre, nombre).map((x) => [x.etiqueta, x.cantidad, x.unidades, x.total, x.precioPromedio])).toEqual([
      ['Nexgard', 2, 3, 160000, 53333],
      ['Consulta', 1, 1, 50000, 50000],
    ]);
    expect(agruparVentas(v, 'categoria', nombre, nombre).map((x) => [x.clave, x.total])).toEqual([['vitrina', 160000], ['consultas_clinica', 50000]]);
    expect(agruparVentas(v, 'cliente', nombre, nombre).map((x) => [x.cantidad, x.total, x.saldo])).toEqual([[2, 210000, 40000]]);
    expect(agruparVentas(v, 'dia', nombre, nombre).map((x) => x.clave)).toEqual(['2026-11-04', '2026-11-03']);
    expect(agruparVentas(v, 'medio', nombre, nombre).map((x) => [x.clave, x.total])).toEqual([['efectivo', 150000], ['credito', 40000], ['nequi', 20000]]);
  });
});

const docs = [
  { id: 'd1', fechaEmision: '2026-11-02', prefijo: 'FE', folio: '10', proveedor: { nit: '900', razonSocial: 'Zoetis' }, categoriaId: 'cat-m', esGasto: false, formaPago: 'credito',
    subtotal: 100000, descuentos: 0, baseIva19: 100000, iva19: 19000, totalIva: 19000, reteFuente: 2500, reteIva: 0, reteIca: 0, totalRetenciones: 2500, total: 119000, saldoPendiente: 116500,
    fechaVencimiento: '2026-11-01', pagos: [], tipoDocumento: 'factura_electronica',
    lineas: [{ id: 'l1', descripcion: 'Nexgard', cantidad: 4, valorUnitario: 25000, descuento: 0, valorIva: 19000, totalLinea: 119000 }] },
  { id: 'd2', fechaEmision: '2026-11-05', prefijo: '', folio: 'CC-7', proveedor: { nit: '800', razonSocial: 'Arriendos' }, categoriaId: 'cat-a', esGasto: true, formaPago: 'contado',
    subtotal: 2000000, descuentos: 0, baseIva0: 2000000, totalIva: 0, totalRetenciones: 0, total: 2000000, saldoPendiente: 0, pagos: [{ monto: 2000000 }], tipoDocumento: 'cuenta_cobro',
    lineas: [{ id: 'lin-global', resumen: true, descripcion: 'x', cantidad: 1, valorUnitario: 2000000, valorIva: 0, totalLinea: 2000000 }] },
] as any;
const cats = [{ id: 'cat-m', nombre: 'Mercancía' }, { id: 'cat-a', nombre: 'Arriendo' }] as any;

describe('reportes de compras y gastos', () => {
  const hoy = new Date(2026, 10, 10);
  it('filtra por proveedor, naturaleza, estado, forma de pago y texto', () => {
    expect(filtrarCompras(docs, { rango, proveedor: '900' }).map((d) => d.id)).toEqual(['d1']);
    expect(filtrarCompras(docs, { rango, naturaleza: 'gasto' }).map((d) => d.id)).toEqual(['d2']);
    expect(filtrarCompras(docs, { rango, estado: 'vencida' }, hoy).map((d) => d.id)).toEqual(['d1']);
    expect(filtrarCompras(docs, { rango, formaPago: 'contado' }).map((d) => d.id)).toEqual(['d2']);
    expect(filtrarCompras(docs, { rango, texto: 'nexgard' }).map((d) => d.id)).toEqual(['d1']);
  });
  it('detalle por documento con estado y id para editar', () => {
    const f = agruparCompras(docs, 'documento', cats, hoy);
    expect(f.map((x) => [x.documentoId, x.etiqueta, x.categoria, x.estado, x.saldo])).toEqual([
      ['d2', 'CC-7', 'Arriendo', 'Pagada', 0],
      ['d1', 'FE10', 'Mercancía', 'Vencida', 116500],
    ]);
  });
  it('IVA por tarifa, retenciones por tercero, productos y mes', () => {
    expect(agruparCompras(docs, 'iva', cats).map((x) => [x.clave, x.base, x.iva])).toEqual([['iva0', 2000000, 0], ['iva5', 0, 0], ['iva19', 100000, 19000]]);
    expect(agruparCompras(docs, 'retenciones', cats)).toMatchObject([{ nit: '900', reteFuente: 2500, total: 2500, cantidad: 1 }]);
    expect(agruparCompras(docs, 'producto', cats)).toMatchObject([{ etiqueta: 'Nexgard', unidades: 4, base: 100000, costoPromedio: 25000 }]);
    expect(agruparCompras(docs, 'mes', cats)).toMatchObject([{ etiqueta: 'Noviembre 2026', compras: 119000, gastos: 2000000, cantidad: 2 }]);
  });
  it('totales de las columnas numéricas', () => {
    expect(totalesReporte(agruparCompras(docs, 'documento', cats), ['total', 'saldo'])).toEqual({ total: 2119000, saldo: 116500 });
  });
});
