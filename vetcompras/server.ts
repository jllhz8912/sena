import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Set body parsers with generous limits for PDF base64 payloads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Server-side Gemini AI initialization
// Strictly following AI Studio guidelines: User-Agent 'aistudio-build' and process.env.GEMINI_API_KEY
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no está configurada en el entorno.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

/**
 * Endpoint para extraer información estructurada de facturas o documentos en PDF
 * Utiliza Gemini con schema JSON estructurado para el formato de facturación en Colombia
 */
app.post('/api/extract-pdf', async (req, res) => {
  try {
    const { pdfBase64, mimeType = 'application/pdf', fileName = 'factura.pdf' } = req.body;

    if (!pdfBase64) {
      return res.status(400).json({
        error: 'No se proporcionó el contenido base64 del archivo PDF.',
      });
    }

    // Clean base64 header if included (e.g., data:application/pdf;base64,...)
    const cleanBase64 = pdfBase64.replace(/^data:[^;]+;base64,/, '');

    const ai = getGeminiClient();

    const promptText = `Eres un experto contador y auditor tributario colombiano especializado en facturación electrónica de la DIAN y documentos equivalentes para veterinarias.
Analiza detenidamente este documento PDF (Factura electrónica, cuenta de cobro, documento soporte o recibo de compra).
Extrae todos los campos requeridos con máxima exactitud en números enteros para valores en pesos colombianos (COP).

Instrucciones tributarias colombianas:
1. Extrae tipo de documento: 'factura_electronica', 'factura_papel', 'cuenta_cobro', 'documento_soporte', 'recibo_caja', 'tiquete_pos', 'servicios_publicos' u 'otro'.
2. Extrae prefijo y número de factura (folio).
3. Extrae el CUFE si está presente en el documento (cadena alfanumérica larga hexadecimal).
4. Fechas en formato YYYY-MM-DD.
5. Proveedor: NIT (sin dígito de verificación en el nit), dígito de verificación (dv si existe), razón social completa, dirección, ciudad, teléfono y correo electrónico.
6. Adquirente / Cliente: NIT y nombre o razón social si aparecen.
7. Discriminación de IVA: Base gravable 0%, Base 5%, Base 19%, IVA 5%, IVA 19% y Total IVA.
8. Impoconsumo (INC) si aplica.
9. Retenciones si están explícitas: ReteFuente, ReteIVA, ReteICA y sus valores en pesos.
10. Subtotal, Descuentos y Total general a pagar.
11. Detalle de líneas / ítems: descripción exacta, cantidad, unidad (UND, KGM, GLN, etc.), valor unitario, descuento, % IVA (0, 5 o 19) y total de la línea.
12. Clasificación sugerida para veterinaria:
    - 'Medicamentos e insumos veterinarios'
    - 'Concentrados y alimentos'
    - 'Accesorios y juguetes'
    - 'Vacunas y biológicos'
    - 'Material quirúrgico y de laboratorio'
    - 'Arriendo'
    - 'Servicios públicos'
    - 'Nómina y honorarios'
    - 'Publicidad y marketing'
    - 'Transporte y domicilios'
    - 'Mantenimiento y aseo'
    - 'Software y tecnología'
    - 'Impuestos y tasas'
    - 'Otros gastos'
13. Centro de costo sugerido: 'Veterinaria clínica', 'Tienda/Petshop', 'Peluquería / Grooming' o 'Administración'.
14. En 'camposDudosos', lista nombres de campos que tuvieron baja legibilidad o donde hiciste una estimación. Marca 'confianzaBaja': true si la calidad del documento es borrosa o faltan datos esenciales.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: cleanBase64,
          },
        },
        {
          text: promptText,
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
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
            categoriaSugerida: { type: Type.STRING },
            centroCostoSugerido: { type: Type.STRING },
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
            camposDudosos: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            'tipoDocumento',
            'folio',
            'fechaEmision',
            'proveedor',
            'subtotal',
            'totalIva',
            'total',
            'lineas',
          ],
        },
      },
    });

    const rawJson = response.text?.trim() || '{}';
    const parsedData = JSON.parse(rawJson);

    return res.json({
      success: true,
      data: parsedData,
      fileName,
    });
  } catch (error: any) {
    console.error('Error en /api/extract-pdf:', error);
    return res.status(500).json({
      error: error?.message || 'Error al procesar el archivo PDF con Gemini.',
    });
  }
});

// Setup Vite development server or static serving
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // Development mode with Vite middleware
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: 3000,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    // Production mode
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VetCompras Server] Escuchando en http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fallo al iniciar el servidor:', err);
  process.exit(1);
});
