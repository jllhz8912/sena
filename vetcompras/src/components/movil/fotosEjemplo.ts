/**
 * Fotos de ejemplo para la versión de prueba: ilustraciones dibujadas en SVG según
 * el tipo de producto (bulto de alimento, caja de tabletas, vacuna, baño, collar…).
 * No usan internet ni imágenes de terceros. El usuario las cambia por sus fotos.
 */

const PALETAS = [
  ['#fde68a', '#d97706'],
  ['#bfdbfe', '#2563eb'],
  ['#bbf7d0', '#16a34a'],
  ['#fecaca', '#dc2626'],
  ['#ddd6fe', '#7c3aed'],
  ['#a5f3fc', '#0891b2'],
  ['#fbcfe8', '#db2777'],
  ['#fed7aa', '#ea580c'],
];

function hash(t: string): number {
  let h = 0;
  for (const c of t) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  return h;
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function etiqueta(nombre: string): string {
  const palabras = nombre.split(/\s+/).slice(0, 3).join(' ');
  return palabras.length > 16 ? palabras.slice(0, 15) + '…' : palabras;
}

type Forma = 'bulto' | 'tabletas' | 'vacuna' | 'bano' | 'collar' | 'consulta' | 'frasco' | 'caja' | 'comida';

function formaDe(nombre: string): Forma {
  const n = nombre.toLowerCase();
  if (/alimento|purina|concentrado|croqueta|bulto|royal|pro ?plan|dog ?chow|cat ?chow|snack|galleta/.test(n)) return 'bulto';
  if (/tableta|comprimid|apoquel|bravecto|simparica|nexgard|desparasit|antipulga/.test(n)) return 'tabletas';
  if (/vacuna|antirr[aá]bica|aplicaci[oó]n|inyecci/.test(n)) return 'vacuna';
  if (/ba[ñn]o|peluquer|corte|u[ñn]as|spa/.test(n)) return 'bano';
  if (/arn[eé]s|collar|correa|pechera|juguete/.test(n)) return 'collar';
  if (/consulta|control|valoraci|cirug|tratamiento|hospital|sutura|cat[eé]ter/.test(n)) return 'consulta';
  if (/shampoo|champ|jarabe|gotas|soluci|loci[oó]n|spray/.test(n)) return 'frasco';
  if (/hamburg|pizza|perro caliente|empanada|arepa|jugo|caf[eé]|gaseosa|almuerzo/.test(n)) return 'comida';
  return 'caja';
}

function dibujo(forma: Forma, claro: string, fuerte: string, texto: string): string {
  const t = `<text x="100" y="__Y__" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#fff" text-anchor="middle">${esc(texto)}</text>`;
  switch (forma) {
    case 'bulto':
      return `<path d="M52 44 Q100 26 148 44 L160 170 Q100 184 40 170 Z" fill="${fuerte}"/><path d="M52 44 Q100 26 148 44 L146 58 Q100 42 54 58 Z" fill="#00000022"/>
        <rect x="58" y="96" width="84" height="40" rx="8" fill="#ffffff33"/><circle cx="100" cy="78" r="14" fill="${claro}"/>${t.replace('__Y__', '122')}`;
    case 'tabletas':
      return `<rect x="38" y="56" width="124" height="96" rx="10" fill="${fuerte}"/><rect x="38" y="56" width="124" height="24" rx="10" fill="#00000022"/>
        <g fill="${claro}">${[0, 1, 2, 3].map((i) => `<ellipse cx="${62 + i * 25}" cy="68" rx="8" ry="5"/>`).join('')}</g>${t.replace('__Y__', '122')}`;
    case 'vacuna':
      return `<rect x="78" y="40" width="44" height="18" rx="4" fill="#64748b"/><rect x="70" y="56" width="60" height="106" rx="14" fill="${fuerte}"/>
        <rect x="70" y="96" width="60" height="34" fill="#ffffff44"/><rect x="84" y="140" width="32" height="10" rx="3" fill="${claro}"/>
        <text x="100" y="118" font-family="Arial" font-size="12" font-weight="700" fill="#fff" text-anchor="middle">${esc(texto.slice(0, 9))}</text>`;
    case 'bano':
      return `<path d="M36 100 H164 V120 Q164 156 128 158 H72 Q36 156 36 120 Z" fill="${fuerte}"/><rect x="30" y="94" width="140" height="12" rx="6" fill="#ffffffaa"/>
        ${[0, 1, 2, 3, 4].map((i) => `<circle cx="${62 + i * 19}" cy="${84 - (i % 2) * 10}" r="${9 + (i % 3) * 3}" fill="#ffffff" stroke="${fuerte}" stroke-width="2"/>`).join('')}
        <text x="100" y="140" font-family="Arial" font-size="14" font-weight="700" fill="#fff" text-anchor="middle">${esc(texto)}</text>`;
    case 'collar':
      return `<ellipse cx="100" cy="104" rx="62" ry="44" fill="none" stroke="${fuerte}" stroke-width="18"/><rect x="88" y="138" width="24" height="20" rx="4" fill="#94a3b8"/>
        <circle cx="100" cy="166" r="11" fill="#fbbf24"/><text x="100" y="110" font-family="Arial" font-size="14" font-weight="700" fill="${fuerte}" text-anchor="middle">${esc(texto)}</text>`;
    case 'consulta':
      return `<path d="M70 46 V96 Q70 128 100 128 Q130 128 130 96 V46" fill="none" stroke="${fuerte}" stroke-width="10" stroke-linecap="round"/>
        <path d="M100 128 V146 Q100 166 122 166 Q144 166 144 146 V132" fill="none" stroke="${fuerte}" stroke-width="9"/><circle cx="144" cy="126" r="12" fill="${fuerte}"/>
        <rect x="34" y="166" width="132" height="22" rx="6" fill="${fuerte}"/><text x="100" y="182" font-family="Arial" font-size="13" font-weight="700" fill="#fff" text-anchor="middle">${esc(texto)}</text>`;
    case 'frasco':
      return `<rect x="84" y="34" width="32" height="22" rx="4" fill="#475569"/><path d="M70 64 Q70 54 82 54 H118 Q130 54 130 64 V164 Q130 172 122 172 H78 Q70 172 70 164 Z" fill="${fuerte}"/>
        <rect x="74" y="98" width="52" height="44" rx="6" fill="#ffffff44"/><text x="100" y="124" font-family="Arial" font-size="11" font-weight="700" fill="#fff" text-anchor="middle">${esc(texto.slice(0, 10))}</text>`;
    case 'comida':
      return `<ellipse cx="100" cy="86" rx="62" ry="34" fill="#f59e0b"/><rect x="38" y="104" width="124" height="12" rx="6" fill="#16a34a"/>
        <rect x="40" y="116" width="120" height="16" rx="6" fill="#7c2d12"/><path d="M40 134 H160 Q160 160 100 160 Q40 160 40 134 Z" fill="#f59e0b"/>${t.replace('__Y__', '182').replace('#fff', fuerte)}`;
    default:
      return `<path d="M40 70 L100 44 L160 70 V150 L100 176 L40 150 Z" fill="${fuerte}"/><path d="M40 70 L100 96 L160 70 L100 44 Z" fill="#ffffff44"/><path d="M100 96 V176" stroke="#00000022" stroke-width="2"/>
        <text x="100" y="140" font-family="Arial" font-size="13" font-weight="700" fill="#fff" text-anchor="middle">${esc(texto)}</text>`;
  }
}

/** Ilustración de ejemplo para un producto, como data URL SVG. */
export function fotoEjemplo(nombre: string): string {
  const [claro, fuerte] = PALETAS[hash(nombre) % PALETAS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="${claro}"/><ellipse cx="100" cy="186" rx="70" ry="8" fill="#00000018"/>${dibujo(formaDe(nombre), claro, fuerte, etiqueta(nombre))}</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace(/\s+/g, ' '));
}
