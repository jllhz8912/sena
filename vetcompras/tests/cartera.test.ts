import { describe, it, expect } from 'vitest';
import { estadoVencimiento, resumenAlertas, textoDias, netoAPagar } from '../src/utils/cartera';
import type { CompraDocumento } from '../src/types';

const hoy = new Date(2026, 9, 27); // 27/10/2026
const doc = (id: string, vence: string, saldo = 100000): CompraDocumento =>
  ({ id, fechaVencimiento: vence, saldoPendiente: saldo, total: 119000, totalRetenciones: 3000, pagos: [] }) as unknown as CompraDocumento;

describe('vencimientos de cuentas por pagar', () => {
  it('clasifica por días que faltan', () => {
    expect(estadoVencimiento(doc('a', '2026-10-20'), hoy)).toBe('vencida');
    expect(estadoVencimiento(doc('b', '2026-10-27'), hoy)).toBe('hoy');
    expect(estadoVencimiento(doc('c', '2026-10-28'), hoy)).toBe('manana');
    expect(estadoVencimiento(doc('d', '2026-11-02'), hoy)).toBe('semana');
    expect(estadoVencimiento(doc('e', '2026-12-30'), hoy)).toBe('al_dia');
    expect(estadoVencimiento(doc('f', '2026-10-20', 0), hoy)).toBe('pagada');
  });

  it('el aviso de un día antes cuenta como urgente', () => {
    const r = resumenAlertas([doc('a', '2026-10-20'), doc('c', '2026-10-28'), doc('e', '2026-12-30'), doc('f', '2026-10-01', 0)], hoy);
    expect(r.vencidas.map((d) => d.id)).toEqual(['a']);
    expect(r.manana.map((d) => d.id)).toEqual(['c']);
    expect(r.urgentes).toBe(2);
  });

  it('textos legibles y neto a pagar descontando retenciones', () => {
    expect(textoDias(doc('a', '2026-10-24'), hoy)).toBe('Vencida hace 3 días');
    expect(textoDias(doc('c', '2026-10-28'), hoy)).toBe('Vence mañana');
    expect(netoAPagar(doc('x', '2026-10-28'))).toBe(116000);
  });
});
