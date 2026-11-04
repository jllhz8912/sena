/**
 * Color de la marca de cada cliente aplicado a toda la interfaz. Las pantallas usan
 * las clases "emerald" (color principal); aquí se recalculan sus tonos a partir del
 * color elegido en Configuración, mezclándolo con blanco (tonos claros) o negro
 * (tonos oscuros). Sin color configurado se usa el azul por defecto del programa.
 */
export const COLOR_POR_DEFECTO = '#2563eb';

const TONOS: [string, number, 'white' | 'black'][] = [
  ['50', 7, 'white'],
  ['100', 14, 'white'],
  ['200', 26, 'white'],
  ['300', 44, 'white'],
  ['400', 70, 'white'],
  ['500', 88, 'white'],
  ['600', 100, 'white'],
  ['700', 84, 'black'],
  ['800', 68, 'black'],
  ['900', 54, 'black'],
  ['950', 36, 'black'],
];

export const esColorValido = (c: string | undefined): c is string => !!c && /^#[0-9a-fA-F]{6}$/.test(c);

export function tonosDe(color: string): Record<string, string> {
  return Object.fromEntries(TONOS.map(([t, pct, base]) => [t, pct === 100 ? color : `color-mix(in oklab, ${color} ${pct}%, ${base})`]));
}

export function aplicarColorMarca(color?: string) {
  if (typeof document === 'undefined') return;
  const raiz = document.documentElement.style;
  const elegido = esColorValido(color) ? color : COLOR_POR_DEFECTO;
  for (const [t, valor] of Object.entries(tonosDe(elegido))) raiz.setProperty(`--color-emerald-${t}`, valor);
}
