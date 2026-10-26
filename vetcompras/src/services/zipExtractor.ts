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
      const baseName = xmlItem.nombre.replace(/\.[^/.]+$/, '').toLowerCase();
      const pdfCorrespondiente =
        pdfFiles.find((p) => p.nombre.toLowerCase().includes(baseName)) || pdfFiles[0];

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
      console.warn(`Error al procesar XML ${xmlItem.nombre} dentro del ZIP:`, err);
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
