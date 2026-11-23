/**
 * Valores de ley por año: salario mínimo, auxilio de transporte, UVT, jornada,
 * recargo dominical, tarifas de IVA y exoneración de aportes.
 *
 * Cada año es un registro que el administrador puede crear o corregir en
 * Configuración › Valores de ley. Los cálculos (nómina, retención, listas de IVA)
 * toman el año de la fecha del documento. Si ese año no existe, usan el último
 * año anterior registrado y la pantalla lo advierte.
 */
import type { ParametrosNomina } from './nomina';

export interface CambioEnElAnio {
  /** Fecha (AAAA-MM-DD) desde la que rige el nuevo valor */
  desde: string;
  valor: number;
}

export interface ValoresLey {
  /** El año como texto, p. ej. "2026" */
  id: string;
  anio: number;
  smmlv: number;
  auxilioTransporte: number;
  uvt: number;
  /** Horas de la jornada semanal al iniciar el año */
  horasSemana: number;
  /** Cambio de jornada dentro del año (Ley 2101 de 2021: 15 de julio) */
  cambioJornada?: CambioEnElAnio;
  /** % de recargo dominical y festivo al iniciar el año */
  recargoDominical: number;
  /** Cambio del recargo dentro del año (Ley 2466 de 2025: 1.º de julio) */
  cambioRecargo?: CambioEnElAnio;
  /** Tarifas de IVA que se ofrecen en compras, ventas, catálogos y precios */
  tarifasIva: number[];
  /** Empleador exonerado de salud 8,5 %, SENA e ICBF (E.T. art. 114-1) */
  exoneradoParafiscales: boolean;
  /** Norma o fuente de los valores (decreto, resolución) */
  fuente?: string;
  creadoEn?: string;
  actualizadoEn?: string;
}

/** Valores que trae el programa. El administrador los puede corregir o agregar años. */
export const VALORES_LEY_DEFECTO: ValoresLey[] = [
  {
    id: '2025',
    anio: 2025,
    smmlv: 1_423_500,
    auxilioTransporte: 200_000,
    uvt: 49_799,
    horasSemana: 46,
    cambioJornada: { desde: '2025-07-15', valor: 44 },
    recargoDominical: 75,
    cambioRecargo: { desde: '2025-07-01', valor: 80 },
    tarifasIva: [0, 5, 19],
    exoneradoParafiscales: true,
    fuente: 'Decretos 1572 y 1573 de 2024; Resolución DIAN 000193 de 2024; Leyes 2101 de 2021 y 2466 de 2025',
  },
  {
    id: '2026',
    anio: 2026,
    smmlv: 1_750_905,
    auxilioTransporte: 249_095,
    uvt: 52_374,
    horasSemana: 44,
    cambioJornada: { desde: '2026-07-15', valor: 42 },
    recargoDominical: 80,
    cambioRecargo: { desde: '2026-07-01', valor: 90 },
    tarifasIva: [0, 5, 19],
    exoneradoParafiscales: true,
    fuente: 'Decreto 159 de 2026; Decretos 1469 y 1470 de 2025; Resolución DIAN 000238 de 2025; Leyes 2101 de 2021 y 2466 de 2025',
  },
];

/** Une los registros guardados con los del programa: el guardado gana para su año. */
export function unirValores(guardados: ValoresLey[] = []): ValoresLey[] {
  const porAnio = new Map<number, ValoresLey>();
  for (const v of VALORES_LEY_DEFECTO) porAnio.set(v.anio, v);
  for (const v of guardados) if (v && Number(v.anio)) porAnio.set(Number(v.anio), normalizar(v));
  return [...porAnio.values()].sort((a, b) => a.anio - b.anio);
}

function normalizar(v: ValoresLey): ValoresLey {
  const tarifas = (Array.isArray(v.tarifasIva) ? v.tarifasIva : [0, 5, 19]).map(Number).filter((t) => Number.isFinite(t) && t >= 0 && t <= 100);
  return { ...v, anio: Number(v.anio), id: String(v.anio), tarifasIva: [...new Set(tarifas)].sort((a, b) => a - b) };
}

export interface ValoresDelAnio {
  valores: ValoresLey;
  /** true si el año pedido no está registrado y se usan los de otro año */
  prestado: boolean;
  anioPedido: number;
}

/** El registro que rige para una fecha (o año). */
export function valoresDelAnio(fechaOAnio: string | number, lista: ValoresLey[] = unirValores()): ValoresDelAnio {
  const anioPedido = typeof fechaOAnio === 'number' ? fechaOAnio : Number(String(fechaOAnio).slice(0, 4)) || new Date().getFullYear();
  const ordenada = [...lista].sort((a, b) => a.anio - b.anio);
  const exacto = ordenada.find((v) => v.anio === anioPedido);
  if (exacto) return { valores: exacto, prestado: false, anioPedido };
  const anterior = [...ordenada].reverse().find((v) => v.anio < anioPedido);
  return { valores: anterior ?? ordenada[0], prestado: true, anioPedido };
}

/** Parámetros de nómina para la fecha del periodo, con los cambios de jornada y recargo dentro del año. */
export function parametrosNominaDe(fecha: string, lista: ValoresLey[] = unirValores()): ParametrosNomina {
  const { valores: v } = valoresDelAnio(fecha, lista);
  const horasSemana = v.cambioJornada && fecha >= v.cambioJornada.desde ? v.cambioJornada.valor : v.horasSemana;
  const recargoDominical = v.cambioRecargo && fecha >= v.cambioRecargo.desde ? v.cambioRecargo.valor : v.recargoDominical;
  return {
    anio: v.anio,
    smmlv: v.smmlv,
    auxilioTransporte: v.auxilioTransporte,
    uvt: v.uvt,
    horasSemana,
    recargoDominical,
    exoneradoParafiscales: v.exoneradoParafiscales,
  };
}

// ---------------------------------------------------------------- caché para las listas de IVA

let cache: ValoresLey[] = unirValores();
const oyentes = new Set<() => void>();

/** Lo llama dataService al leer o guardar los valores. */
export function fijarValoresLey(guardados: ValoresLey[]): void {
  cache = unirValores(guardados);
  oyentes.forEach((f) => f());
}
export function valoresLeyEnMemoria(): ValoresLey[] {
  return cache;
}
export function alCambiarValoresLey(f: () => void): () => void {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

/** Tarifas de IVA vigentes para una fecha (por defecto, hoy). Siempre incluye las que se pidan conservar. */
export function tarifasIva(fecha?: string, conservar?: number): number[] {
  const anio = fecha ? fecha : new Date().toISOString().slice(0, 10);
  const lista = valoresDelAnio(anio, cache).valores.tarifasIva;
  return conservar !== undefined && Number.isFinite(conservar) && !lista.includes(conservar) ? [...lista, conservar].sort((a, b) => a - b) : lista;
}

/** ¿La tarifa está entre las registradas en algún año? (para validar archivos importados) */
export function esTarifaIvaConocida(t: number): boolean {
  return cache.some((v) => v.tarifasIva.includes(t));
}
