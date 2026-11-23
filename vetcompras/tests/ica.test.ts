import { describe, expect, it } from 'vitest';
import { DATOS_ICA_VACIOS, liquidarIca } from '../src/utils/ica';

describe('ICA, avisos y tableros, sobretasa bomberil', () => {
  it('liquida con la tarifa escogida y redondea a miles', () => {
    const r = liquidarIca({ ...DATOS_ICA_VACIOS('2026-01-01', '2026-12-31'), tarifa: 10, ingresosBrutos: 120_400_000, devoluciones: 400_000, sobretasaBomberilPct: 5, retencionesPracticadas: 300_000 });
    expect(r.baseGravable).toBe(120_000_000);
    expect(r.impuestoIca).toBe(1_200_000);
    expect(r.avisos).toBe(180_000); // 15 % del ICA
    expect(r.bomberil).toBe(60_000); // 5 % del ICA
    expect(r.totalImpuesto).toBe(1_440_000);
    expect(r.saldoAPagar).toBe(1_140_000);
  });
  it('sin avisos y con más retenciones que impuesto deja saldo a favor', () => {
    const r = liquidarIca({ ...DATOS_ICA_VACIOS('2026-01-01', '2026-02-28'), tarifa: 4.14, ingresosBrutos: 10_000_000, avisosYTableros: false, retencionesPracticadas: 100_000 });
    expect(r.impuestoIca).toBe(41_000);
    expect(r.saldoAFavor).toBe(59_000);
    expect(r.saldoAPagar).toBe(0);
  });
});
