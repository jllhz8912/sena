/**
 * Convierte un PDF en imágenes para la vista previa. No depende del visor de PDF
 * del navegador, que no existe en Chrome para Android y que se bloquea dentro de
 * páginas incrustadas (como la demostración en línea).
 *
 * pdf.js corre en el mismo hilo (sin Worker aparte): así funciona con la política
 * de seguridad del servidor local y en la demostración de un solo archivo.
 */
let cargador: Promise<typeof import('pdfjs-dist')> | null = null;

function pdfjs() {
  cargador ??= (async () => {
    const trabajador = await import('pdfjs-dist/build/pdf.worker.mjs');
    (globalThis as any).pdfjsWorker = trabajador;
    return import('pdfjs-dist');
  })();
  return cargador;
}

/** Devuelve una imagen PNG (data URL) por página. */
export async function pdfAImagenes(pdf: Blob, ancho = 1100): Promise<string[]> {
  const { getDocument } = await pdfjs();
  const documento = await getDocument({ data: new Uint8Array(await pdf.arrayBuffer()) }).promise;
  try {
    const imagenes: string[] = [];
    for (let n = 1; n <= documento.numPages; n++) {
      const pagina = await documento.getPage(n);
      const base = pagina.getViewport({ scale: 1 });
      const viewport = pagina.getViewport({ scale: ancho / base.width });
      const lienzo = document.createElement('canvas');
      lienzo.width = Math.ceil(viewport.width);
      lienzo.height = Math.ceil(viewport.height);
      await pagina.render({ canvas: lienzo, canvasContext: lienzo.getContext('2d')!, viewport }).promise;
      imagenes.push(lienzo.toDataURL('image/png'));
    }
    return imagenes;
  } finally {
    await documento.destroy();
  }
}
