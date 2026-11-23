import { describe, expect, it } from 'vitest';
import { parametrosNominaDe, tarifasIva, fijarValoresLey, unirValores, valoresDelAnio, esTarifaIvaConocida, type ValoresLey } from '../src/utils/valoresLey';
import { liquidarPago, NOVEDADES_VACIAS, parametrosParaFecha, type Empleado } from '../src/utils/nomina';

const anio2027: ValoresLey = {
  id: '2027', anio: 2027, smmlv: 1_900_000, auxilioTransporte: 270_000, uvt: 55_000, horasSemana: 42,
  recargoDominical: 90, cambioRecargo: { desde: '2027-07-01', valor: 100 }, tarifasIva: [0, 5, 8, 19], exoneradoParafiscales: true,
};

describe('Valores de ley por año', () => {
  it('cada fecha toma los valores de su año', () => {
    expect(parametrosNominaDe('2025-12-15')).toMatchObject({ anio: 2025, smmlv: 1_423_500, auxilioTransporte: 200_000, uvt: 49_799 });
    expect(parametrosNominaDe('2026-01-15')).toMatchObject({ anio: 2026, smmlv: 1_750_905, auxilioTransporte: 249_095, uvt: 52_374 });
  });
  it('aplica los cambios de jornada y recargo dentro del año (leyes 2101 y 2466)', () => {
    expect(parametrosNominaDe('2025-06-30')).toMatchObject({ horasSemana: 46, recargoDominical: 75 });
    expect(parametrosNominaDe('2025-07-01')).toMatchObject({ horasSemana: 46, recargoDominical: 80 });
    expect(parametrosNominaDe('2025-07-15')).toMatchObject({ horasSemana: 44, recargoDominical: 80 });
    expect(parametrosNominaDe('2026-07-01')).toMatchObject({ horasSemana: 44, recargoDominical: 90 });
    expect(parametrosNominaDe('2026-07-15')).toMatchObject({ horasSemana: 42, recargoDominical: 90 });
  });
  it('un año sin registrar usa el último anterior y lo avisa', () => {
    const r = valoresDelAnio('2028-03-01');
    expect(r.prestado).toBe(true);
    expect(r.valores.anio).toBe(2026);
  });
  it('el año agregado por el usuario manda en nómina e IVA', () => {
    const lista = unirValores([anio2027]);
    expect(parametrosNominaDe('2027-03-10', lista)).toMatchObject({ smmlv: 1_900_000, recargoDominical: 90 });
    expect(parametrosNominaDe('2027-08-10', lista)).toMatchObject({ recargoDominical: 100 });
    fijarValoresLey([anio2027]);
    expect(tarifasIva('2027-05-01')).toEqual([0, 5, 8, 19]);
    expect(tarifasIva('2026-05-01')).toEqual([0, 5, 19]);
    expect(tarifasIva('2026-05-01', 16)).toEqual([0, 5, 16, 19]);
    expect(esTarifaIvaConocida(8)).toBe(true);
    // Nómina de 2027 con el salario mínimo de ese año: recibe el auxilio de 2027
    const e: Empleado = { id: 'e', nombre: 'A', documento: '1', cargo: '', fechaIngreso: '2026-01-01', tipoContrato: 'indefinido', salario: 1_900_000, periodicidad: 'mensual', claseRiesgo: 1, activo: true, creadoEn: '', actualizadoEn: '' } as Empleado;
    const pago = liquidarPago(e, NOVEDADES_VACIAS(30), parametrosParaFecha('2027-03-15'));
    expect(pago.devengados.find((c) => /auxilio/i.test(c.concepto))?.valor).toBe(270_000);
    fijarValoresLey([]);
  });
  it('corrige un año que trae el programa', () => {
    const lista = unirValores([{ ...unirValores().find((v) => v.anio === 2026)!, uvt: 99_999 }]);
    expect(parametrosNominaDe('2026-02-01', lista).uvt).toBe(99_999);
  });
});
