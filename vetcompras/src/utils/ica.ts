/**
 * Liquidación del impuesto de industria y comercio (ICA), avisos y tableros y
 * sobretasa bomberil. Ley 14 de 1983 (arts. 33 y 37), Decreto 1333 de 1986,
 * Ley 1559 de 2012 / 1575 de 2012 (sobretasa bomberil). La tarifa, la sobretasa y
 * si aplica avisos y tableros los fija el Acuerdo (estatuto tributario) de cada
 * municipio: aquí solo se escogen y el sistema hace la cuenta.
 */

export type ActividadIca = 'comercial' | 'servicios' | 'industrial' | 'financiera';

export const ACTIVIDADES_ICA: { id: ActividadIca; texto: string; rango: string; tarifas: number[] }[] = [
  { id: 'comercial', texto: 'Comercial (venta de bienes)', rango: '2 a 10 por mil', tarifas: [2, 3, 4, 4.14, 5, 6, 7, 8, 9, 10] },
  { id: 'servicios', texto: 'Servicios', rango: '2 a 10 por mil', tarifas: [2, 3, 4, 5, 6, 7, 8, 9, 9.66, 10] },
  { id: 'industrial', texto: 'Industrial (fabricación)', rango: '2 a 7 por mil', tarifas: [2, 3, 4, 4.14, 5, 6, 7] },
  { id: 'financiera', texto: 'Financiera', rango: 'según el municipio', tarifas: [3, 5] },
];

export interface DatosIca {
  actividad: ActividadIca;
  /** Tarifa por mil (‰) */
  tarifa: number;
  desde: string;
  hasta: string;
  ingresosBrutos: number;
  devoluciones: number;
  /** Exportaciones, venta de activos fijos, ingresos no sujetos o exentos */
  exentosNoSujetos: number;
  /** Ingresos obtenidos en otros municipios */
  fueraDelMunicipio: number;
  avisosYTableros: boolean;
  /** % de la sobretasa bomberil sobre el ICA (0 si no aplica) */
  sobretasaBomberilPct: number;
  retencionesPracticadas: number;
  autorretenciones: number;
  anticipoAnterior: number;
  /** % de anticipo del año siguiente sobre el ICA (0 si no aplica) */
  anticipoSiguientePct: number;
  municipio?: string;
}

export interface LiquidacionIca extends DatosIca {
  baseGravable: number;
  impuestoIca: number;
  avisos: number;
  bomberil: number;
  totalImpuesto: number;
  anticipoSiguiente: number;
  descuentos: number;
  saldoAPagar: number;
  saldoAFavor: number;
}

/** Los formularios de ICA se diligencian en múltiplos de mil. */
export const aMil = (v: number) => Math.round((Number(v) || 0) / 1000) * 1000;

export function liquidarIca(d: DatosIca): LiquidacionIca {
  const baseGravable = Math.max(0, aMil(d.ingresosBrutos - d.devoluciones - d.exentosNoSujetos - d.fueraDelMunicipio));
  const impuestoIca = aMil((baseGravable * d.tarifa) / 1000);
  const avisos = d.avisosYTableros ? aMil(impuestoIca * 0.15) : 0;
  const bomberil = aMil((impuestoIca * (d.sobretasaBomberilPct || 0)) / 100);
  const totalImpuesto = impuestoIca + avisos + bomberil;
  const anticipoSiguiente = aMil((impuestoIca * (d.anticipoSiguientePct || 0)) / 100);
  const descuentos = aMil(d.retencionesPracticadas) + aMil(d.autorretenciones) + aMil(d.anticipoAnterior);
  const neto = totalImpuesto + anticipoSiguiente - descuentos;
  return { ...d, baseGravable, impuestoIca, avisos, bomberil, totalImpuesto, anticipoSiguiente, descuentos, saldoAPagar: Math.max(0, neto), saldoAFavor: Math.max(0, -neto) };
}

export const DATOS_ICA_VACIOS = (desde: string, hasta: string): DatosIca => ({
  actividad: 'comercial',
  tarifa: 4.14,
  desde,
  hasta,
  ingresosBrutos: 0,
  devoluciones: 0,
  exentosNoSujetos: 0,
  fueraDelMunicipio: 0,
  avisosYTableros: true,
  sobretasaBomberilPct: 0,
  retencionesPracticadas: 0,
  autorretenciones: 0,
  anticipoAnterior: 0,
  anticipoSiguientePct: 0,
});

/** Liquidación guardada (historial). */
export interface RegistroIca extends LiquidacionIca {
  id: string;
  creadoEn: string;
  actualizadoEn: string;
}
