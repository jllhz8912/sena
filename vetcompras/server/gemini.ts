/**
 * Extracción de facturas en PDF con Gemini (único servicio externo, opcional).
 * Si no hay GEMINI_API_KEY en el archivo .env, el resto del sistema funciona
 * igual y solo la lectura automática de PDF queda deshabilitada (los XML de
 * la DIAN se procesan siempre de forma local).
 */

import { GoogleGenAI, Type } from '@google/genai';

const MODELO = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

export function geminiConfigurado(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return !!key && key !== 'MY_GEMINI_API_KEY';
}

interface OpcionCatalogo {
  id: string;
  nombre: string;
  descripcion?: string;
}

interface SolicitudExtraccion {
  pdfBase64: string;
  mimeType: string;
  categorias?: OpcionCatalogo[];
  centrosCosto?: OpcionCatalogo[];
}

function listarOpciones(opciones: OpcionCatalogo[] | undefined): string {
  if (!Array.isArray(opciones) || opciones.length === 0) return '(sin catálogo, deja el campo vacío)';
  return opciones
    .slice(0, 60)
    .map((o) => `    - id "${String(o.id)}": ${String(o.nombre)}${o.descripcion ? ` (${String(o.descripcion)})` : ''}`)
    .join('\n');
}

const ESQUEMA_RESPUESTA = {
  type: Type.OBJECT,
  properties: {
    tipoDocumento: { type: Type.STRING },
    prefijo: { type: Type.STRING },
    folio: { type: Type.STRING },
    cufe: { type: Type.STRING },
    fechaEmision: { type: Type.STRING },
    fechaVencimiento: { type: Type.STRING },
    formaPago: { type: Type.STRING, description: "'contado' o 'credito'" },
    medioPago: { type: Type.STRING },
    diasCredito: { type: Type.NUMBER },
    proveedor: {
      type: Type.OBJECT,
      properties: {
        nit: { type: Type.STRING },
        dv: { type: Type.STRING },
        razonSocial: { type: Type.STRING },
        direccion: { type: Type.STRING },
        ciudad: { type: Type.STRING },
        telefono: { type: Type.STRING },
        email: { type: Type.STRING },
      },
      required: ['nit', 'razonSocial'],
    },
    adquirente: {
      type: Type.OBJECT,
      properties: {
        nit: { type: Type.STRING },
        razonSocial: { type: Type.STRING },
      },
    },
    moneda: { type: Type.STRING },
    subtotal: { type: Type.NUMBER },
    descuentos: { type: Type.NUMBER },
    baseIva0: { type: Type.NUMBER },
    baseIva5: { type: Type.NUMBER },
    baseIva19: { type: Type.NUMBER },
    iva5: { type: Type.NUMBER },
    iva19: { type: Type.NUMBER },
    totalIva: { type: Type.NUMBER },
    impoconsumo: { type: Type.NUMBER },
    reteFuente: { type: Type.NUMBER },
    reteIva: { type: Type.NUMBER },
    reteIca: { type: Type.NUMBER },
    totalRetenciones: { type: Type.NUMBER },
    total: { type: Type.NUMBER },
    categoriaId: { type: Type.STRING },
    centroCostoId: { type: Type.STRING },
    observaciones: { type: Type.STRING },
    lineas: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          codigo: { type: Type.STRING },
          descripcion: { type: Type.STRING },
          cantidad: { type: Type.NUMBER },
          unidad: { type: Type.STRING },
          valorUnitario: { type: Type.NUMBER },
          descuento: { type: Type.NUMBER },
          porcentajeIva: { type: Type.NUMBER },
          valorIva: { type: Type.NUMBER },
          totalLinea: { type: Type.NUMBER },
        },
        required: ['descripcion', 'cantidad', 'valorUnitario', 'totalLinea'],
      },
    },
    confianzaBaja: { type: Type.BOOLEAN },
    camposDudosos: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['tipoDocumento', 'folio', 'fechaEmision', 'proveedor', 'subtotal', 'totalIva', 'total', 'lineas'],
};

export async function extraerFacturaPdf({ pdfBase64, mimeType, categorias, centrosCosto }: SolicitudExtraccion) {
  if (!geminiConfigurado()) {
    throw Object.assign(
      new Error(
        'La lectura automática de PDF requiere configurar GEMINI_API_KEY en el archivo .env. ' +
          'Puede cargar el XML de la DIAN (se procesa sin internet) o registrar la factura manualmente.'
      ),
      { status: 503 }
    );
  }

  const tiposPermitidos = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
  if (!tiposPermitidos.includes(mimeType)) {
    throw Object.assign(new Error(`Tipo de archivo no soportado para extracción: ${mimeType}`), { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const limpio = String(pdfBase64).replace(/^data:[^;]+;base64,/, '');

  const prompt = `Eres un contador y auditor tributario colombiano experto en facturación electrónica DIAN (UBL 2.1) y documentos equivalentes.
Analiza este documento (factura electrónica, documento soporte, cuenta de cobro, tiquete POS, recibo o servicio público) recibido por una veterinaria.
Valores en pesos colombianos (COP) como números enteros, sin separadores de miles.

Reglas:
1. tipoDocumento: 'factura_electronica', 'factura_papel', 'cuenta_cobro', 'documento_soporte', 'recibo_caja', 'tiquete_pos', 'servicios_publicos', 'nota_credito', 'nota_debito' u 'otro'.
2. prefijo y folio (número) por separado. CUFE/CUDE si aparece (cadena hexadecimal de 96 caracteres).
3. Fechas en formato AAAA-MM-DD.
4. Proveedor: NIT sin dígito de verificación, dv por separado, razón social, dirección, ciudad, teléfono y correo.
5. Adquirente: NIT y razón social si aparecen.
6. IVA discriminado: base 0% (excluidos/exentos), base 5%, base 19%, IVA 5%, IVA 19% y total IVA. Impoconsumo (INC) aparte.
7. Retenciones solo si están explícitas en el documento: ReteFuente, ReteIVA y ReteICA.
8. Subtotal (antes de impuestos), descuentos y total a pagar.
9. Líneas: descripción, cantidad, unidad, valor unitario, descuento, % IVA (0, 5 o 19), valor IVA y total de la línea.
10. categoriaId: elige EXACTAMENTE uno de estos ids según la naturaleza del gasto o compra:
${listarOpciones(categorias)}
11. centroCostoId: elige EXACTAMENTE uno de estos ids:
${listarOpciones(centrosCosto)}
12. En camposDudosos lista los campos poco legibles o estimados; confianzaBaja = true si el documento es borroso o faltan datos esenciales.
13. Verifica que subtotal - descuentos + IVA + INC coincida con el total; si no cuadra, márcalo en camposDudosos.`;

  const response = await ai.models.generateContent({
    model: MODELO,
    contents: [{ inlineData: { mimeType, data: limpio } }, { text: prompt }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: ESQUEMA_RESPUESTA,
    },
  });

  try {
    return JSON.parse(response.text?.trim() || '{}');
  } catch {
    throw new Error('Gemini devolvió una respuesta que no es JSON válido. Intente nuevamente o registre la factura manualmente.');
  }
}
