import { describe, expect, it } from 'vitest';
import { enRango, proximosVencimientos, rangoPeriodo, resumenComprasPanel, resumenVentasPanel } from '../src/utils/paneles';

describe('periodos de los paneles', () => {
  const hoy = new Date(2026, 10, 5); // jueves 5 de noviembre de 2026
  it('hoy, semana (desde el lunes), mes, año y rango', () => {
    expect(rangoPeriodo('hoy', hoy)).toEqual({ desde: '2026-11-05', hasta: '2026-11-05' });
    expect(rangoPeriodo('semana', hoy)).toEqual({ desde: '2026-11-02', hasta: '2026-11-05' });
    expect(rangoPeriodo('mes', hoy)).toEqual({ desde: '2026-11-01', hasta: '2026-11-05' });
    expect(rangoPeriodo('anio', hoy)).toEqual({ desde: '2026-01-01', hasta: '2026-11-05' });
    expect(rangoPeriodo('personalizado', hoy, { desde: '2026-10-31', hasta: '2026-10-01' })).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' });
    expect(enRango('2026-11-02', rangoPeriodo('semana', hoy))).toBe(true);
    expect(enRango('2026-11-01', rangoPeriodo('semana', hoy))).toBe(false);
  });
});

describe('indicadores de ventas', () => {
  it('total, ticket, cobrado, por cobrar, medios y lo más vendido', () => {
    const ventas = [
      { id: 'a', fecha: '2026-11-05', monto: 100000, pagos: [{ medio: 'efectivo', monto: 60000 }, { medio: 'nequi', monto: 40000 }],
        items: [{ concepto: 'Nexgard', categoria: 'vitrina', cantidad: 2, precioUnitario: 50000, subtotal: 100000 }] },
      { id: 'b', fecha: '2026-11-05', monto: 50000, pagos: [{ medio: 'efectivo', monto: 20000 }],
        items: [{ concepto: 'Consulta', categoria: 'consultas_clinica', cantidad: 1, precioUnitario: 50000, subtotal: 50000 }] },
    ] as any;
    const r = resumenVentasPanel(ventas);
    expect(r).toMatchObject({ total: 150000, cantidad: 2, ticketPromedio: 75000, cobrado: 120000, porCobrar: 30000 });
    expect(r.porMedio).toEqual({ efectivo: 80000, nequi: 40000, credito: 30000 });
    expect(r.masVendidos.map((x) => [x.concepto, x.cantidad, x.total])).toEqual([['Nexgard', 2, 100000], ['Consulta', 1, 50000]]);
  });
});

describe('indicadores de compras y gastos', () => {
  const docs = [
    { id: '1', total: 119000, totalIva: 19000, totalRetenciones: 0, saldoPendiente: 0, esGasto: false, afectaInventario: true },
    { id: '2', total: 2000000, totalIva: 0, totalRetenciones: 70000, saldoPendiente: 1930000, esGasto: true, fechaVencimiento: '2026-11-03' },
    { id: '3', total: 300000, totalIva: 0, totalRetenciones: 0, saldoPendiente: 100000, esGasto: false, fechaVencimiento: '2026-11-08' },
    { id: '4', total: 50000, totalIva: 0, totalRetenciones: 0, saldoPendiente: 50000, esGasto: false, fechaVencimiento: '2026-12-30' },
  ] as any;
  it('compras, gastos, IVA, retenciones, pagado y por pagar', () => {
    expect(resumenComprasPanel(docs)).toEqual({
      compras: 469000, gastos: 2000000, total: 2469000, ivaDescontable: 19000, retenciones: 70000, cantidad: 4, conInventario: 1, pagado: 319000, porPagar: 2080000,
    });
  });
  it('vencidas y por vencer en 7 días, la más urgente primero', () => {
    const r = proximosVencimientos(docs, 7, new Date(2026, 10, 5));
    expect(r.map((d) => [d.id, d.diasRestantes])).toEqual([['2', -2], ['3', 3]]);
  });
});
