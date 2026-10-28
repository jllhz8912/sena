import * as XLSX from 'xlsx';
import { descargarBlob } from './reciboPdf';

/**
 * Descarga un libro de Excel por el mismo camino que los recibos PDF: en la
 * demostración publicada usa el permiso de descarga de la página (allí el método
 * habitual del navegador está bloqueado) y en el PC descarga normalmente.
 */
export function guardarExcel(libro: XLSX.WorkBook, nombre: string): void {
  const datos = XLSX.write(libro, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([datos], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  void descargarBlob(blob, nombre);
}
