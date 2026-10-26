/**
 * Descompresión y procesamiento de archivos ZIP de la DIAN en el navegador
 */

import JSZip from 'jszip';
import { procesarFacturaXml } from './xmlParser';
import { CompraDocumento } from '../types';

export interface ArchivoEnZip {
  nombre: string;
  tipo: 'xml' | 'pdf' | 'otro';
  contenidoTexto?: string;
  blob?: Blob;
  dataUrl?: string;
}

/**
 * Descomprime un archivo ZIP en el navegador y analiza sus contenidos
 */
export async function procesarArchivoZip(zipFile: File): Promise<Partial<CompraDocumento>[]> {
  const zip = new JSZip();
  const zipContent = await zip.loadAsync(zipFile);
  const archivosExtraidos: ArchivoEnZip[] = [];

  const promesas: Promise<void>[] = [];

  zipContent.forEach((relativePath, fileEntry) => {
    if (fileEntry.dir) return;

    const lowerPath = relativePath.toLowerCase();

    if (lowerPath.endsWith('.xml')) {
      const p = fileEntry.async('string').then((texto) => {
        archivosExtraidos.push({
          nombre: relativePath,
          tipo: 'xml',
          contenidoTexto: texto,
        });
      });
      promesas.push(p);
    } else if (lowerPath.endsWith('.pdf')) {
      const p = fileEntry.async('blob').then(async (blob) => {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        archivosExtraidos.push({
          nombre: relativePath,
          tipo: 'pdf',
          blob,
          dataUrl,
        });
      });
      promesas.push(p);
    }
  });

  await Promise.all(promesas);

  const xmlFiles = archivosExtraidos.filter((f) => f.tipo === 'xml');
  const pdfFiles = archivosExtraidos.filter((f) => f.tipo === 'pdf');

  const resultados: Partial<CompraDocumento>[] = [];

  // Procesar cada XML y asociarle el PDF que le corresponda si existe
  for (const xmlItem of xmlFiles) {
    if (!xmlItem.contenidoTexto) continue;

    try {
      const doc = procesarFacturaXml(xmlItem.contenidoTexto, xmlItem.nombre);

      // Buscar si hay un PDF que comparta nombre similar
      // Asociar el PDF con el mismo nombre base; si el ZIP trae una sola factura, su único PDF.
      const nombreBase = (n: string) => n.split('/').pop()!.replace(/\.[^/.]+$/, '').toLowerCase();
      const baseName = nombreBase(xmlItem.nombre);
      const pdfCorrespondiente =
        pdfFiles.find((p) => nombreBase(p.nombre) === baseName) ||
        (xmlFiles.length === 1 && pdfFiles.length === 1 ? pdfFiles[0] : undefined);

      if (pdfCorrespondiente && pdfCorrespondiente.dataUrl) {
        doc.archivoAdjunto = {
          nombre: pdfCorrespondiente.nombre,
          tipo: 'pdf',
          tamano: pdfCorrespondiente.blob?.size || 0,
          dataUrl: pdfCorrespondiente.dataUrl,
          contenidoXml: xmlItem.contenidoTexto,
        };
      } else {
        doc.archivoAdjunto = {
          nombre: xmlItem.nombre,
          tipo: 'xml',
          tamano: xmlItem.contenidoTexto.length,
          contenidoXml: xmlItem.contenidoTexto,
        };
      }

      resultados.push(doc);
    } catch (err) {
      // Respuestas de la DIAN (ApplicationResponse) u otros XML que no son facturas se ignoran
      console.warn(`XML ${xmlItem.nombre} dentro del ZIP no es una factura procesable:`, err);
    }
  }

  // Si no había ningún XML pero sí un PDF, devolvemos un objeto para ser analizado por PDF
  if (resultados.length === 0 && pdfFiles.length > 0) {
    for (const pdfItem of pdfFiles) {
      if (pdfItem.blob && pdfItem.dataUrl) {
        resultados.push({
          archivoAdjunto: {
            nombre: pdfItem.nombre,
            tipo: 'pdf',
            tamano: pdfItem.blob.size,
            dataUrl: pdfItem.dataUrl,
          },
        });
      }
    }
  }

  return resultados;
}
