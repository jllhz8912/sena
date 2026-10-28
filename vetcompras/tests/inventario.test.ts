import { describe, it, expect } from 'vitest';
import { movimientosDeCompra, movimientosDeVenta, calcularSaldos, movimientosAlEliminar, ajusteASaldo, buscarProducto } from '../src/utils/inventario';

const compra = (o: any = {}) => ({
  id: 'doc1', tipoDocumento: 'factura_electronica', prefijo: 'FE', folio: '10', fechaEmision: '2026-10-01', esGasto: false,
  proveedor: { razonSocial: 'COCO PINK S.A.S.' },
  lineas: [
    { id: 'l1', codigo: '770123', descripcion: 'Shampoo Antipulgas 500 ml', cantidad: 6, unidad: 'UND', valorUnitario: 25000 },
    { id: 'l2', descripcion: 'Collar isabelino M', cantidad: 8, unidad: 'UND', valorUnitario: 12500 },
  ],
  ...o,
}) as any;
const venta = (items: any[], o: any = {}) => ({ id: 'v1', consecutivo: 'VNT-1', fecha: '2026-10-05', items, ...o }) as any;

describe('inventario informativo', () => {
  it('una compra crea productos y entradas; una venta resta; el saldo puede quedar negativo', () => {
    const c = movimientosDeCompra(compra(), [], []);
    expect(c.productosNuevos.map((p) => p.nombre)).toEqual(['Shampoo Antipulgas 500 ml', 'Collar isabelino M']);
    expect(c.guardar.map((m) => [m.tipo, m.cantidad, m.costoUnitario])).toEqual([['entrada', 6, 25000], ['entrada', 8, 12500]]);
    const productos = c.productosNuevos;
    // La venta encuentra el producto por nombre sin tildes ni mayúsculas; la consulta es un servicio
    const v = movimientosDeVenta(venta([
      { id: 'i1', concepto: 'shampoo antipulgas 500 ML', cantidad: 10 },
      { id: 'i2', concepto: 'Consulta general', cantidad: 1 },
    ]), productos, c.guardar);
    expect(v.guardar).toHaveLength(1);
    const saldos = calcularSaldos(productos, [...c.guardar, ...v.guardar]);
    expect(saldos[0]).toMatchObject({ entradas: 6, salidas: 10, saldo: -4, estado: 'negativo', costoPromedio: 25000 });
    expect(saldos[1]).toMatchObject({ saldo: 8, valor: 100000, estado: 'ok' });
  });

  it('editar la compra recalcula, pero respeta los movimientos editados a mano', () => {
    const c1 = movimientosDeCompra(compra(), [], []);
    const editado = { ...c1.guardar[0], cantidad: 5, editado: true };
    const doc2 = compra({ lineas: [{ id: 'l1', descripcion: 'Shampoo Antipulgas 500 ml', cantidad: 7, valorUnitario: 24000 }] });
    const c2 = movimientosDeCompra(doc2, c1.productosNuevos, [editado, c1.guardar[1]]);
    expect(c2.guardar).toHaveLength(0); // l1 fue editada a mano: se respeta
    expect(c2.eliminar).toEqual([c1.guardar[1].id]); // l2 ya no está en la compra
  });

  it('gastos y líneas resumen de PDF no mueven inventario; la nota crédito resta', () => {
    expect(movimientosDeCompra(compra({ esGasto: true }), [], []).guardar).toHaveLength(0);
    expect(movimientosDeCompra(compra({ lineas: [{ id: 'l', descripcion: 'Según factura FE10', cantidad: 1, valorUnitario: 1, resumen: true }] }), [], []).guardar).toHaveLength(0);
    const nc = movimientosDeCompra(compra({ id: 'nc1', tipoDocumento: 'nota_credito', lineas: [{ id: 'x', descripcion: 'Collar isabelino M', cantidad: -2, valorUnitario: 12500 }] }), [], []);
    expect(nc.guardar[0]).toMatchObject({ tipo: 'ajuste', cantidad: -2 });
  });

  it('al eliminar la compra se quitan sus movimientos automáticos', () => {
    const c = movimientosDeCompra(compra(), [], []);
    expect(movimientosAlEliminar(['doc1'], [...c.guardar, { ...c.guardar[0], id: 'manual', editado: true }])).toEqual(c.guardar.map((m) => m.id));
  });

  it('bajas, ajuste por conteo y búsqueda por código o alias', () => {
    const p = { id: 'p1', codigo: 'A-1', nombre: 'Nexgard 10-25 kg', alias: ['NEXGARD SPECTRA M'], unidad: 'UND', activo: true } as any;
    expect(buscarProducto([p], { codigo: 'a-1' })?.id).toBe('p1');
    expect(buscarProducto([p], { nombre: 'Nexgard Spectra M' })?.id).toBe('p1');
    const movs: any[] = [
      { id: '1', productoId: 'p1', tipo: 'entrada', cantidad: 10, fecha: '2026-10-01' },
      { id: '2', productoId: 'p1', tipo: 'baja', cantidad: 1, fecha: '2026-10-02', motivo: 'Vencimiento' },
    ];
    const ajuste = ajusteASaldo('p1', 9, 7, '2026-10-03');
    expect(ajuste).toMatchObject({ tipo: 'ajuste', cantidad: -2 });
    expect(calcularSaldos([p], [...movs, ajuste])[0]).toMatchObject({ entradas: 10, bajas: 1, ajustes: -2, saldo: 7 });
  });
});

describe('precio de venta sugerido desde la plantilla', () => {
  it('se toma al crear el producto y no pisa un precio editado después', () => {
    const doc = { id: 'x', tipoDocumento: 'factura_electronica', fechaEmision: '2026-10-01', esGasto: false, lineas: [{ id: 'l', descripcion: 'Nexgard', cantidad: 2, valorUnitario: 38000, precioVentaSugerido: 59900 }] } as any;
    const c1 = movimientosDeCompra(doc, [], []);
    expect(c1.productosNuevos[0].precioVenta).toBe(59900);
    const editado = { ...c1.productosNuevos[0], precioVenta: 65000 };
    const c2 = movimientosDeCompra(doc, [editado], c1.guardar);
    expect(c2.productosActualizados).toHaveLength(0);
  });
  it('la línea resumen de una importación sin productos no crea productos', () => {
    const doc = { id: 'y', fechaEmision: '2026-10-01', esGasto: false, lineas: [{ id: 'lin-excel-1', descripcion: 'Compra factura 1', cantidad: 1, valorUnitario: 1000, resumen: true }] } as any;
    expect(movimientosDeCompra(doc, [], []).productosNuevos).toHaveLength(0);
  });
});
