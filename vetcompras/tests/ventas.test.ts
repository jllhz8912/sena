import { describe, it, expect } from 'vitest';
import { cerrarVenta, itemsDeVenta, pagosDeVenta, saldoDeVenta, montosPorMedio, cambioEfectivo } from '../src/utils/ventas';
import type { Venta } from '../src/types';

const base = { id: 'v1', consecutivo: 'VNT-010', fecha: '2026-10-27', creadoEn: '', actualizadoEn: '' };
const items = [
  { id: 'a', categoria: 'consultas_clinica' as const, concepto: 'Consulta general', cantidad: 1, precioUnitario: 50000, subtotal: 0 },
  { id: 'b', categoria: 'vitrina' as const, concepto: 'Nexgard 10-25 kg', cantidad: 2, precioUnitario: 45000, descuento: 5000, subtotal: 0 },
];

describe('cerrarVenta', () => {
  it('suma los ítems con cantidad y descuento', () => {
    const v = cerrarVenta({ ...base, items, pagos: [{ id: 'p', medio: 'efectivo', monto: 135000 }] });
    expect(v.items!.map((i) => i.subtotal)).toEqual([50000, 85000]);
    expect(v.monto).toBe(135000);
    expect(v.categoria).toBe('vitrina'); // ítem de mayor valor
    expect(v.estado).toBe('pagada');
    expect(v.saldoPendiente).toBe(0);
    expect(v.medioPago).toBe('efectivo');
  });

  it('acepta varios medios de pago y deja el resto a crédito', () => {
    const v = cerrarVenta({
      ...base,
      items,
      pagos: [
        { id: 'p1', medio: 'efectivo', monto: 50000, recibido: 60000 },
        { id: 'p2', medio: 'nequi', monto: 60000 },
      ],
    });
    expect(v.medioPago).toBe('mixto');
    expect(v.estado).toBe('parcial');
    expect(v.saldoPendiente).toBe(25000);
    expect(montosPorMedio(v)).toEqual({ efectivo: 50000, nequi: 60000, credito: 25000 });
    expect(cambioEfectivo(v.pagos!)).toBe(10000);
  });

  it('sin pagos queda pendiente a crédito', () => {
    const v = cerrarVenta({ ...base, items, pagos: [] });
    expect(v.estado).toBe('pendiente');
    expect(v.medioPago).toBe('credito');
    expect(saldoDeVenta(v)).toBe(135000);
  });
});

describe('ventas registradas antes del cambio', () => {
  const antigua: Venta = {
    ...base,
    categoria: 'banos',
    concepto: 'Baño medicado',
    monto: 65000,
    medioPago: 'nequi',
    estado: 'pagada',
  };

  it('se leen como un solo ítem y un solo pago', () => {
    expect(itemsDeVenta(antigua)).toHaveLength(1);
    expect(itemsDeVenta(antigua)[0]).toMatchObject({ categoria: 'banos', subtotal: 65000 });
    expect(pagosDeVenta(antigua)).toEqual([{ id: 'v1-p1', medio: 'nequi', monto: 65000 }]);
    expect(saldoDeVenta(antigua)).toBe(0);
  });

  it('una venta antigua a crédito figura con todo el saldo pendiente', () => {
    const credito = { ...antigua, medioPago: 'credito' as const, estado: 'pendiente' as const };
    expect(pagosDeVenta(credito)).toEqual([]);
    expect(saldoDeVenta(credito)).toBe(65000);
    expect(montosPorMedio(credito)).toEqual({ credito: 65000 });
  });
});
