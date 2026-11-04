/**
 * Plantilla de productos de UNA compra: se descarga, se diligencia (un producto
 * por fila) y se sube en el registro de la compra para llenar sus líneas. Las
 * líneas entran al inventario al guardar la compra.
 */
import * as XLSX from 'xlsx';
import { LineaFactura } from '../types';
import { guardarExcel } from './descargaExcel';

export const COLUMNAS_PLANTILLA_COMPRA = [
  'Producto',
  'Código',
  'Cantidad',
  'Unidad',
  'Costo unitario sin IVA',
  'Tarifa IVA (%)',
  'Precio venta sugerido',
];

export function descargarPlantillaProductosCompra(): void {
  const ejemplo = [
    COLUMNAS_PLANTILLA_COMPRA,
    ['Nexgard 10-25 kg', '7702001', 6, 'UND', 38000, 19, 59900],
    ['Dog Chow adulto 22 kg', '', 2, 'BULTO', 165000, 5, 210000],
    ['Jeringa 3 ml caja x 100', 'JER-3', 1, 'CAJA', 28000, 0, ''],
  ];
  const hoja = XLSX.utils.aoa_to_sheet(ejemplo);
  hoja['!cols'] = [{ wch: 34 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 22 }, { wch: 14 }, { wch: 22 }];
  const ayuda = XLSX.utils.aoa_to_sheet([
    ['Cómo diligenciar'],
    ['1. Una fila por producto de la factura. Borre las filas de ejemplo.'],
    ['2. Obligatorios: Producto, Cantidad y Costo unitario sin IVA.'],
    ['3. Tarifa IVA: 0, 5 o 19. Si se deja vacía se toma 19.'],
    ['4. Precio venta sugerido (opcional): queda como precio del producto si aún no tiene uno.'],
    ['5. Guarde el archivo y súbalo en el registro de la compra con "Cargar archivo".'],
  ]);
  ayuda['!cols'] = [{ wch: 90 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Productos');
  XLSX.utils.book_append_sheet(libro, ayuda, 'Instrucciones');
  guardarExcel(libro, 'Plantilla_Productos_Compra_SistemaControl.xlsx');
}

const clave = (t: string) =>
  String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Número escrito como 38000, "38.000", "$ 38.000,50" o 38000.5 */
export function leerNumero(v: unknown): number {
  if (typeof v === 'number') return v;
  let t = String(v ?? '').replace(/[^\d.,-]/g, '');
  if (!t) return 0;
  if (t.includes(',') && t.includes('.')) t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (t.includes(',')) t = /,\d{1,2}$/.test(t) ? t.replace(',', '.') : t.replace(/,/g, '');
  else if (/\.\d{3}(\.|$)/.test(t)) t = t.replace(/\./g, '');
  return Number(t) || 0;
}

const BUSCAR: Record<string, string[]> = {
  producto: ['producto', 'descripcion', 'nombre', 'articulo', 'item'],
  codigo: ['codigo', 'referencia', 'ref', 'sku'],
  cantidad: ['cantidad', 'cant', 'unidades'],
  unidad: ['unidad', 'und', 'presentacion'],
  costo: ['costo unitario sin iva', 'costo unitario', 'valor unitario', 'costo', 'precio compra', 'precio unitario'],
  iva: ['tarifa iva', 'iva', 'porcentaje iva'],
  venta: ['precio venta sugerido', 'precio venta', 'precio de venta', 'pvp'],
};

/** Convierte las filas de la hoja en líneas de la compra, con los errores por fila. */
export function filasAProductos(filas: Record<string, unknown>[]): { lineas: LineaFactura[]; errores: string[] } {
  const lineas: LineaFactura[] = [];
  const errores: string[] = [];
  filas.forEach((fila, i) => {
    const campos = new Map(Object.entries(fila).map(([k, v]) => [clave(k), v]));
    const valor = (c: string) => {
      for (const nombre of BUSCAR[c]) {
        for (const [k, v] of campos) if (k === nombre || k.startsWith(nombre)) return v;
      }
      return undefined;
    };
    const descripcion = String(valor('producto') ?? '').trim();
    const cantidad = leerNumero(valor('cantidad'));
    const costo = leerNumero(valor('costo'));
    if (!descripcion && !cantidad && !costo) return; // fila vacía
    const n = i + 2; // fila de Excel (la 1 es el encabezado)
    if (!descripcion) return errores.push(`Fila ${n}: falta el nombre del producto.`);
    if (!(cantidad > 0)) return errores.push(`Fila ${n} (${descripcion}): la cantidad debe ser mayor a cero.`);
    if (!(costo > 0)) return errores.push(`Fila ${n} (${descripcion}): falta el costo unitario sin IVA.`);
    const ivaTexto = valor('iva');
    let iva = ivaTexto === undefined || ivaTexto === '' ? 19 : leerNumero(ivaTexto);
    if (iva > 0 && iva < 1) iva = Math.round(iva * 100); // 0,19 → 19
    if (![0, 5, 19].includes(iva)) errores.push(`Fila ${n} (${descripcion}): tarifa de IVA ${iva} % poco común; revísela.`);
    const base = Math.round(cantidad * costo);
    const valorIva = Math.round((base * iva) / 100);
    const venta = leerNumero(valor('venta'));
    lineas.push({
      id: `lin-${Date.now().toString(36)}-${i}`,
      codigo: String(valor('codigo') ?? '').trim() || undefined,
      descripcion,
      cantidad,
      unidad: String(valor('unidad') ?? '').trim() || 'UND',
      valorUnitario: costo,
      descuento: 0,
      porcentajeIva: iva,
      valorIva,
      totalLinea: base + valorIva,
      precioVentaSugerido: venta > 0 ? venta : undefined,
    });
  });
  return { lineas, errores };
}

/** Lee la plantilla diligenciada (Excel o CSV). */
export async function leerProductosCompra(archivo: File): Promise<{ lineas: LineaFactura[]; errores: string[] }> {
  const libro = XLSX.read(await archivo.arrayBuffer(), { type: 'array' });
  const hoja = libro.Sheets['Productos'] || libro.Sheets[libro.SheetNames[0]];
  if (!hoja) return { lineas: [], errores: ['El archivo no tiene hojas.'] };
  return filasAProductos(XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: '' }));
}
