/**
 * Extracción de datos de Facturas y Documentos PDF usando Gemini
 */

import { Categoria, CentroCosto, CompraDocumento, LineaFactura, TipoDocumento } from '../types';

export interface CatalogosExtraccion {
  categorias: Categoria[];
  centrosCosto: CentroCosto[];
}

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
 * Envía el archivo PDF (o imagen) al servidor local para ser analizado con Gemini.
 * Se envía el catálogo de categorías y centros de costo para que la IA elija
 * ids que existan en la base de datos.
 */
export async function procesarFacturaPdf(file: File, catalogos?: CatalogosExtraccion): Promise<ResultadoExtraccionPdf> {
  const dataUrl = await fileToDataUrl(file);
  return procesarPdfDesdeDataUrl(dataUrl, file.name, file.size, file.type || 'application/pdf', catalogos);
}

export async function procesarPdfDesdeDataUrl(
  dataUrl: string,
  nombre: string,
  tamano: number,
  mimeType: string,
  catalogos?: CatalogosExtraccion
): Promise<ResultadoExtraccionPdf> {
  const response = await fetch('/api/extract-pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pdfBase64: dataUrl,
      fileName: nombre,
      mimeType,
      categorias: catalogos?.categorias.filter((c) => c.activo !== false).map(({ id, nombre, descripcion }) => ({ id, nombre, descripcion })),
      centrosCosto: catalogos?.centrosCosto.filter((c) => c.activo !== false).map(({ id, nombre, descripcion }) => ({ id, nombre, descripcion })),
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

  const tiposValidos: TipoDocumento[] = [
    'factura_electronica', 'factura_papel', 'documento_soporte', 'cuenta_cobro', 'recibo_caja',
    'tiquete_pos', 'servicios_publicos', 'nomina_honorarios', 'nota_credito', 'nota_debito', 'otro',
  ];
  const tipoDoc: TipoDocumento = tiposValidos.includes(raw.tipoDocumento) ? raw.tipoDocumento : 'factura_electronica';
  // Las notas crédito restan: se guardan en negativo, igual que en la lectura de XML.
  const signo = tipoDoc === 'nota_credito' ? -1 : 1;
  const n = (v: unknown) => Math.round(Math.abs(Number(v) || 0)) * signo;
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
        valorIva: n(l.valorIva),
        totalLinea: n(l.totalLinea),
      }))
    : [];

  const subtotal = Math.round(Number(raw.subtotal) || 0);
  const totalIva = Math.round(Number(raw.totalIva) || 0);
  const total = Math.round(Number(raw.total) || (subtotal + totalIva));
  const formaPago = raw.formaPago === 'credito' ? 'credito' : 'contado';

  const datos: Partial<CompraDocumento> = {
    tipoDocumento: tipoDoc,
    origen: ['factura_electronica', 'nota_credito', 'nota_debito'].includes(tipoDoc) ? 'electronica' : 'manual',
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
      ciudad: raw.proveedor?.ciudad || '',
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
    subtotal: n(subtotal),
    descuentos: n(raw.descuentos),
    baseIva0: n(raw.baseIva0),
    baseIva5: n(raw.baseIva5),
    baseIva19: n(raw.baseIva19),
    iva5: n(raw.iva5),
    iva19: n(raw.iva19),
    totalIva: n(totalIva),
    impoconsumo: n(raw.impoconsumo),
    reteFuente: n(raw.reteFuente),
    reteIva: n(raw.reteIva),
    reteIca: n(raw.reteIca),
    totalRetenciones: n(
      Number(raw.totalRetenciones) ||
        (Number(raw.reteFuente || 0) + Number(raw.reteIva || 0) + Number(raw.reteIca || 0))
    ),
    total: n(total),
    saldoPendiente: formaPago === 'contado' || signo < 0 ? 0 : total,
    estadoPago: formaPago === 'contado' || signo < 0 ? 'pagada' : 'pendiente',
    fechaPago: formaPago === 'contado' || signo < 0 ? raw.fechaEmision : undefined,
    // Si la IA devolvió un id inexistente, completarDocumento/RevisionFactura lo reasignan
    categoriaId: catalogos?.categorias.some((c) => c.id === raw.categoriaId) ? raw.categoriaId : '',
    centroCostoId: catalogos?.centrosCosto.some((c) => c.id === raw.centroCostoId) ? raw.centroCostoId : '',
    esGasto: !!catalogos?.categorias.find((c) => c.id === raw.categoriaId)?.esGasto,
    lineas,
    observaciones: raw.observaciones || '',
    archivoAdjunto: {
      nombre,
      tipo: mimeType === 'application/pdf' ? 'pdf' : 'imagen',
      tamano,
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
