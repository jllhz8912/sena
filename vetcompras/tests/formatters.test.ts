import { describe, it, expect } from 'vitest';
import { numeroALetras, formatCOP } from '../src/utils/formatters';

describe('numeroALetras', () => {
  it.each([
    [65000, 'SESENTA Y CINCO MIL PESOS M/CTE'],
    [21000, 'VEINTIUN MIL PESOS M/CTE'],
    [1000000, 'UN MILLÓN DE PESOS M/CTE'],
    [3000000, 'TRES MILLONES DE PESOS M/CTE'],
    [1250300, 'UN MILLÓN DOSCIENTOS CINCUENTA MIL TRESCIENTOS PESOS M/CTE'],
    [1500000000, 'MIL QUINIENTOS MILLONES DE PESOS M/CTE'],
    [2000000000, 'DOS MIL MILLONES DE PESOS M/CTE'],
  ])('%i → %s', (monto, texto) => {
    expect(numeroALetras(monto)).toBe(texto);
  });
});

describe('formatCOP', () => {
  it('formatea pesos sin decimales y maneja valores vacíos', () => {
    expect(formatCOP(1234567)).toMatch(/^\$ 1.234.567$/);
    expect(formatCOP(undefined)).toBe('$ 0');
  });
});
