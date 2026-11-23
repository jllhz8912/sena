/**
 * Nómina colombiana (vigencia 2026). Cálculos puros, sin pantalla, para poder
 * probarlos. Todo resultado se puede editar en la pantalla antes de guardarlo.
 *
 * Normas: CST arts. 64 (indemnización), 127-128 (salario), 186 (vacaciones),
 * 249 (cesantías), 306 (prima); Ley 52 de 1975 (intereses a las cesantías);
 * Ley 15 de 1959 (auxilio de transporte); Ley 100 de 1993 (salud 4 % y pensión 4 %
 * del trabajador; fondo de solidaridad pensional desde 4 SMMLV); Ley 2101 de 2021
 * (jornada de 42 horas desde el 15 de julio de 2026); Ley 2466 de 2025 (nocturno desde
 * las 7 p. m. y recargo dominical del 90 % desde el 1.º de julio de 2026); E.T. art. 383
 * (retención procedimiento 1), art. 206 num. 10 (25 % exento) y art. 114-1 (exoneración
 * de salud, SENA e ICBF del empleador).
 */

export interface ParametrosNomina {
  anio: number;
  smmlv: number;
  auxilioTransporte: number;
  uvt: number;
  /** Horas de la jornada semanal (para el valor de la hora) */
  horasSemana: number;
  /** % de recargo dominical y festivo */
  recargoDominical: number;
  /** Empleador exonerado de salud 8,5 %, SENA e ICBF (E.T. art. 114-1) para quienes ganan menos de 10 SMMLV */
  exoneradoParafiscales: boolean;
}

/** Valores vigentes en 2026 (Decreto 159 de 2026 / 1469 y 1470 de 2025; Resolución DIAN 000238 de 2025). */
export const PARAMETROS_2026: ParametrosNomina = {
  anio: 2026,
  smmlv: 1_750_905,
  auxilioTransporte: 249_095,
  uvt: 52_374,
  horasSemana: 42,
  recargoDominical: 90,
  exoneradoParafiscales: true,
};

/** Jornada y recargo dominical según la fecha del periodo (cronograma de las leyes 2101 y 2466). */
export function parametrosParaFecha(fecha: string, base: ParametrosNomina = PARAMETROS_2026): ParametrosNomina {
  const horasSemana = fecha >= '2026-07-15' ? 42 : fecha >= '2025-07-15' ? 44 : 46;
  const recargoDominical = fecha >= '2027-07-01' ? 100 : fecha >= '2026-07-01' ? 90 : 80;
  return { ...base, horasSemana, recargoDominical };
}

export const TARIFAS_ARL: { clase: number; texto: string; tarifa: number }[] = [
  { clase: 1, texto: 'Riesgo I (oficina, comercio)', tarifa: 0.522 },
  { clase: 2, texto: 'Riesgo II', tarifa: 1.044 },
  { clase: 3, texto: 'Riesgo III', tarifa: 2.436 },
  { clase: 4, texto: 'Riesgo IV', tarifa: 4.35 },
  { clase: 5, texto: 'Riesgo V', tarifa: 6.96 },
];

export type TipoContrato = 'indefinido' | 'fijo' | 'obra' | 'aprendiz';
export type Periodicidad = 'quincenal' | 'mensual';

export interface Empleado {
  id: string;
  nombre: string;
  documento: string;
  cargo?: string;
  email?: string;
  telefono?: string;
  fechaIngreso: string; // AAAA-MM-DD
  fechaFinContrato?: string; // contratos a término fijo u obra
  tipoContrato: TipoContrato;
  salario: number;
  /** Salario integral (13 SMMLV o más): sin prestaciones y con base del 70 % */
  integral?: boolean;
  periodicidad: Periodicidad;
  claseRiesgo: number;
  eps?: string;
  fondoPension?: string;
  fondoCesantias?: string;
  cajaCompensacion?: string;
  banco?: string;
  cuenta?: string;
  /** Tiene dependientes económicos (deducción de retención, art. 387 E.T.) */
  dependientes?: boolean;
  activo: boolean;
  fechaRetiro?: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface Novedades {
  /** Días trabajados en el periodo (15 o 30 por defecto) */
  dias: number;
  horasExtraDiurnas: number; // +25 %
  horasExtraNocturnas: number; // +75 %
  horasRecargoNocturno: number; // +35 %
  horasDominicales: number; // + recargo dominical
  horasExtraDominicalesDiurnas: number; // +25 % + dominical
  comisiones: number; // salariales
  bonificacionesNoSalariales: number;
  otrosDescuentos: number; // préstamos, libranzas…
  descripcionDescuentos?: string;
}

export const NOVEDADES_VACIAS = (dias: number): Novedades => ({
  dias,
  horasExtraDiurnas: 0,
  horasExtraNocturnas: 0,
  horasRecargoNocturno: 0,
  horasDominicales: 0,
  horasExtraDominicalesDiurnas: 0,
  comisiones: 0,
  bonificacionesNoSalariales: 0,
  otrosDescuentos: 0,
});

export interface Concepto {
  concepto: string;
  valor: number;
  detalle?: string;
}

export interface ResultadoPago {
  devengados: Concepto[];
  deducciones: Concepto[];
  totalDevengado: number;
  totalDeducciones: number;
  neto: number;
  /** Base de aportes (IBC) del periodo */
  ibc: number;
  aportesEmpleador: Concepto[];
  provisiones: Concepto[];
  costoTotalEmpleador: number;
}

export const redondear = (v: number) => Math.round(Number(v) || 0);
/** Redondeo de aportes a seguridad social: al múltiplo de 100 superior */
const aporte = (v: number) => Math.ceil(Math.max(0, v) / 100) * 100;

/** Días entre dos fechas con el año comercial de 360 días (incluye ambos extremos). */
export function dias360(desde: string, hasta: string): number {
  if (!desde || !hasta || hasta < desde) return 0;
  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  const dia1 = Math.min(d1, 30);
  // El último día de un mes cuenta como día 30 (febrero incluido)
  const finDeMes = new Date(a2, m2, 0).getDate() === d2;
  const dia2 = finDeMes ? 30 : Math.min(d2, 30);
  return (a2 - a1) * 360 + (m2 - m1) * 30 + (dia2 - dia1) + 1;
}

export function valorHora(salario: number, p: ParametrosNomina): number {
  const horasMes = (p.horasSemana / 6) * 30;
  return salario / horasMes;
}

/** ¿Tiene derecho al auxilio de transporte? (hasta 2 SMMLV y sin salario integral) */
export function tieneAuxilio(e: Pick<Empleado, 'salario' | 'integral'>, p: ParametrosNomina): boolean {
  return !e.integral && e.salario <= 2 * p.smmlv;
}

/** % del fondo de solidaridad pensional según el IBC (Ley 797 de 2003). */
export function porcentajeSolidaridad(ibcMensual: number, p: ParametrosNomina): number {
  const veces = ibcMensual / p.smmlv;
  if (veces < 4) return 0;
  if (veces < 16) return 1;
  if (veces < 17) return 1.2;
  if (veces < 18) return 1.4;
  if (veces < 19) return 1.6;
  if (veces < 20) return 1.8;
  return 2;
}

/** Tabla del art. 383 E.T.: retención mensual en UVT sobre la base gravable en UVT. */
export function retencionArt383(baseUvt: number): number {
  const tramos: [number, number, number][] = [
    // [desde UVT, %, UVT fijas]
    [2300, 39, 770],
    [945, 37, 268],
    [640, 35, 162],
    [360, 33, 69],
    [150, 28, 10],
    [95, 19, 0],
  ];
  for (const [desde, pct, fijas] of tramos) if (baseUvt > desde) return ((baseUvt - desde) * pct) / 100 + fijas;
  return 0;
}

/**
 * Retención en la fuente por salarios, procedimiento 1 (mensualizada).
 * Depura: ingreso − salud y pensión obligatorias − dependientes (10 %, máx. 32 UVT)
 * − 25 % exento (máx. 790 UVT al año), con el tope del 40 % y 1.340 UVT anuales.
 */
export function retencionProcedimiento1(pagoLaboralMensual: number, aportesObligatorios: number, dependientes: boolean, p: ParametrosNomina): number {
  const neto = Math.max(0, pagoLaboralMensual - aportesObligatorios);
  const deduccionDependientes = dependientes ? Math.min(pagoLaboralMensual * 0.1, 32 * p.uvt) : 0;
  const subtotal = neto - deduccionDependientes;
  const exenta25 = Math.min(subtotal * 0.25, (790 / 12) * p.uvt);
  const limite = Math.min(neto * 0.4, (1340 / 12) * p.uvt);
  const beneficios = Math.min(deduccionDependientes + exenta25, limite);
  const base = Math.max(0, neto - beneficios);
  const retUvt = retencionArt383(base / p.uvt);
  return Math.round((retUvt * p.uvt) / 1000) * 1000;
}

/** Liquida un pago de nómina (quincena o mes) con todo lo de ley. */
export function liquidarPago(e: Empleado, n: Novedades, p: ParametrosNomina): ResultadoPago {
  const diasMes = 30;
  const salarioPeriodo = (e.salario * n.dias) / diasMes;
  const hora = valorHora(e.salario, p);
  const rd = p.recargoDominical / 100;
  const extras = [
    { c: 'Horas extra diurnas', h: n.horasExtraDiurnas, f: 1.25 },
    { c: 'Horas extra nocturnas', h: n.horasExtraNocturnas, f: 1.75 },
    { c: 'Recargo nocturno', h: n.horasRecargoNocturno, f: 0.35 },
    { c: 'Recargo dominical y festivo', h: n.horasDominicales, f: rd },
    { c: 'Horas extra dominicales diurnas', h: n.horasExtraDominicalesDiurnas, f: 1.25 + rd },
  ];
  const devengados: Concepto[] = [{ concepto: e.integral ? 'Salario integral' : 'Salario básico', valor: redondear(salarioPeriodo), detalle: `${n.dias} días` }];
  for (const x of extras) if (x.h > 0) devengados.push({ concepto: x.c, valor: redondear(hora * x.f * x.h), detalle: `${x.h} h × ${Math.round(x.f * 100)} %` });
  if (n.comisiones > 0) devengados.push({ concepto: 'Comisiones', valor: redondear(n.comisiones) });
  const salarial = devengados.reduce((s, d) => s + d.valor, 0);
  const auxilio = tieneAuxilio(e, p) ? redondear((p.auxilioTransporte * n.dias) / diasMes) : 0;
  if (auxilio) devengados.push({ concepto: 'Auxilio de transporte', valor: auxilio, detalle: `${n.dias} días` });
  if (n.bonificacionesNoSalariales > 0) devengados.push({ concepto: 'Bonificación no salarial', valor: redondear(n.bonificacionesNoSalariales) });

  // Base de aportes: salarial (70 % si es integral), mínimo proporcional a 1 SMMLV
  const ibc = Math.max(e.integral ? salarial * 0.7 : salarial, (p.smmlv / diasMes) * n.dias);
  const aprendiz = e.tipoContrato === 'aprendiz';
  const salud = aprendiz ? 0 : aporte(ibc * 0.04);
  const pension = aprendiz ? 0 : aporte(ibc * 0.04);
  const fsp = aprendiz ? 0 : aporte((ibc * porcentajeSolidaridad((ibc / n.dias) * diasMes, p)) / 100);
  const deducciones: Concepto[] = [];
  if (salud) deducciones.push({ concepto: 'Salud (4 %)', valor: salud });
  if (pension) deducciones.push({ concepto: 'Pensión (4 %)', valor: pension });
  if (fsp) deducciones.push({ concepto: 'Fondo de solidaridad pensional', valor: fsp });
  // Retención: se calcula sobre el mes y se toma la parte del periodo
  const factor = diasMes / Math.max(1, n.dias);
  const retencion = Math.round((retencionProcedimiento1((salarial + n.bonificacionesNoSalariales) * factor, (salud + pension + fsp) * factor, !!e.dependientes, p) / factor) / 1000) * 1000;
  if (retencion > 0) deducciones.push({ concepto: 'Retención en la fuente', valor: retencion, detalle: 'Procedimiento 1' });
  if (n.otrosDescuentos > 0) deducciones.push({ concepto: n.descripcionDescuentos || 'Otros descuentos', valor: redondear(n.otrosDescuentos) });

  const totalDevengado = devengados.reduce((s, d) => s + d.valor, 0);
  const totalDeducciones = deducciones.reduce((s, d) => s + d.valor, 0);

  // Lo que paga el empleador (no se descuenta al trabajador)
  const exonerado = p.exoneradoParafiscales && e.salario < 10 * p.smmlv;
  const arlTarifa = TARIFAS_ARL.find((t) => t.clase === e.claseRiesgo)?.tarifa ?? 0.522;
  const aportesEmpleador: Concepto[] = [
    ...(exonerado || aprendiz ? [] : [{ concepto: 'Salud empleador (8,5 %)', valor: aporte(ibc * 0.085) }]),
    ...(aprendiz ? [] : [{ concepto: 'Pensión empleador (12 %)', valor: aporte(ibc * 0.12) }]),
    { concepto: `ARL (${arlTarifa.toLocaleString('es-CO')} %)`, valor: aporte((ibc * arlTarifa) / 100) },
    ...(aprendiz ? [] : [{ concepto: 'Caja de compensación (4 %)', valor: aporte(ibc * 0.04) }]),
    ...(exonerado || aprendiz ? [] : [
      { concepto: 'ICBF (3 %)', valor: aporte(ibc * 0.03) },
      { concepto: 'SENA (2 %)', valor: aporte(ibc * 0.02) },
    ]),
  ];
  // Provisiones de prestaciones (lo que se va acumulando para pagar después)
  const basePrest = e.integral ? 0 : salarial + auxilio;
  const provisiones: Concepto[] = e.integral || aprendiz
    ? [{ concepto: 'Vacaciones (4,17 %)', valor: redondear((salarial * 15) / 360) }]
    : [
        { concepto: 'Prima de servicios (8,33 %)', valor: redondear(basePrest / 12) },
        { concepto: 'Cesantías (8,33 %)', valor: redondear(basePrest / 12) },
        { concepto: 'Intereses de cesantías (1 %)', valor: redondear((basePrest / 12) * 0.12) },
        { concepto: 'Vacaciones (4,17 %)', valor: redondear((salarial * 15) / 360) },
      ];
  const costoTotalEmpleador = totalDevengado + aportesEmpleador.reduce((s, a) => s + a.valor, 0) + provisiones.reduce((s, a) => s + a.valor, 0);
  return { devengados, deducciones, totalDevengado, totalDeducciones, neto: totalDevengado - totalDeducciones, ibc: redondear(ibc), aportesEmpleador, provisiones, costoTotalEmpleador };
}

// ------------------------------------------------------------------ prestaciones
export interface Prestacion {
  concepto: string;
  base: number;
  dias: number;
  valor: number;
  formula: string;
}

/** Base de prestaciones: salario mensual + auxilio de transporte si tiene derecho. */
export function basePrestaciones(e: Empleado, p: ParametrosNomina, salarioPromedio?: number): number {
  const salario = salarioPromedio || e.salario;
  return salario + (tieneAuxilio(e, p) ? p.auxilioTransporte : 0);
}

/** Prima de servicios (CST art. 306): base × días del semestre / 360. */
export function liquidarPrima(base: number, dias: number): Prestacion {
  return { concepto: 'Prima de servicios', base, dias, valor: redondear((base * dias) / 360), formula: `${base.toLocaleString('es-CO')} × ${dias} / 360` };
}

/** Cesantías (CST art. 249): base × días / 360. */
export function liquidarCesantias(base: number, dias: number): Prestacion {
  return { concepto: 'Cesantías', base, dias, valor: redondear((base * dias) / 360), formula: `${base.toLocaleString('es-CO')} × ${dias} / 360` };
}

/** Intereses a las cesantías (Ley 52 de 1975): cesantías × días × 12 % / 360. */
export function liquidarIntereses(cesantias: number, dias: number): Prestacion {
  return { concepto: 'Intereses de cesantías', base: cesantias, dias, valor: redondear((cesantias * dias * 0.12) / 360), formula: `${cesantias.toLocaleString('es-CO')} × ${dias} × 12 % / 360` };
}

/** Vacaciones (CST art. 186): salario sin auxilio × días trabajados / 720 (15 días hábiles por año). */
export function liquidarVacaciones(salario: number, diasTrabajados: number, diasYaDisfrutados = 0): Prestacion {
  const diasCausados = (diasTrabajados * 15) / 360;
  const pendientes = Math.max(0, diasCausados - diasYaDisfrutados);
  return {
    concepto: 'Vacaciones',
    base: salario,
    dias: Math.round(pendientes * 100) / 100,
    valor: redondear((salario / 30) * pendientes),
    formula: `${salario.toLocaleString('es-CO')} / 30 × ${(Math.round(pendientes * 100) / 100).toLocaleString('es-CO')} días`,
  };
}

/** Inicio del semestre de la prima que contiene la fecha (1 de enero o 1 de julio). */
export const inicioSemestre = (fecha: string) => `${fecha.slice(0, 4)}-${fecha.slice(5, 7) <= '06' ? '01' : '07'}-01`;

export type MotivoRetiro = 'renuncia' | 'sin_justa_causa' | 'justa_causa' | 'fin_contrato' | 'mutuo_acuerdo';

export const MOTIVOS_RETIRO: { id: MotivoRetiro; texto: string }[] = [
  { id: 'renuncia', texto: 'Renuncia voluntaria' },
  { id: 'sin_justa_causa', texto: 'Despido sin justa causa (paga indemnización)' },
  { id: 'justa_causa', texto: 'Despido con justa causa' },
  { id: 'fin_contrato', texto: 'Terminación del plazo o de la obra' },
  { id: 'mutuo_acuerdo', texto: 'Mutuo acuerdo' },
];

/**
 * Indemnización por despido sin justa causa (CST art. 64).
 * Indefinido: menos de 10 SMMLV → 30 días el primer año y 20 por cada año siguiente
 * (proporcional); 10 SMMLV o más → 20 y 15. Fijo u obra: salarios del tiempo que
 * faltaba, mínimo 15 días.
 */
export function indemnizacion(e: Empleado, fechaRetiro: string, p: ParametrosNomina): Prestacion {
  const diario = e.salario / 30;
  if (e.tipoContrato === 'fijo' || e.tipoContrato === 'obra') {
    const faltan = e.fechaFinContrato ? Math.max(0, dias360(fechaRetiro, e.fechaFinContrato) - 1) : 0;
    const dias = Math.max(15, faltan);
    return { concepto: 'Indemnización (art. 64 CST)', base: e.salario, dias, valor: redondear(diario * dias), formula: `Salario diario × ${dias} días que faltaban` };
  }
  const trabajados = dias360(e.fechaIngreso, fechaRetiro);
  const alto = e.salario >= 10 * p.smmlv;
  const primero = alto ? 20 : 30;
  const siguientes = alto ? 15 : 20;
  const dias = trabajados <= 360 ? primero : primero + ((trabajados - 360) / 360) * siguientes;
  const d = Math.round(dias * 100) / 100;
  return { concepto: 'Indemnización (art. 64 CST)', base: e.salario, dias: d, valor: redondear(diario * dias), formula: `${primero} días el primer año + ${siguientes} por año siguiente → ${d.toLocaleString('es-CO')} días` };
}

export interface LiquidacionFinal {
  conceptos: Prestacion[];
  total: number;
  diasTrabajados: number;
}

/**
 * Liquidación final del contrato: cesantías e intereses (desde el último corte),
 * prima proporcional del semestre, vacaciones pendientes, salario pendiente e
 * indemnización si el despido es sin justa causa.
 */
export function liquidacionFinal(
  e: Empleado,
  fechaRetiro: string,
  motivo: MotivoRetiro,
  p: ParametrosNomina,
  opciones: { diasSalarioPendiente?: number; diasVacacionesDisfrutadas?: number; cesantiasDesde?: string; primaDesde?: string } = {}
): LiquidacionFinal {
  const diasTrabajados = dias360(e.fechaIngreso, fechaRetiro);
  const base = basePrestaciones(e, p);
  const conceptos: Prestacion[] = [];
  if (opciones.diasSalarioPendiente) {
    const d = opciones.diasSalarioPendiente;
    conceptos.push({ concepto: 'Salario pendiente', base: e.salario, dias: d, valor: redondear((e.salario / 30) * d), formula: `${e.salario.toLocaleString('es-CO')} / 30 × ${d}` });
  }
  if (!e.integral && e.tipoContrato !== 'aprendiz') {
    // Cesantías: desde el 1 de enero del año del retiro (o el ingreso, si fue después)
    const desdeCes = [opciones.cesantiasDesde || `${fechaRetiro.slice(0, 4)}-01-01`, e.fechaIngreso].sort().pop()!;
    const diasCes = dias360(desdeCes, fechaRetiro);
    const ces = liquidarCesantias(base, diasCes);
    conceptos.push(ces, liquidarIntereses(ces.valor, diasCes));
    const desdePrima = [opciones.primaDesde || inicioSemestre(fechaRetiro), e.fechaIngreso].sort().pop()!;
    conceptos.push(liquidarPrima(base, dias360(desdePrima, fechaRetiro)));
  }
  conceptos.push(liquidarVacaciones(e.salario, diasTrabajados, opciones.diasVacacionesDisfrutadas || 0));
  if (motivo === 'sin_justa_causa') conceptos.push(indemnizacion(e, fechaRetiro, p));
  return { conceptos: conceptos.filter((c) => c.valor > 0 || c.concepto === 'Vacaciones'), total: conceptos.reduce((s, c) => s + c.valor, 0), diasTrabajados };
}

// ------------------------------------------------------------ registro de pagos
export type TipoPagoNomina = 'nomina' | 'prima' | 'vacaciones' | 'cesantias' | 'intereses' | 'liquidacion';

export const NOMBRE_TIPO_PAGO: Record<TipoPagoNomina, string> = {
  nomina: 'Nómina',
  prima: 'Prima de servicios',
  vacaciones: 'Vacaciones',
  cesantias: 'Cesantías',
  intereses: 'Intereses de cesantías',
  liquidacion: 'Liquidación final',
};

/** Pago guardado (comprobante). Los valores son los que quedaron después de editar. */
export interface PagoNomina {
  id: string;
  numero: string; // NOM-0001
  tipo: TipoPagoNomina;
  empleadoId: string;
  empleadoNombre: string;
  empleadoDocumento: string;
  cargo?: string;
  periodoDesde: string;
  periodoHasta: string;
  fechaPago: string;
  devengados: Concepto[];
  deducciones: Concepto[];
  totalDevengado: number;
  totalDeducciones: number;
  neto: number;
  medioPago: 'efectivo' | 'consignacion' | 'transferencia' | 'nequi' | 'daviplata';
  referenciaPago?: string;
  /** Foto o PDF del soporte de consignación (data URL, comprimido) */
  soporte?: string;
  observaciones?: string;
  creadoEn: string;
  actualizadoEn: string;
}

export const MEDIOS_PAGO_NOMINA: { id: PagoNomina['medioPago']; texto: string }[] = [
  { id: 'efectivo', texto: 'Efectivo' },
  { id: 'consignacion', texto: 'Consignación' },
  { id: 'transferencia', texto: 'Transferencia bancaria' },
  { id: 'nequi', texto: 'Nequi' },
  { id: 'daviplata', texto: 'Daviplata' },
];

/** Periodo de pago que contiene la fecha: 1-15 / 16-fin de mes, o el mes completo. */
export function periodoDe(fecha: string, periodicidad: Periodicidad): { desde: string; hasta: string; dias: number } {
  const [a, m, d] = fecha.split('-').map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  const mm = String(m).padStart(2, '0');
  if (periodicidad === 'mensual') return { desde: `${a}-${mm}-01`, hasta: `${a}-${mm}-${ultimo}`, dias: 30 };
  return d <= 15 ? { desde: `${a}-${mm}-01`, hasta: `${a}-${mm}-15`, dias: 15 } : { desde: `${a}-${mm}-16`, hasta: `${a}-${mm}-${ultimo}`, dias: 15 };
}
