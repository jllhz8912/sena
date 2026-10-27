/**
 * Lee en este PC (sin internet ni claves) el PDF o la foto de una factura
 * electrónica: el código QR de la DIAN y el texto del documento.
 */
import jsQR from 'jsqr';
import { CompraDocumento, LineaFactura, Proveedor } from '../types';
import { fechaLocal } from '../utils/formatters';
import {
  DatosQrDian,
  DatosTextoFactura,
  numeroDesdeArchivo,
  parsearQrDian,
  parsearItems,
  parsearTextoFactura,
  proveedorDesdeArchivo,
} from '../utils/facturaPdfTexto';
import { pdfjs } from './vistaPdf';
import { fileToDataUrl } from './pdfExtractor';

/** Busca un QR en la imagen; si no aparece entera, prueba por cuadrantes ampliados. */
function buscarQr(lienzo: HTMLCanvasElement): string | null {
  const ctx = lienzo.getContext('2d', { willReadFrequently: true })!;
  const leer = (x: number, y: number, w: number, h: number) => {
    const img = ctx.getImageData(x, y, w, h);
    return jsQR(img.data, w, h, { inversionAttempts: 'attemptBoth' })?.data || null;
  };
  const { width: W, height: H } = lienzo;
  const completo = leer(0, 0, W, H);
  if (completo) return completo;
  // Los QR de factura suelen estar en una esquina: se revisan mitades y cuartos
  const zonas = [
    [0, 0, W, H / 2], [0, H / 2, W, H / 2],
    [0, 0, W / 2, H / 2], [W / 2, 0, W / 2, H / 2], [0, H / 2, W / 2, H / 2], [W / 2, H / 2, W / 2, H / 2],
  ];
  for (const [x, y, w, h] of zonas) {
    const r = leer(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
    if (r) return r;
  }
  return null;
}

/**
 * Reconocimiento de texto (OCR) en el propio PC para documentos escaneados o fotos.
 * Usa los archivos servidos en /ocr/ (sin internet). Si no están disponibles
 * (por ejemplo en la demostración en línea), devuelve null.
 */
async function ocr(lienzos: HTMLCanvasElement[]): Promise<string[] | null> {
  try {
    const { createWorker } = await import('tesseract.js');
    const raiz = new URL('/ocr/', location.href).href;
    const trabajador = await createWorker('spa', 1, {
      workerPath: raiz + 'worker.min.js',
      corePath: raiz + 'core',
      langPath: raiz + 'lang',
      workerBlobURL: false,
      gzip: true,
    });
    try {
      const lineas: string[] = [];
      for (const l of lienzos) {
        const { data } = await trabajador.recognize(l);
        lineas.push(...data.text.split(/\r?\n/));
      }
      return lineas;
    } finally {
      await trabajador.terminate();
    }
  } catch (err) {
    console.warn('[VetCompras] OCR no disponible:', err);
    return null;
  }
}

async function leerPdf(datos: ArrayBuffer): Promise<{ lineas: string[]; filas: string[]; qr: string | null; paginas: number; imagenes: HTMLCanvasElement[] }> {
  const { getDocument } = await pdfjs();
  const doc = await getDocument({ data: new Uint8Array(datos) }).promise;
  try {
    const lineas: string[] = [];
    const filas: string[] = []; // renglones completos con columnas separadas por "¦" (para el detalle)
    const imagenes: HTMLCanvasElement[] = [];
    let qr: string | null = null;
    const paginas = Math.min(doc.numPages, 4);
    for (let n = 1; n <= paginas; n++) {
      const pagina = await doc.getPage(n);
      // Texto en orden de lectura: se agrupa por renglón (posición vertical)
      const contenido = await pagina.getTextContent();
      const renglones = new Map<number, { x: number; w: number; s: string }[]>();
      for (const it of contenido.items as any[]) {
        if (!it.str?.trim()) continue;
        const y = Math.round(it.transform[5] / 3) * 3;
        const lista = renglones.get(y) || [];
        lista.push({ x: it.transform[4], w: it.width || it.str.length * 4, s: it.str });
        renglones.set(y, lista);
      }
      // Un renglón con columnas muy separadas (ej. proveedor a la izquierda y número a la
      // derecha) se divide en varias líneas para no mezclar los datos
      [...renglones.entries()]
        .sort((a, b) => b[0] - a[0])
        .forEach(([, partes]) => {
          partes.sort((a, b) => a.x - b.x);
          filas.push(partes.map((p, k) => (k && p.x - (partes[k - 1].x + partes[k - 1].w) > 8 ? '¦ ' : '') + p.s).join(' '));
          let actual = '';
          let finAnterior = -Infinity;
          for (const parte of partes) {
            if (actual && parte.x - finAnterior > 40) {
              lineas.push(actual);
              actual = '';
            }
            actual = actual ? actual + ' ' + parte.s : parte.s;
            finAnterior = parte.x + parte.w;
          }
          if (actual) lineas.push(actual);
        });

      if (!qr) {
        const base = pagina.getViewport({ scale: 1 });
        for (const ancho of [1700, 2600]) {
          const viewport = pagina.getViewport({ scale: ancho / base.width });
          const lienzo = document.createElement('canvas');
          lienzo.width = Math.ceil(viewport.width);
          lienzo.height = Math.ceil(viewport.height);
          const ctx = lienzo.getContext('2d', { willReadFrequently: true })!;
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, lienzo.width, lienzo.height);
          await pagina.render({ canvas: lienzo, canvasContext: ctx, viewport }).promise;
          if (ancho === 1700 && n <= 2) imagenes.push(lienzo);
          qr = buscarQr(lienzo);
          if (qr) break;
        }
      } else if (n <= 2) {
        // Se guarda la imagen por si hay que leerla con OCR (PDF escaneado)
        const base = pagina.getViewport({ scale: 1 });
        const viewport = pagina.getViewport({ scale: 1700 / base.width });
        const lienzo = document.createElement('canvas');
        lienzo.width = Math.ceil(viewport.width);
        lienzo.height = Math.ceil(viewport.height);
        const ctx = lienzo.getContext('2d')!;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, lienzo.width, lienzo.height);
        await pagina.render({ canvas: lienzo, canvasContext: ctx, viewport }).promise;
        imagenes.push(lienzo);
      }
    }
    return { lineas, filas, qr, paginas: doc.numPages, imagenes };
  } finally {
    await doc.destroy();
  }
}

async function leerImagen(archivo: Blob): Promise<{ qr: string | null; lienzo: HTMLCanvasElement }> {
  const bmp = await createImageBitmap(archivo);
  const escala = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(bmp.width * escala);
  lienzo.height = Math.round(bmp.height * escala);
  lienzo.getContext('2d')!.drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
  return { qr: buscarQr(lienzo), lienzo };
}

export interface ResultadoPdfLocal {
  datos: Partial<CompraDocumento>;
  /** Hay lo mínimo para revisar y guardar (proveedor o número, y total) */
  suficiente: boolean;
  qr: DatosQrDian | null;
  texto: DatosTextoFactura;
}

/** Lee un PDF o una imagen de factura y arma el borrador para la revisión. */
export async function leerFacturaLocal(
  archivo: Blob,
  nombre: string,
  proveedores: Proveedor[] = []
): Promise<ResultadoPdfLocal> {
  const esPdf = archivo.type === 'application/pdf' || /\.pdf$/i.test(nombre);
  let lineas: string[] = [];
  let filas: string[] = [];
  let qrTexto: string | null = null;
  let imagenes: HTMLCanvasElement[] = [];
  if (esPdf) {
    const r = await leerPdf(await archivo.arrayBuffer());
    lineas = r.lineas;
    filas = r.filas;
    qrTexto = r.qr;
    imagenes = r.imagenes;
  } else {
    const r = await leerImagen(archivo);
    qrTexto = r.qr;
    imagenes = [r.lienzo];
  }
  // Escaneado o foto: casi no hay texto que leer directamente
  let usoOcr = false;
  if (lineas.join('').replace(/\s/g, '').length < 40 && imagenes.length) {
    const reconocido = await ocr(imagenes);
    if (reconocido) {
      lineas = reconocido;
      filas = reconocido;
      usoOcr = true;
    }
  }
  const qr = qrTexto ? parsearQrDian(qrTexto) : null;
  const texto = parsearTextoFactura(lineas);
  const porArchivo = numeroDesdeArchivo(nombre);
  const dudosos: string[] = [];

  const nit = qr?.nitEmisor || texto.nitEmisor || '';
  const conocido = nit ? proveedores.find((p) => p.nit.replace(/\D/g, '') === nit) : undefined;
  const razonSocial = conocido?.razonSocial || texto.razonSocial || proveedorDesdeArchivo(nombre) || '';
  if (!nit) dudosos.push('proveedor.nit');
  if (!razonSocial) dudosos.push('proveedor.razonSocial');

  const prefijo = qr?.prefijo ?? texto.prefijo ?? porArchivo?.prefijo ?? '';
  const folio = qr?.folio || texto.folio || porArchivo?.folio || '';
  if (!folio) dudosos.push('folio');

  const iva = qr?.iva ?? texto.iva ?? ((texto.iva19 || 0) + (texto.iva5 || 0) || 0);
  const subtotal = qr?.subtotal ?? texto.subtotal ?? 0;
  const impoconsumo = texto.impoconsumo ?? (qr?.otrosImpuestos || 0);
  const descuentos = texto.descuentos || 0;
  let total = qr?.total ?? texto.total ?? 0;
  if (!total && subtotal) total = subtotal - descuentos + iva + impoconsumo;
  if (!total) dudosos.push('total');
  if (!subtotal) dudosos.push('subtotal');

  // IVA por tarifa: lo que diga el documento; si no, se deduce de la proporción con la base
  let iva19 = texto.iva19 || 0;
  let iva5 = texto.iva5 || 0;
  if (!iva19 && !iva5 && iva) {
    const base = subtotal - descuentos;
    const tasa = base > 0 ? iva / base : 0;
    if (Math.abs(tasa - 0.05) < 0.01) iva5 = iva;
    else {
      iva19 = iva;
      if (Math.abs(tasa - 0.19) > 0.01) dudosos.push('iva');
    }
  }
  const baseIva19 = iva19 ? Math.round(iva19 / 0.19) : 0;
  const baseIva5 = iva5 ? Math.round(iva5 / 0.05) : 0;
  const baseIva0 = Math.max(0, subtotal - descuentos - baseIva19 - baseIva5);

  const reteFuente = texto.reteFuente || 0;
  const reteIva = texto.reteIva || 0;
  const reteIca = texto.reteIca || 0;
  const totalRetenciones = reteFuente + reteIva + reteIca;

  const fechaEmision = qr?.fecha || texto.fechaEmision || fechaLocal();
  if (!qr?.fecha && !texto.fechaEmision) dudosos.push('fechaEmision');
  const formaPago = texto.formaPago || (texto.fechaVencimiento && texto.fechaVencimiento > fechaEmision ? 'credito' : 'contado');
  const fechaVencimiento = texto.fechaVencimiento || fechaEmision;

  const esNota = !!texto.esNotaCredito;
  const tipoTexto = texto.tipo || (qr ? 'factura_electronica' : 'factura_papel');
  const tipoDocumento = qr || texto.cufe ? (esNota ? 'nota_credito' : 'factura_electronica') : tipoTexto === 'cotizacion' ? 'otro' : tipoTexto;
  const electronico = ['factura_electronica', 'nota_credito', 'documento_soporte'].includes(tipoDocumento);
  const signo = esNota ? -1 : 1;
  const s = (v: number) => Math.round(Math.abs(v)) * signo;

  // Detalle de productos (para el inventario); si no se reconoce, una línea resumen
  const items = parsearItems(filas);
  const sumaItems = items.reduce((a, it) => a + it.total, 0);
  if (items.length && subtotal && Math.abs(sumaItems - (subtotal - descuentos)) > Math.max(100, subtotal * 0.03)) dudosos.push('lineas');
  const lineasDoc: LineaFactura[] = items.length
    ? items.map((it, k) => {
        const pct = it.porcentajeIva ?? (iva5 && !iva19 ? 5 : iva ? 19 : 0);
        return {
          id: 'lin-' + (k + 1), codigo: it.codigo || '', descripcion: it.descripcion, cantidad: it.cantidad, unidad: 'UND',
          valorUnitario: Math.round(it.valorUnitario), descuento: 0, porcentajeIva: pct,
          valorIva: s((it.total * pct) / 100), totalLinea: s(it.total * (1 + pct / 100)),
        };
      })
    : subtotal
    ? [{
        id: 'lin-1', codigo: '', descripcion: `Según factura ${prefijo}${folio}`.trim(), cantidad: 1, unidad: 'UND',
        valorUnitario: Math.round(subtotal - descuentos), descuento: 0,
        porcentajeIva: iva5 && !iva19 ? 5 : iva ? 19 : 0, valorIva: s(iva), totalLinea: s(subtotal - descuentos + iva),
        resumen: true,
      }]
    : [];

  const datos: Partial<CompraDocumento> = {
    tipoDocumento: tipoDocumento as CompraDocumento['tipoDocumento'],
    origen: electronico ? 'electronica' : 'manual',
    prefijo,
    folio,
    cufe: qr?.cufe || texto.cufe || '',
    fechaEmision,
    fechaVencimiento,
    formaPago,
    medioPago: formaPago === 'credito' ? 'credito_proveedor' : 'transferencia',
    proveedor: {
      nit,
      dv: conocido?.dv || texto.dvEmisor || '',
      razonSocial: razonSocial || 'Proveedor no identificado',
      direccion: conocido?.direccion || '',
      ciudad: conocido?.ciudad || '',
      telefono: conocido?.telefono || '',
      email: conocido?.email || '',
    },
    moneda: 'COP',
    subtotal: s(subtotal),
    descuentos: s(descuentos),
    baseIva0: s(baseIva0),
    baseIva5: s(baseIva5),
    baseIva19: s(baseIva19),
    iva5: s(iva5),
    iva19: s(iva19),
    totalIva: s(iva),
    impoconsumo: s(impoconsumo),
    reteFuente: s(reteFuente),
    reteIva: s(reteIva),
    reteIca: s(reteIca),
    totalRetenciones: s(totalRetenciones),
    total: s(total),
    saldoPendiente: formaPago === 'contado' || esNota ? 0 : Math.max(0, total - totalRetenciones),
    estadoPago: formaPago === 'contado' || esNota ? 'pagada' : 'pendiente',
    fechaPago: formaPago === 'contado' || esNota ? fechaEmision : undefined,
    categoriaId: conocido?.categoriaPredeterminadaId || '',
    centroCostoId: '',
    lineas: lineasDoc,
    observaciones: [
      tipoTexto === 'cotizacion' ? 'Documento leído como COTIZACIÓN: confirme que corresponde a una compra real.' : '',
      qr ? '' : 'Datos leídos del documento sin código QR de la DIAN: verifique los valores.',
    ].filter(Boolean).join(' '),
    archivoAdjunto: {
      nombre,
      tipo: esPdf ? 'pdf' : 'imagen',
      tamano: archivo.size,
      dataUrl: await fileToDataUrl(archivo),
    },
    metadatosExtraccion: {
      motor: 'pdf_local',
      confianzaBaja: dudosos.length > 0 || !qr || usoOcr,
      camposDudosos: dudosos,
      advertencias: [
        ...(qr ? [] : ['No se encontró el código QR de la DIAN; los datos salen del texto del documento.']),
        ...(usoOcr ? ['Documento escaneado o foto: el texto se reconoció de la imagen; revise cada valor.'] : []),
      ],
    },
  };

  return { datos, suficiente: !!total && (!!nit || !!folio), qr, texto };
}
