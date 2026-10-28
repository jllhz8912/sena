import { describe, it, expect } from 'vitest';
import { calcularPrecio, rentabilidad, redondearArriba } from '../src/utils/precios';

const ficha = (o: any = {}) => ({
  costos: [{ id: 'a', concepto: 'Compra', cantidad: 1, valorUnitario: 60000 }],
  gastosGeneralesPct: 0, metodo: 'margen', porcentajeObjetivo: 40, comisionPct: 0, ivaPct: 0, redondeo: 0, ...o,
}) as any;

describe('cálculo de precio de venta', () => {
  it('margen sobre la venta: costo 60.000 con 40 % → 100.000', () => {
    const r = calcularPrecio(ficha());
    expect(r.precioSugerido).toBe(100000);
    expect(rentabilidad(100000, r.costoTotal, 0, 0)).toMatchObject({ ganancia: 40000, margen: 40, markup: 66.67 });
  });
  it('markup sobre el costo: 60.000 + 40 % → 84.000', () => {
    expect(calcularPrecio(ficha({ metodo: 'markup' })).precioSugerido).toBe(84000);
  });
  it('con gastos generales, comisión de datáfono e IVA, el margen pedido se cumple exacto', () => {
    const f = ficha({ gastosGeneralesPct: 10, comisionPct: 3, ivaPct: 19, porcentajeObjetivo: 35 });
    const r = calcularPrecio(f);
    expect(r.costoTotal).toBe(66000);
    const rent = rentabilidad(r.precioSugerido, r.costoTotal, 19, 3);
    expect(rent.margen).toBeCloseTo(35, 1);
  });
  it('servicio con mano de obra por minutos y redondeo a $1.000', () => {
    const r = calcularPrecio(ficha({
      costos: [
        { id: '1', concepto: 'Insumos', cantidad: 1, valorUnitario: 8500 },
        { id: '2', concepto: 'Mano de obra (min)', cantidad: 30, valorUnitario: 500 },
      ],
      porcentajeObjetivo: 50, redondeo: 1000,
    }));
    expect(r.costoTotal).toBe(23500);
    expect(r.precioSugerido).toBe(47000);
  });
  it('detecta % imposible y calcula el punto de equilibrio', () => {
    expect(calcularPrecio(ficha({ porcentajeObjetivo: 98, comisionPct: 3 })).imposible).toBe(true);
    expect(rentabilidad(50000, 60000, 0, 0)).toMatchObject({ ganancia: -10000, puntoEquilibrio: 60000 });
    expect(redondearArriba(46999.4, 500)).toBe(47000);
    expect(redondearArriba(47000, 500)).toBe(47000);
  });
});
