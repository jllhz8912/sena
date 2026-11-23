import { describe, expect, it } from 'vitest';
import {
  PARAMETROS_2026, NOVEDADES_VACIAS, dias360, liquidarPago, liquidarPrima, liquidarVacaciones, liquidarCesantias, liquidarIntereses,
  indemnizacion, liquidacionFinal, retencionArt383, parametrosParaFecha, periodoDe, basePrestaciones, type Empleado,
} from '../src/utils/nomina';

const p = PARAMETROS_2026;
const base: Empleado = {
  id: 'e1', nombre: 'Ana Pérez', documento: '1000', fechaIngreso: '2024-01-01', tipoContrato: 'indefinido', salario: 1_750_905,
  periodicidad: 'mensual', claseRiesgo: 1, activo: true, creadoEn: '', actualizadoEn: '',
};
const total = (lista: { concepto: string; valor: number }[], c: string) => lista.find((x) => x.concepto.startsWith(c))?.valor;

describe('nómina 2026', () => {
  it('días con año comercial de 360', () => {
    expect(dias360('2026-01-01', '2026-06-30')).toBe(180);
    expect(dias360('2026-02-01', '2026-02-28')).toBe(30);
    expect(dias360('2026-01-01', '2026-12-31')).toBe(360);
    expect(dias360('2026-03-16', '2026-03-31')).toBe(15);
  });

  it('salario mínimo mensual: auxilio de transporte, salud y pensión', () => {
    const r = liquidarPago(base, NOVEDADES_VACIAS(30), p);
    expect(total(r.devengados, 'Salario básico')).toBe(1_750_905);
    expect(total(r.devengados, 'Auxilio de transporte')).toBe(249_095);
    expect(r.totalDevengado).toBe(2_000_000);
    expect(total(r.deducciones, 'Salud')).toBe(70_100);
    expect(total(r.deducciones, 'Pensión')).toBe(70_100);
    expect(r.neto).toBe(2_000_000 - 140_200);
    // Exonerado de salud, SENA e ICBF (art. 114-1 E.T.)
    expect(r.aportesEmpleador.map((a) => a.concepto).join()).not.toMatch(/SENA|ICBF|Salud/);
  });

  it('quincena: la mitad del salario y del auxilio', () => {
    const r = liquidarPago({ ...base, periodicidad: 'quincenal' }, NOVEDADES_VACIAS(15), p);
    expect(total(r.devengados, 'Salario básico')).toBe(875_453);
    expect(total(r.devengados, 'Auxilio de transporte')).toBe(124_548);
  });

  it('más de 2 SMMLV no recibe auxilio; más de 4 aporta al fondo de solidaridad; recargos con jornada de 42 h', () => {
    const r = liquidarPago({ ...base, salario: 8_000_000 }, { ...NOVEDADES_VACIAS(30), horasDominicales: 8 }, p);
    expect(total(r.devengados, 'Auxilio')).toBeUndefined();
    expect(total(r.deducciones, 'Fondo de solidaridad')).toBeGreaterThan(0);
    // 8.000.000 / 210 h × 90 % × 8 h
    expect(total(r.devengados, 'Recargo dominical')).toBe(Math.round((8_000_000 / 210) * 0.9 * 8));
  });

  it('retención: tabla del art. 383 y salario alto con procedimiento 1', () => {
    expect(retencionArt383(95)).toBe(0);
    expect(retencionArt383(150)).toBeCloseTo(10.45, 2);
    const r = liquidarPago({ ...base, salario: 10_000_000 }, NOVEDADES_VACIAS(30), p);
    expect(total(r.deducciones, 'Retención')).toBe(351_000);
  });

  it('prima, cesantías, intereses y vacaciones', () => {
    const b = basePrestaciones(base, p);
    expect(b).toBe(2_000_000);
    expect(liquidarPrima(b, 180).valor).toBe(1_000_000);
    const ces = liquidarCesantias(b, 360);
    expect(ces.valor).toBe(2_000_000);
    expect(liquidarIntereses(ces.valor, 360).valor).toBe(240_000);
    expect(liquidarVacaciones(base.salario, 360).valor).toBe(875_453);
    expect(liquidarVacaciones(base.salario, 360, 15).valor).toBe(0);
  });

  it('indemnización art. 64: indefinido con dos años y contrato fijo', () => {
    const ind = indemnizacion(base, '2025-12-31', p);
    expect(ind.dias).toBe(50);
    expect(ind.valor).toBe(Math.round((1_750_905 / 30) * 50));
    const fijo = indemnizacion({ ...base, tipoContrato: 'fijo', fechaFinContrato: '2026-12-31' }, '2026-12-25', p);
    expect(fijo.dias).toBe(15);
  });

  it('liquidación final por renuncia no lleva indemnización', () => {
    const l = liquidacionFinal(base, '2026-03-31', 'renuncia', p, { diasVacacionesDisfrutadas: 30 });
    const nombres = l.conceptos.map((c) => c.concepto);
    expect(nombres).toContain('Cesantías');
    expect(nombres).toContain('Prima de servicios');
    expect(nombres).not.toContain('Indemnización (art. 64 CST)');
    expect(l.conceptos.find((c) => c.concepto === 'Prima de servicios')!.dias).toBe(90);
    const despido = liquidacionFinal(base, '2026-03-31', 'sin_justa_causa', p);
    expect(despido.total).toBeGreaterThan(l.total);
  });

  it('cronograma de jornada y recargo dominical; periodos de pago', () => {
    expect(parametrosParaFecha('2026-03-01').horasSemana).toBe(44);
    expect(parametrosParaFecha('2026-08-01')).toMatchObject({ horasSemana: 42, recargoDominical: 90 });
    expect(periodoDe('2026-11-20', 'quincenal')).toEqual({ desde: '2026-11-16', hasta: '2026-11-30', dias: 15 });
    expect(periodoDe('2026-02-10', 'mensual')).toEqual({ desde: '2026-02-01', hasta: '2026-02-28', dias: 30 });
  });
});
