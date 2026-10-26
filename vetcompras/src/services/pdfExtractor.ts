/**
 * Extracción de datos de Facturas y Documentos PDF usando Gemini
 */

import { CompraDocumento, LineaFactura, TipoDocumento } from '../types';

export interface ResultadoExtraccionPdf {
  datos: Partial<CompraDocumento>;
  confianzaBaja: boolean;
  camposDudosos: string[];
  pdfDataUrl: string;
}

/**
 * Convierte un objeto File o Blob a Data URL en base64
 */
export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Envía el archivo PDF al endpoint del servidor para ser analizado con Gemini
 */
export async function procesarFacturaPdf(file: File): Promise<ResultadoExtraccionPdf> {
  const dataUrl = await fileToDataUrl(file);

  const response = await fetch('/api/extract-pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pdfBase64: dataUrl,
      fileName: file.name,
      mimeType: file.type || 'application/pdf',
    }),
  });

  if (!response.ok) {
    let errorMsg = 'Error en el servidor al analizar el PDF con Gemini.';
    try {
      const errJson = await response.json();
      if (errJson.error) errorMsg = errJson.error;
    } catch {
      // Ignorar si no era JSON
    }
    throw new Error(errorMsg);
  }

  const result = await response.json();
  const raw = result.data || {};

  // Mapear líneas de ítems
  const lineas: LineaFactura[] = Array.isArray(raw.lineas)
    ? raw.lineas.map((l: any, idx: number) => ({
        id: 'lin-' + (idx + 1),
        codigo: l.codigo || '',
        descripcion: l.descripcion || 'Producto / Insumo',
        cantidad: Number(l.cantidad) || 1,
        unidad: l.unidad || 'UND',
        valorUnitario: Math.round(Number(l.valorUnitario) || 0),
        descuento: Math.round(Number(l.descuento) || 0),
        porcentajeIva: Number(l.porcentajeIva) || 0,
        valorIva: Math.round(Number(l.valorIva) || 0),
        totalLinea: Math.round(Number(l.totalLinea) || 0),
      }))
    : [];

  const tipoDoc: TipoDocumento = (raw.tipoDocumento as TipoDocumento) || 'factura_electronica';
  const subtotal = Math.round(Number(raw.subtotal) || 0);
  const totalIva = Math.round(Number(raw.totalIva) || 0);
  const total = Math.round(Number(raw.total) || (subtotal + totalIva));
  const formaPago = raw.formaPago === 'credito' ? 'credito' : 'contado';

  const datos: Partial<CompraDocumento> = {
    tipoDocumento: tipoDoc,
    origen: tipoDoc === 'factura_electronica' ? 'electronica' : 'manual',
    prefijo: raw.prefijo || '',
    folio: raw.folio || '',
    cufe: raw.cufe || '',
    fechaEmision: raw.fechaEmision || new Date().toISOString().split('T')[0],
    fechaVencimiento: raw.fechaVencimiento || raw.fechaEmision || new Date().toISOString().split('T')[0],
    formaPago,
    medioPago: raw.medioPago || 'transferencia',
    diasCredito: raw.diasCredito ? Number(raw.diasCredito) : 0,
    proveedor: {
      nit: raw.proveedor?.nit || '',
      dv: raw.proveedor?.dv || '',
      razonSocial: raw.proveedor?.razonSocial || 'Proveedor no identificado',
      direccion: raw.proveedor?.direccion || '',
      ciudad: raw.proveedor?.ciudad || 'Bogotá D.C.',
      telefono: raw.proveedor?.telefono || '',
      email: raw.proveedor?.email || '',
    },
    adquirente: raw.adquirente
      ? {
          nit: raw.adquirente.nit || '',
          razonSocial: raw.adquirente.razonSocial || '',
        }
      : undefined,
    moneda: raw.moneda || 'COP',
    subtotal,
    descuentos: Math.round(Number(raw.descuentos) || 0),
    baseIva0: Math.round(Number(raw.baseIva0) || 0),
    baseIva5: Math.round(Number(raw.baseIva5) || 0),
    baseIva19: Math.round(Number(raw.baseIva19) || 0),
    iva5: Math.round(Number(raw.iva5) || 0),
    iva19: Math.round(Number(raw.iva19) || 0),
    totalIva,
    impoconsumo: Math.round(Number(raw.impoconsumo) || 0),
    reteFuente: Math.round(Number(raw.reteFuente) || 0),
    reteIva: Math.round(Number(raw.reteIva) || 0),
    reteIca: Math.round(Number(raw.reteIca) || 0),
    totalRetenciones: Math.round(
      Number(raw.totalRetenciones) ||
        (Number(raw.reteFuente || 0) + Number(raw.reteIva || 0) + Number(raw.reteIca || 0))
    ),
    total,
    saldoPendiente: formaPago === 'contado' ? 0 : total,
    estadoPago: formaPago === 'contado' ? 'pagada' : 'pendiente',
    fechaPago: formaPago === 'contado' ? raw.fechaEmision : undefined,
    categoriaId: raw.categoriaSugerida || 'cat-medicamentos',
    centroCostoId: raw.centroCostoSugerido || 'cc-clinica',
    esGasto: false,
    lineas,
    observaciones: raw.observaciones || '',
    archivoAdjunto: {
      nombre: file.name,
      tipo: 'pdf',
      tamano: file.size,
      dataUrl,
    },
    metadatosExtraccion: {
      motor: 'gemini_flash',
      confianzaBaja: !!raw.confianzaBaja,
      camposDudosos: Array.isArray(raw.camposDudosos) ? raw.camposDudosos : [],
    },
  };

  return {
    datos,
    confianzaBaja: !!raw.confianzaBaja,
    camposDudosos: Array.isArray(raw.camposDudosos) ? raw.camposDudosos : [],
    pdfDataUrl: dataUrl,
  };
}
