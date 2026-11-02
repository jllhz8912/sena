import { describe, expect, it } from 'vitest';
import { calcularPagosCompra, estadoFactura, resumenFacturas } from '../src/utils/pagosCompra';
import { filasAProductos, leerNumero } from '../src/services/plantillaProductosCompra';
import { compraMueveInventario, movimientosDeCompra, movimientosDeVenta } from '../src/utils/inventario';

const base = { medioPorDefecto: 'Efectivo', fecha: '2026-11-02' };

describe('formas de pago de la compra', () => {
  it('contado sin pagos escritos: un pago por el neto', () => {
    const r = calcularPagosCompra({ ...base, neto: 119000, formaPago: 'contado', pagos: [] });
    expect(r).toMatchObject({ pagado: 119000, saldo: 0, estado: 'pagada', medio: 'Efectivo', error: '' });
    expect(r.pagos).toHaveLength(1);
  });

  it('contado con varios medios debe sumar el neto', () => {
    const pagos = [
      { id: 'a', fecha: '2026-11-02', monto: 70000, medio: 'Efectivo' },
      { id: 'b', fecha: '2026-11-02', monto: 49000, medio: 'Transferencia (Electrónico)' },
    ];
    expect(calcularPagosCompra({ ...base, neto: 119000, formaPago: 'contado', pagos })).toMatchObject({ estado: 'pagada', medio: 'Varios medios', error: '' });
    expect(calcularPagosCompra({ ...base, neto: 120000, formaPago: 'contado', pagos }).error).toMatch(/deben sumar/);
  });

  it('crédito: todo queda por pagar; al editar conserva los abonos posteriores', () => {
    expect(calcularPagosCompra({ ...base, neto: 500000, formaPago: 'credito', pagos: [] })).toMatchObject({ pagado: 0, saldo: 500000, estado: 'pendiente', medio: 'Crédito Proveedor' });
    const abono = [{ id: 'x', fecha: '2026-11-10', monto: 200000, medio: 'Efectivo', nota: 'Pago' }];
    expect(calcularPagosCompra({ ...base, neto: 500000, formaPago: 'credito', pagos: abono })).toMatchObject({ saldo: 300000, estado: 'parcial' });
  });

  it('crédito-contado: abono hoy y saldo a crédito; exige abono y que no cubra todo', () => {
    const abono = [{ id: 'a', fecha: '2026-11-02', monto: 100000, medio: 'Nequi / Daviplata (Electrónico)' }];
    expect(calcularPagosCompra({ ...base, neto: 300000, formaPago: 'credito_contado', pagos: abono })).toMatchObject({ pagado: 100000, saldo: 200000, estado: 'parcial', error: '' });
    expect(calcularPagosCompra({ ...base, neto: 300000, formaPago: 'credito_contado', pagos: [] }).error).toMatch(/abono/);
    expect(calcularPagosCompra({ ...base, neto: 100000, formaPago: 'credito_contado', pagos: abono }).error).toMatch(/Contado/);
  });

  it('nota crédito no genera pagos ni saldo', () => {
    expect(calcularPagosCompra({ ...base, neto: 50000, formaPago: 'credito', pagos: [], esNotaCredito: true })).toMatchObject({ pagos: [], saldo: 0, estado: 'pagada' });
  });
});

describe('control de facturas', () => {
  const hoy = new Date('2026-11-15T12:00:00');
  const docs = [
    { id: '1', total: 100, saldoPendiente: 0, pagos: [{ monto: 100 }], fechaVencimiento: '2026-11-01' },
    { id: '2', total: 200, saldoPendiente: 200, pagos: [], fechaVencimiento: '2026-12-01' },
    { id: '3', total: 300, saldoPendiente: 100, pagos: [{ monto: 200 }], fechaVencimiento: '2026-12-01' },
    { id: '4', total: 400, saldoPendiente: 400, pagos: [], fechaVencimiento: '2026-11-10' },
    { id: '5', tipoDocumento: 'nota_credito', total: -50, saldoPendiente: 0, pagos: [] },
  ] as any;
  it('clasifica pagada, por pagar, con saldo y vencida', () => {
    expect(docs.slice(0, 4).map((d: any) => estadoFactura(d, hoy))).toEqual(['pagada', 'por_pagar', 'con_saldo', 'vencida']);
  });
  it('resume cantidad, valor y saldo por estado (sin notas crédito)', () => {
    const r = resumenFacturas(docs, hoy);
    expect(r.todas).toEqual({ cantidad: 4, total: 1000, saldo: 700 });
    expect(r.vencida).toEqual({ cantidad: 1, total: 400, saldo: 400 });
    expect(r.con_saldo.saldo).toBe(100);
  });
});

describe('plantilla de productos de la compra', () => {
  it('lee números en formato colombiano', () => {
    expect([leerNumero('38.000'), leerNumero('$ 1.234.567,50'), leerNumero('38000.5'), leerNumero(19), leerNumero('')]).toEqual([38000, 1234567.5, 38000.5, 19, 0]);
  });
  it('convierte filas en líneas con IVA y precio sugerido; reporta errores y omite vacías', () => {
    const { lineas, errores } = filasAProductos([
      { Producto: 'Nexgard 10-25 kg', 'Código': '7702001', Cantidad: 6, Unidad: 'UND', 'Costo unitario sin IVA': '38.000', 'Tarifa IVA (%)': 19, 'Precio venta sugerido': 59900 },
      { Producto: 'Dog Chow 22 kg', Cantidad: 2, 'Costo unitario sin IVA': 165000, 'Tarifa IVA (%)': 0.05 },
      { Producto: '', Cantidad: '', 'Costo unitario sin IVA': '' },
      { Producto: 'Sin costo', Cantidad: 1 },
    ]);
    expect(lineas.map((l) => [l.descripcion, l.cantidad, l.valorUnitario, l.porcentajeIva, l.valorIva, l.totalLinea, l.precioVentaSugerido])).toEqual([
      ['Nexgard 10-25 kg', 6, 38000, 19, 43320, 271320, 59900],
      ['Dog Chow 22 kg', 2, 165000, 5, 16500, 346500, undefined],
    ]);
    expect(errores).toEqual(['Fila 5 (Sin costo): falta el costo unitario sin IVA.']);
  });
});

describe('inventario desde compras y ventas', () => {
  const compra = {
    id: 'c1', fechaEmision: '2026-11-02', tipoDocumento: 'factura_electronica', esGasto: false, proveedor: { razonSocial: 'Prov' },
    lineas: [{ id: 'l1', descripcion: 'Nexgard 10-25 kg', cantidad: 6, valorUnitario: 38000 }],
  } as any;
  it('solo mueve inventario si se respondió que lo afecta', () => {
    expect(compraMueveInventario(compra)).toBe(true);
    expect(compraMueveInventario({ ...compra, afectaInventario: true })).toBe(true);
    expect(compraMueveInventario({ ...compra, afectaInventario: false })).toBe(false);
    expect(movimientosDeCompra({ ...compra, afectaInventario: false }, [], []).guardar).toEqual([]);
  });
  it('la venta descuenta el producto del inventario aunque no haya saldo', () => {
    const p = { id: 'p1', nombre: 'Nexgard 10-25 kg', unidad: 'UND', activo: true, creadoEn: '', actualizadoEn: '' };
    const venta = { id: 'v1', fecha: '2026-11-02', items: [{ id: 'i1', concepto: 'Nexgard 10-25 kg', cantidad: 3 }] } as any;
    expect(movimientosDeVenta(venta, [p], []).guardar).toMatchObject([{ productoId: 'p1', tipo: 'salida', cantidad: 3 }]);
  });
});
