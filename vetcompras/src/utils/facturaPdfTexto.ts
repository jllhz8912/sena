/**
 * Lectura sin internet de la representación gráfica (PDF o foto) de una factura
 * electrónica colombiana. Dos fuentes:
 *
 *  1. El código QR que exige la DIAN (Res. 000165 de 2023, anexo técnico): trae
 *     número, fecha, NIT del emisor, valor sin impuestos, IVA, total y CUFE.
 *  2. El texto del PDF: proveedor, fechas, retenciones y forma de pago.
 *
 * Lo del QR prevalece porque es el dato oficial; el texto completa lo demás.
 * Estas funciones solo trabajan con texto, así que se prueban sin navegador.
 */

export interface DatosQrDian {
  numero?: string;
  prefijo?: string;
  folio?: string;
  fecha?: string;
  nitEmisor?: string;
  docAdquirente?: string;
  subtotal?: number;
  iva?: number;
  otrosImpuestos?: number;
  total?: number;
  cufe?: string;
}

export interface DatosTextoFactura {
  razonSocial?: string;
  nitEmisor?: string;
  dvEmisor?: string;
  nitAdquirente?: string;
  prefijo?: string;
  folio?: string;
  cufe?: string;
  fechaEmision?: string;
  fechaVencimiento?: string;
  formaPago?: 'contado' | 'credito';
  subtotal?: number;
  descuentos?: number;
  iva?: number;
  iva19?: number;
  iva5?: number;
  impoconsumo?: number;
  reteFuente?: number;
  reteIva?: number;
  reteIca?: number;
  total?: number;
  esNotaCredito?: boolean;
  /** Qué documento parece ser, según su encabezado */
  tipo?: 'factura_electronica' | 'factura_papel' | 'cuenta_cobro' | 'documento_soporte' | 'nota_credito' | 'cotizacion' | 'tiquete_pos' | 'servicios_publicos';
}

/** Convierte "1.234.567,89", "$ 1,234,567.89" o "1234567.89" a número (pesos). */
export function numeroCo(texto: string): number {
  let s = texto.replace(/[^\d.,-]/g, '');
  if (!s || !/\d/.test(s)) return 0;
  const negativo = s.startsWith('-');
  s = s.replace(/-/g, '');
  const ultimoPunto = s.lastIndexOf('.');
  const ultimaComa = s.lastIndexOf(',');
  if (ultimoPunto >= 0 && ultimaComa >= 0) {
    // El separador que va de último es el decimal
    s = ultimaComa > ultimoPunto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (ultimaComa >= 0) {
    s = /,\d{3}$/.test(s) && !/,\d{1,2}$/.test(s) ? s.replace(/,/g, '') : s.replace(/,(?=\d{3}(,|$))/g, '').replace(',', '.');
  } else if (ultimoPunto >= 0) {
    // "1.234.567" son miles; "1234.50" es decimal
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * (negativo ? -1 : 1)) : 0;
}

/** Normaliza fechas "2026-10-20", "20/10/2026", "20-10-2026" o "20 de octubre de 2026" a AAAA-MM-DD. */
export function fechaIso(texto: string): string | undefined {
  const t = texto.trim();
  let m = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(t);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  m = /(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)\.?\s+(?:de\s+|del\s+)?(\d{4})/i.exec(t);
  if (m) {
    const mes = meses.findIndex((x) => x.startsWith(m![2].toLowerCase().slice(0, 3)));
    if (mes >= 0) return `${m[3]}-${String(mes + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return undefined;
}

const separarNumero = (numero: string) => {
  const m = /^([A-Za-z]{0,6})[\s-]*(\d+)$/.exec(numero.trim());
  return m ? { prefijo: m[1].toUpperCase(), folio: m[2] } : { prefijo: '', folio: numero.trim() };
};

const CLAVES_QR = ['NumFac', 'NumDS', 'NumNC', 'NumND', 'FecFac', 'FecDS', 'HorFac', 'NitFac', 'NitOFE', 'NumOFE', 'DocAdq', 'NitAdq', 'NumAdq', 'ValFac', 'ValIva', 'ValOtroIm', 'ValTolFac', 'ValTotFac', 'CUFE', 'CUDE', 'CUDS', 'QRCode'];

/** Interpreta el texto del QR de una factura electrónica DIAN. */
export function parsearQrDian(texto: string): DatosQrDian | null {
  if (!texto) return null;
  const valores: Record<string, string> = {};
  const patron = new RegExp(`\\b(${CLAVES_QR.join('|')})\\s*[:=]\\s*`, 'gi');
  const posiciones: { clave: string; inicio: number; fin: number }[] = [];
  for (let m = patron.exec(texto); m; m = patron.exec(texto)) posiciones.push({ clave: m[1].toLowerCase(), inicio: m.index, fin: patron.lastIndex });
  posiciones.forEach((p, i) => {
    const hasta = i + 1 < posiciones.length ? posiciones[i + 1].inicio : texto.length;
    valores[p.clave] = texto.slice(p.fin, hasta).split(/[\r\n]/)[0].trim();
  });
  const enlace = /documentkey=([0-9a-f]{96})/i.exec(texto);
  const cufe = (valores.cufe || valores.cude || valores.cuds || enlace?.[1] || '').replace(/\s/g, '');
  const numero = valores.numfac || valores.numds || valores.numnc || valores.numnd || '';
  if (!numero && !cufe) return null;
  const val = (...claves: string[]) => {
    for (const c of claves) if (valores[c] !== undefined) return numeroCo(valores[c].split(/\s+/)[0]);
    return undefined;
  };
  return {
    numero: numero || undefined,
    ...(numero ? separarNumero(numero) : {}),
    fecha: fechaIso((valores.fecfac || valores.fecds || '').split(/\s+/)[0]),
    nitEmisor: (valores.nitfac || valores.nitofe || valores.numofe || '').replace(/\D/g, '') || undefined,
    docAdquirente: (valores.docadq || valores.nitadq || valores.numadq || '').replace(/\D/g, '') || undefined,
    subtotal: val('valfac'),
    iva: val('valiva'),
    otrosImpuestos: val('valotroim'),
    total: val('valtolfac', 'valtotfac'),
    cufe: /^[0-9a-f]{96}$/i.test(cufe) ? cufe.toLowerCase() : undefined,
  };
}

// ------------------------------------------------------------------ texto

const RE_NIT = /\bN\.?\s?I\.?\s?T\.?\s*(?:No\.?|N[°º]|#|:)?\s*:?\s*(\d[\d.\s]{5,14}\d)(?:\s*[-–]\s*(\d))?/gi;
const RE_EMPRESA = /\b(S\.?\s?A\.?\s?S\.?|S\.?\s?A\.?|LTDA\.?|E\.?\s?U\.?|S\.?\s?C\.?\s?A\.?|& CIA|SOCIEDAD|COOPERATIVA|DISTRIBUIDORA|LABORATORIOS?)\b/i;

/** Último valor en pesos de una línea (los montos suelen ir al final). */
function montoDeLinea(linea: string): number | undefined {
  const montos = linea.match(/-?\$?\s?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|-?\$?\s?\d+(?:[.,]\d{1,2})?/g);
  if (!montos) return undefined;
  const n = numeroCo(montos[montos.length - 1]);
  return Number.isFinite(n) ? n : undefined;
}

/** Busca la primera línea con la etiqueta y devuelve su monto (o el de la línea siguiente). */
function montoEtiquetado(lineas: string[], etiqueta: RegExp, excluir?: RegExp): number | undefined {
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (!etiqueta.test(l) || (excluir && excluir.test(l))) continue;
    const resto = l.replace(etiqueta, ' ').replace(/\d{1,2}(?:[.,]\d+)?\s?%/g, ' ');
    const enLinea = montoDeLinea(resto);
    if (enLinea !== undefined && enLinea !== 0) return Math.abs(enLinea);
    const siguiente = lineas[i + 1] ? montoDeLinea(lineas[i + 1]) : undefined;
    if (siguiente !== undefined && siguiente !== 0 && !/[a-z]{4,}/i.test(lineas[i + 1].replace(/cop|pesos/gi, ''))) return Math.abs(siguiente);
    if (enLinea === 0) return 0;
  }
  return undefined;
}

function fechaEtiquetada(lineas: string[], etiqueta: RegExp): string | undefined {
  for (let i = 0; i < lineas.length; i++) {
    const m = etiqueta.exec(lineas[i]);
    if (!m) continue;
    const despues = lineas[i].slice(m.index + m[0].length);
    const f = fechaIso(despues) || (lineas[i + 1] ? fechaIso(lineas[i + 1]) : undefined);
    if (f) return f;
  }
  return undefined;
}

/** Extrae los datos principales del texto de la factura (líneas en orden de lectura). */
export function parsearTextoFactura(lineas: string[]): DatosTextoFactura {
  const limpias = lineas.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const todo = limpias.join('\n');
  const r: DatosTextoFactura = {};

  const encabezado = limpias.slice(0, 20).join(' ');
  r.esNotaCredito = /nota\s+cr[eé]dito/i.test(encabezado);
  r.tipo = r.esNotaCredito
    ? 'nota_credito'
    : /cotizaci[oó]n|proforma|presupuesto/i.test(encabezado)
      ? 'cotizacion'
      : /cuenta\s+de\s+cobro/i.test(encabezado)
        ? 'cuenta_cobro'
        : /documento\s+soporte/i.test(encabezado)
          ? 'documento_soporte'
          : /servicios?\s+p[uú]blicos?|energ[ií]a|acueducto|alcantarillado|gas natural/i.test(encabezado)
            ? 'servicios_publicos'
            : /factura\s+electr[oó]nica|\bCUFE\b|representaci[oó]n\s+gr[aá]fica/i.test(todo)
              ? 'factura_electronica'
              : /tiquete|\bPOS\b|sistema\s+pos/i.test(encabezado)
                ? 'tiquete_pos'
                : 'factura_papel';

  // NIT del emisor (el primero) y del adquirente (el siguiente distinto)
  const nits: { nit: string; dv?: string; linea: number }[] = [];
  limpias.forEach((l, i) => {
    for (const m of l.matchAll(RE_NIT)) {
      const nit = m[1].replace(/\D/g, '');
      if (nit.length >= 6 && !nits.some((x) => x.nit === nit)) nits.push({ nit, dv: m[2], linea: i });
    }
  });
  if (nits[0]) {
    r.nitEmisor = nits[0].nit;
    r.dvEmisor = nits[0].dv;
  }
  if (nits[1]) r.nitAdquirente = nits[1].nit;

  // Razón social: línea con forma societaria cerca del primer NIT, o la anterior al NIT
  const cerca = nits[0] ? limpias.slice(Math.max(0, nits[0].linea - 4), nits[0].linea + 2) : limpias.slice(0, 10);
  const conSociedad = cerca.find((l) => RE_EMPRESA.test(l) && !/factura|adquiriente|cliente|señor/i.test(l));
  let razon = conSociedad || (nits[0] && nits[0].linea > 0 ? limpias[nits[0].linea - 1] : undefined);
  if (!razon && nits[0]) razon = limpias[nits[0].linea].split(/\bN\.?\s?I\.?\s?T/i)[0];
  if (razon) {
    razon = razon.split(/\bN\.?\s?I\.?\s?T\b|\b(?:factura|cotizaci[oó]n|cuenta\s+de\s+cobro|documento\s+soporte|nota\s+cr[eé]dito|remisi[oó]n)\b/i)[0].replace(/^(raz[oó]n social|emisor|vendedor|proveedor)\s*:?\s*/i, '').trim();
    if (razon.length >= 3 && /[a-z]/i.test(razon)) r.razonSocial = razon;
  }

  // CUFE: 96 caracteres hexadecimales (a veces partido en varias líneas)
  const sinEspacios = todo.replace(/\s+/g, '');
  const cufe = /(?:CUFE|CUDE)[:#]?([0-9a-f]{96})/i.exec(sinEspacios) || /([0-9a-f]{96})/i.exec(sinEspacios);
  if (cufe) r.cufe = cufe[1].toLowerCase();

  // Número de la factura
  const num =
    /(?:factura|nota|cuenta\s+de\s+cobro|cotizaci[oó]n|documento\s+soporte|recibo|remisi[oó]n|orden)[^\n]{0,40}?(?:No\.?|N[°º.]|N[uú]mero|#)\s*:?\s*([A-Z]{1,6})?[\s-]*(\d{1,12})\b/i.exec(todo) ||
    /\b(?:No\.?|N[°º])\s*:?\s*([A-Z]{1,6})[\s-]*(\d{1,12})\b/.exec(todo);
  if (num) {
    r.prefijo = (num[1] || '').toUpperCase();
    r.folio = num[2];
  }

  r.fechaEmision =
    fechaEtiquetada(limpias, /fecha\s*(?:y\s*hora\s*)?(?:de\s*)?(?:emisi[oó]n|expedici[oó]n|generaci[oó]n|factura|elaboraci[oó]n|documento)/i) ??
    fechaEtiquetada(limpias.filter((l) => !/vencim|l[ií]mite|pago\s+oportuno/i.test(l)), /\bfecha\b\s*:?/i);
  r.fechaVencimiento = fechaEtiquetada(limpias, /(?:fecha\s*(?:de\s*)?)?vencimiento|fecha\s*l[ií]mite\s*de\s*pago/i);

  const forma = /(?:forma|condici[oó]n)\s*(?:de\s*)?pago\s*:?\s*(contado|cr[eé]dito)/i.exec(todo);
  if (forma) r.formaPago = /cr/i.test(forma[1]) ? 'credito' : 'contado';
  else if (r.fechaVencimiento && r.fechaEmision && r.fechaVencimiento > r.fechaEmision) r.formaPago = 'credito';

  const noRete = /rete|retenci/i;
  r.subtotal = montoEtiquetado(
    limpias,
    /\b(?:sub\s?-?\s?total|total\s+bruto|valor\s+bruto|base\s+imponible|total\s+base|valor\s+(?:sin|antes\s+de)\s+iva|total\s+sin\s+iva|valor\s+neto)\b/i
  );
  r.descuentos = montoEtiquetado(limpias, /\b(?:total\s+)?descuentos?\b/i);
  r.iva19 = montoEtiquetado(limpias, /\biva\s*(?:\(?\s*19\s?%\)?)/i, noRete);
  r.iva5 = montoEtiquetado(limpias, /\biva\s*(?:\(?\s*5\s?%\)?)/i, noRete);
  r.iva = montoEtiquetado(limpias, /\b(?:total\s+)?iva\b/i, noRete);
  r.impoconsumo = montoEtiquetado(limpias, /impo\s?consumo|\binc\b/i);
  r.reteFuente = montoEtiquetado(limpias, /rete\s?-?\s?fuente|retenci[oó]n\s+en\s+la\s+fuente|\bretefte\b/i);
  r.reteIva = montoEtiquetado(limpias, /rete\s?-?\s?iva/i);
  r.reteIca = montoEtiquetado(limpias, /rete\s?-?\s?ica/i);
  r.total =
    montoEtiquetado(limpias, /\b(?:total\s+(?:a\s+pagar|factura|neto|documento|general)|valor\s+total|neto\s+a\s+pagar)\b/i) ??
    montoEtiquetado(limpias, /^\s*total\b/i, /sub\s?total|items|unidades|cantidad|iva/i);
  return r;
}

/** Número y prefijo desde el nombre del archivo (ej. "...COCO_PINK_SAS_FEC-24495.pdf"). */
export function numeroDesdeArchivo(nombre: string): { prefijo: string; folio: string } | null {
  const m = /([A-Za-z]{1,6})[-_ ]?(\d{2,12})(?=\.[a-z]+$|$)/i.exec(nombre.replace(/\s+$/, ''));
  return m ? { prefijo: m[1].toUpperCase(), folio: m[2] } : null;
}

/** Nombre del proveedor desde el archivo ("FACTURA_ELECTRONICA_DE_VENTA_COCO_PINK_SAS_FEC-24495.pdf"). */
export function proveedorDesdeArchivo(nombre: string): string | undefined {
  const base = nombre.replace(/\.[a-z]+$/i, '').replace(/[_]+/g, ' ');
  const m = /(?:factura\s+electr[oó]nica\s+de\s+venta|factura\s+electr[oó]nica|factura)\s+(.+?)\s+[A-Za-z]{1,6}[- ]?\d{2,}$/i.exec(base);
  return m ? m[1].trim() : undefined;
}

export interface ItemLeido {
  codigo?: string;
  descripcion: string;
  cantidad: number;
  valorUnitario: number;
  total: number;
  porcentajeIva?: number;
}

const ES_NUMERO = /^-?\$?\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?$|^-?\$?\s?\d+(?:[.,]\d{1,4})?$/;
const FIN_TABLA = /sub\s?-?\s?total|total\s+(?:bruto|a\s+pagar|factura)|valor\s+(?:sin|antes)|base\s+imponible|total\s+iva|^\s*total\b|observaciones|son:|valor\s+en\s+letras/i;
const NO_ITEM = /\b(nit|fecha|factura|cufe|tel[eé]fono|direcci[oó]n|cliente|adquir|forma\s+de\s+pago|vencim|resoluci[oó]n|p[aá]gina|iva\s+\d|rete)/i;

/**
 * Detalle de productos de la factura. Cada fila puede traer columnas separadas por "¦"
 * (texto del PDF) o venir en una sola línea (OCR). Se acepta una fila cuando
 * cantidad × valor unitario coincide con el total de la línea (con o sin IVA o descuento).
 */
export function parsearItems(filas: string[]): ItemLeido[] {
  const items: ItemLeido[] = [];
  let dentro = false;
  for (const fila of filas) {
    const plano = fila.replace(/¦/g, ' ').replace(/\s+/g, ' ').trim();
    if (!dentro && /descripci[oó]n|detalle|producto|concepto|art[ií]culo/i.test(plano) && /cant|valor|precio|total|vr\.?/i.test(plano)) {
      dentro = true;
      continue;
    }
    if (dentro && FIN_TABLA.test(plano)) break;
    if (NO_ITEM.test(plano)) continue;
    const item = leerFilaItem(fila);
    if (item && (dentro || items.length)) items.push(item);
    else if (item && !dentro) items.push(item);
  }
  return items;
}

function leerFilaItem(fila: string): ItemLeido | null {
  // Tokens: celdas si hay columnas; si no, palabras
  const celdas = fila.includes('¦') ? fila.split('¦').map((c) => c.trim()).filter(Boolean) : fila.trim().split(/\s+/);
  // Números al final de la fila (cantidad, valor unitario, %, total…)
  const numeros: string[] = [];
  let i = celdas.length - 1;
  for (; i >= 0; i--) {
    const c = celdas[i].replace(/^\$\s?/, '').replace(/%$/, '');
    if (ES_NUMERO.test(c) || /^\$$/.test(celdas[i])) {
      if (!/^\$$/.test(celdas[i])) numeros.unshift(celdas[i]);
    } else break;
  }
  if (numeros.length < 2) return null;
  let texto = celdas.slice(0, i + 1).join(' ').trim();
  if (!/[a-záéíóúñ]{3,}/i.test(texto)) return null;
  const valores = numeros.map((n) => ({ crudo: n, v: numeroCo(n), pct: /%$/.test(n) }));
  const total = valores[valores.length - 1].v;
  if (total <= 0) return null;
  // Busca cantidad y valor unitario cuyo producto dé el total (con IVA o descuento de hasta 30 %)
  const candidatos = valores.slice(0, -1).filter((x) => !x.pct);
  for (let a = 0; a < candidatos.length; a++) {
    for (let b = a + 1; b < candidatos.length; b++) {
      const [cant, unit] = [candidatos[a].v, candidatos[b].v];
      if (cant <= 0 || unit <= 0 || cant > 100000) continue;
      const bruto = cant * unit;
      const iva = valores.find((x) => x.pct)?.v;
      const ok = Math.abs(bruto - total) <= Math.max(2, total * 0.005) ||
        (total > bruto * 1.04 && total <= bruto * 1.2) || (total < bruto && total >= bruto * 0.7);
      if (!ok) continue;
      // Código al inicio (ej. "A-123" o "7702123456789")
      let codigo: string | undefined;
      const m = /^([A-Z0-9][A-Z0-9-]{2,20})\s+(.+)$/i.exec(texto);
      if (m && /\d/.test(m[1]) && !/^\d{1,2}$/.test(m[1])) {
        codigo = m[1];
        texto = m[2];
      }
      return {
        codigo,
        descripcion: texto.replace(/\s+/g, ' ').slice(0, 120),
        cantidad: cant,
        valorUnitario: unit,
        total: Math.abs(bruto - total) <= Math.max(2, total * 0.005) ? total : bruto,
        porcentajeIva: iva && [0, 5, 19].includes(iva) ? iva : undefined,
      };
    }
  }
  return null;
}
