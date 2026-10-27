/**
 * Servicio de exportación a Excel (.xlsx) con SheetJS (xlsx)
 * Genera archivos con números reales, fórmulas SUM, formato de moneda COP,
 * filtros activados y columnas autoajustadas.
 */

import * as XLSX from 'xlsx';
import { itemsDeVenta, pagosDeVenta, saldoDeVenta } from '../utils/ventas';
import { CompraDocumento, Proveedor, Categoria, CentroCosto, Venta } from '../types';
import {
  getTipoDocumentoLabel,
  getMedioPagoInfo,
  getCategoriaVentaInfo,
  getMedioPagoVentaInfo,
  getSubcategoriaVentaInfo,
} from '../utils/formatters';

/**
 * Calcula el ancho óptimo de las columnas según su contenido
 */
function autoAjustarColumnas(dataRows: any[][]): XLSX.ColInfo[] {
  const colWidths: number[] = [];

  for (const row of dataRows) {
    row.forEach((cell, colIndex) => {
      const cellLength = cell !== null && cell !== undefined ? String(cell).length : 0;
      colWidths[colIndex] = Math.max(colWidths[colIndex] || 8, Math.min(cellLength + 3, 50));
    });
  }

  return colWidths.map((w) => ({ wch: w }));
}

/**
 * Exporta el listado principal de compras y gastos a Excel
 */
export function exportarDocumentosAExcel(
  documentos: CompraDocumento[],
  categorias: Categoria[],
  centrosCosto: CentroCosto[],
  nombreArchivo = 'VetCompras_Listado.xlsx'
): void {
  const catMap = new Map(categorias.map((c) => [c.id, c.nombre]));
  const ccMap = new Map(centrosCosto.map((c) => [c.id, c.nombre]));

  const headers = [
    'Fecha Emisión',
    'Tipo Documento',
    'Folio / Factura',
    'NIT Proveedor',
    'Razón Social Proveedor',
    'Categoría',
    'Centro de Costo',
    'Forma Pago',
    'Medio de Pago',
    'Tipo de Medio',
    'Estado Pago',
    'Fecha Vencimiento',
    'Subtotal (COP)',
    'Descuentos (COP)',
    'Base 0% (COP)',
    'Base 5% (COP)',
    'Base 19% (COP)',
    'IVA 5% (COP)',
    'IVA 19% (COP)',
    'Total IVA (COP)',
    'Impoconsumo (COP)',
    'ReteFuente (COP)',
    'ReteIVA (COP)',
    'ReteICA (COP)',
    'Total Retenciones (COP)',
    'Total a Pagar (COP)',
    'Saldo Pendiente (COP)',
    'CUFE',
    'Observaciones',
  ];

  const rows: any[][] = [headers];

  documentos.forEach((doc) => {
    const medioInfo = getMedioPagoInfo(doc.medioPago);
    rows.push([
      doc.fechaEmision,
      getTipoDocumentoLabel(doc.tipoDocumento),
      doc.prefijo ? `${doc.prefijo}-${doc.folio}` : doc.folio,
      doc.proveedor?.nit || '',
      doc.proveedor?.razonSocial || '',
      catMap.get(doc.categoriaId) || 'Sin categoría',
      ccMap.get(doc.centroCostoId) || 'General',
      doc.formaPago.toUpperCase(),
      medioInfo.label,
      medioInfo.tipo === 'efectivo'
        ? 'Efectivo'
        : medioInfo.tipo === 'credito'
        ? 'Crédito'
        : 'Electrónico',
      doc.estadoPago.toUpperCase(),
      doc.fechaVencimiento || '',
      doc.subtotal,
      doc.descuentos,
      doc.baseIva0,
      doc.baseIva5,
      doc.baseIva19,
      doc.iva5,
      doc.iva19,
      doc.totalIva,
      doc.impoconsumo,
      doc.reteFuente,
      doc.reteIva,
      doc.reteIca,
      doc.totalRetenciones,
      doc.total,
      doc.saldoPendiente,
      doc.cufe || '',
      doc.observaciones || '',
    ]);
  });

  // Agregar fila de totales con fórmulas de suma
  const totalRowIndex = rows.length + 1;
  const startRow = 2;
  const endRow = rows.length;

  const totalRow: any[] = [
    'TOTALES',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    { f: `SUM(M${startRow}:M${endRow})` }, // Subtotal
    { f: `SUM(N${startRow}:N${endRow})` }, // Descuentos
    { f: `SUM(O${startRow}:O${endRow})` }, // Base 0
    { f: `SUM(P${startRow}:P${endRow})` }, // Base 5
    { f: `SUM(Q${startRow}:Q${endRow})` }, // Base 19
    { f: `SUM(R${startRow}:R${endRow})` }, // IVA 5
    { f: `SUM(S${startRow}:S${endRow})` }, // IVA 19
    { f: `SUM(T${startRow}:T${endRow})` }, // Total IVA
    { f: `SUM(U${startRow}:U${endRow})` }, // Impoconsumo
    { f: `SUM(V${startRow}:V${endRow})` }, // ReteFuente
    { f: `SUM(W${startRow}:W${endRow})` }, // ReteIVA
    { f: `SUM(X${startRow}:X${endRow})` }, // ReteICA
    { f: `SUM(Y${startRow}:Y${endRow})` }, // Total Ret
    { f: `SUM(Z${startRow}:Z${endRow})` }, // Total Pagar
    { f: `SUM(AA${startRow}:AA${endRow})` }, // Saldo Pendiente
    '',
    '',
  ];

  rows.push(totalRow);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Formato numérico en COP para columnas monetarias (M a AA)
  const currencyCols = ['M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA'];
  for (let r = startRow; r <= totalRowIndex; r++) {
    currencyCols.forEach((col) => {
      const cellRef = `${col}${r}`;
      if (ws[cellRef]) {
        ws[cellRef].z = '"$"#,##0';
      }
    });
  }

  // Activar filtros automáticos para el rango de datos
  ws['!autofilter'] = {
    ref: `A1:AC${endRow}`,
  };

  ws['!cols'] = autoAjustarColumnas(rows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Compras y Gastos');
  XLSX.writeFile(wb, nombreArchivo);
}

/**
 * Exporta el reporte de IVA descontable (Formulario 300 DIAN)
 */
export function exportarReporteIvaExcel(
  resumenIva: {
    base0: number;
    base5: number;
    iva5: number;
    base19: number;
    iva19: number;
    totalBaseGravable: number;
    totalIvaDescontable: number;
    periodoTexto: string;
  },
  documentos: CompraDocumento[],
  nombreArchivo = 'VetCompras_Reporte_IVA_DIAN.xlsx'
): void {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Resumen Formulario 300
  const resumenRows = [
    ['VETCOMPRAS - REPORTE DE IVA DESCONTABLE PARA FORMULARIO 300 DIAN'],
    [`Período: ${resumenIva.periodoTexto}`],
    [`Generado: ${new Date().toLocaleDateString('es-CO')}`],
    [],
    ['Tarifa / Concepto', 'Base Gravable (COP)', 'IVA Descontable (COP)', 'Casilla Sugerida DIAN'],
    ['Compras y servicios gravados al 19%', resumenIva.base19, resumenIva.iva19, 'Casilla 71 / 72'],
    ['Compras y servicios gravados al 5%', resumenIva.base5, resumenIva.iva5, 'Casilla 73 / 74'],
    ['Compras y servicios gravados al 0% / Exentos', resumenIva.base0, 0, 'Casilla 75'],
    ['TOTALES', resumenIva.totalBaseGravable, resumenIva.totalIvaDescontable, 'Total IVA Descontable'],
  ];

  const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows);

  ['B6', 'C6', 'B7', 'C7', 'B8', 'C8', 'B9', 'C9'].forEach((cellRef) => {
    if (wsResumen[cellRef]) wsResumen[cellRef].z = '"$"#,##0';
  });

  wsResumen['!cols'] = [{ wch: 40 }, { wch: 22 }, { wch: 22 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Formulario 300');

  // Hoja 2: Detalle de facturas del período
  const detalleHeaders = [
    'Fecha',
    'Factura',
    'NIT Proveedor',
    'Razón Social',
    'Base 0%',
    'Base 5%',
    'IVA 5%',
    'Base 19%',
    'IVA 19%',
    'Total IVA',
    'Total Factura',
  ];

  const detalleRows: any[][] = [detalleHeaders];
  documentos.forEach((d) => {
    detalleRows.push([
      d.fechaEmision,
      d.folio,
      d.proveedor?.nit || '',
      d.proveedor?.razonSocial || '',
      d.baseIva0,
      d.baseIva5,
      d.iva5,
      d.baseIva19,
      d.iva19,
      d.totalIva,
      d.total,
    ]);
  });

  const wsDetalle = XLSX.utils.aoa_to_sheet(detalleRows);
  const endRow = detalleRows.length;
  wsDetalle['!autofilter'] = { ref: `A1:K${endRow}` };
  wsDetalle['!cols'] = autoAjustarColumnas(detalleRows);

  // Formato COP en detalle
  for (let r = 2; r <= endRow; r++) {
    ['E', 'F', 'G', 'H', 'I', 'J', 'K'].forEach((col) => {
      const ref = `${col}${r}`;
      if (wsDetalle[ref]) wsDetalle[ref].z = '"$"#,##0';
    });
  }

  XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle Facturas');
  XLSX.writeFile(wb, nombreArchivo);
}

/**
 * Exporta el reporte de retenciones en la fuente practicadas (Formulario 350 DIAN)
 */
export function exportarReporteRetencionesExcel(
  tercerosRetenciones: Array<{
    nit: string;
    razonSocial: string;
    totalBase: number;
    reteFuente: number;
    reteIva: number;
    reteIca: number;
    totalRetenido: number;
    cantidadDocumentos: number;
  }>,
  periodoTexto: string,
  nombreArchivo = 'VetCompras_Reporte_Retenciones_DIAN.xlsx'
): void {
  const headers = [
    'NIT Tercero',
    'Razón Social / Nombre',
    'Base Gravable Acumulada (COP)',
    'ReteFuente Practicada (COP)',
    'ReteIVA Practicado (COP)',
    'ReteICA Practicado (COP)',
    'Total Retenciones (COP)',
    'N° Facturas / Cuentas',
  ];

  const rows: any[][] = [
    ['VETCOMPRAS - REPORTE DE RETENCIONES EN LA FUENTE (FORMULARIO 350 / EXÓGENA)'],
    [`Período: ${periodoTexto}`],
    [],
    headers,
  ];

  tercerosRetenciones.forEach((t) => {
    rows.push([
      t.nit,
      t.razonSocial,
      t.totalBase,
      t.reteFuente,
      t.reteIva,
      t.reteIca,
      t.totalRetenido,
      t.cantidadDocumentos,
    ]);
  });

  const startRow = 5;
  const endRow = rows.length;

  // Fila de totales
  rows.push([
    'TOTALES',
    '',
    { f: `SUM(C${startRow}:C${endRow})` },
    { f: `SUM(D${startRow}:D${endRow})` },
    { f: `SUM(E${startRow}:E${endRow})` },
    { f: `SUM(F${startRow}:F${endRow})` },
    { f: `SUM(G${startRow}:G${endRow})` },
    { f: `SUM(H${startRow}:H${endRow})` },
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  const totalRowIdx = rows.length;
  for (let r = startRow; r <= totalRowIdx; r++) {
    ['C', 'D', 'E', 'F', 'G'].forEach((col) => {
      const ref = `${col}${r}`;
      if (ws[ref]) ws[ref].z = '"$"#,##0';
    });
  }

  ws['!autofilter'] = { ref: `A4:H${endRow}` };
  ws['!cols'] = autoAjustarColumnas(rows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Retenciones DIAN 350');
  XLSX.writeFile(wb, nombreArchivo);
}

/**
 * Exporta el reporte de medios de pago (Efectivo vs Electrónico vs Crédito)
 */
export function exportarReporteMediosPagoExcel(
  resumenMedios: Array<{
    medioPago: string;
    tipoMedio: string;
    cantidad: number;
    subtotal: number;
    totalIva: number;
    totalRetenciones: number;
    total: number;
    porcentaje: number;
  }>,
  documentos: CompraDocumento[],
  periodoTexto: string,
  nombreArchivo = 'VetCompras_Reporte_Medios_Pago.xlsx'
): void {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Resumen por Medio de Pago
  const resumenRows: any[][] = [
    ['VETCOMPRAS - CONSOLIDADO DE PAGOS: EFECTIVO VS ELECTRÓNICO'],
    [`Período: ${periodoTexto}`],
    [`Generado: ${new Date().toLocaleDateString('es-CO')}`],
    [],
    [
      'Medio de Pago',
      'Tipo (Electrónico / Efectivo)',
      'N° Facturas',
      'Subtotal (COP)',
      'IVA (COP)',
      'Retenciones (COP)',
      'Total Pagado (COP)',
      '% Participación',
    ],
  ];

  const startRow = 6;
  resumenMedios.forEach((m) => {
    resumenRows.push([
      m.medioPago,
      m.tipoMedio,
      m.cantidad,
      m.subtotal,
      m.totalIva,
      m.totalRetenciones,
      m.total,
      m.porcentaje / 100,
    ]);
  });

  const endRow = resumenRows.length;
  resumenRows.push([
    'TOTALES',
    '',
    { f: `SUM(C${startRow}:C${endRow})` },
    { f: `SUM(D${startRow}:D${endRow})` },
    { f: `SUM(E${startRow}:E${endRow})` },
    { f: `SUM(F${startRow}:F${endRow})` },
    { f: `SUM(G${startRow}:G${endRow})` },
    { f: `SUM(H${startRow}:H${endRow})` },
  ]);

  const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows);
  for (let r = startRow; r <= endRow + 1; r++) {
    ['D', 'E', 'F', 'G'].forEach((col) => {
      const ref = `${col}${r}`;
      if (wsResumen[ref]) wsResumen[ref].z = '"$"#,##0';
    });
    const refPct = `H${r}`;
    if (wsResumen[refPct]) wsResumen[refPct].z = '0.0%';
  }

  wsResumen['!autofilter'] = { ref: `A5:H${endRow}` };
  wsResumen['!cols'] = autoAjustarColumnas(resumenRows);
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Medios de Pago');

  // Hoja 2: Detalle de Facturas
  const detalleRows: any[][] = [
    [
      'Fecha Emisión',
      'Tipo Documento',
      'Factura',
      'NIT Proveedor',
      'Razón Social Proveedor',
      'Medio de Pago',
      'Tipo (Electrónico/Efectivo)',
      'Subtotal (COP)',
      'IVA (COP)',
      'Total (COP)',
    ],
  ];

  documentos.forEach((d) => {
    const medioInfo = getMedioPagoInfo(d.medioPago);
    const tipo =
      medioInfo.tipo === 'efectivo'
        ? 'Efectivo'
        : medioInfo.tipo === 'credito'
        ? 'Crédito'
        : 'Electrónico';

    detalleRows.push([
      d.fechaEmision,
      getTipoDocumentoLabel(d.tipoDocumento),
      d.prefijo ? `${d.prefijo}-${d.folio}` : d.folio,
      d.proveedor?.nit || '',
      d.proveedor?.razonSocial || '',
      medioInfo.label,
      tipo,
      d.subtotal,
      d.totalIva,
      d.total,
    ]);
  });

  const wsDetalle = XLSX.utils.aoa_to_sheet(detalleRows);
  for (let r = 2; r <= detalleRows.length; r++) {
    ['H', 'I', 'J'].forEach((col) => {
      const ref = `${col}${r}`;
      if (wsDetalle[ref]) wsDetalle[ref].z = '"$"#,##0';
    });
  }

  wsDetalle['!autofilter'] = { ref: `A1:J${detalleRows.length}` };
  wsDetalle['!cols'] = autoAjustarColumnas(detalleRows);
  XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle por Factura');

  XLSX.writeFile(wb, nombreArchivo);
}

/**
 * Exporta el reporte de productos e historial de costo unitario
 */
export function exportarReporteProductosExcel(
  items: Array<{
    codigo?: string;
    descripcion: string;
    proveedor: string;
    nit: string;
    fecha: string;
    factura: string;
    cantidad: number;
    unidad: string;
    valorUnitario: number;
    descuento: number;
    porcentajeIva: number;
    totalLinea: number;
  }>,
  nombreArchivo = 'VetCompras_Historico_Costos_Productos.xlsx'
): void {
  const headers = [
    'Código',
    'Descripción del Producto / Insumo',
    'Proveedor',
    'NIT Proveedor',
    'Última Fecha',
    'Factura',
    'Cantidad',
    'Unidad',
    'Costo Unitario (COP)',
    'Descuento (COP)',
    '% IVA',
    'Total Línea (COP)',
  ];

  const rows: any[][] = [headers];

  items.forEach((item) => {
    rows.push([
      item.codigo || '',
      item.descripcion,
      item.proveedor,
      item.nit,
      item.fecha,
      item.factura,
      item.cantidad,
      item.unidad,
      item.valorUnitario,
      item.descuento,
      item.porcentajeIva,
      item.totalLinea,
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const endRow = rows.length;

  for (let r = 2; r <= endRow; r++) {
    ['I', 'J', 'L'].forEach((col) => {
      const ref = `${col}${r}`;
      if (ws[ref]) ws[ref].z = '"$"#,##0';
    });
    const refPercent = `K${r}`;
    if (ws[refPercent]) ws[refPercent].z = '0"%"';
  }

  ws['!autofilter'] = { ref: `A1:L${endRow}` };
  ws['!cols'] = autoAjustarColumnas(rows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Histórico de Productos');
  XLSX.writeFile(wb, nombreArchivo);
}

/**
 * Exporta la base completa de la veterinaria con hojas separadas:
 * Hoja 1: Documentos
 * Hoja 2: Detalle de líneas
 * Hoja 3: Proveedores
 */
export function exportarTodaLaBaseAExcel(
  documentos: CompraDocumento[],
  proveedores: Proveedor[],
  categorias: Categoria[],
  centrosCosto: CentroCosto[],
  nombreArchivo = 'VetCompras_Base_Completa.xlsx'
): void {
  const wb = XLSX.utils.book_new();
  const catMap = new Map(categorias.map((c) => [c.id, c.nombre]));
  const ccMap = new Map(centrosCosto.map((c) => [c.id, c.nombre]));

  // 1. Hoja Documentos
  const docHeaders = [
    'ID Documento',
    'Fecha Emisión',
    'Tipo Documento',
    'Prefijo',
    'Folio',
    'CUFE',
    'NIT Proveedor',
    'Razón Social Proveedor',
    'Categoría',
    'Centro de Costo',
    'Forma Pago',
    'Medio de Pago',
    'Tipo de Medio',
    'Estado Pago',
    'Fecha Vencimiento',
    'Subtotal',
    'Descuentos',
    'Total IVA',
    'Impoconsumo',
    'Total Retenciones',
    'Total',
    'Saldo Pendiente',
    'Observaciones',
  ];

  const docRows: any[][] = [docHeaders];
  documentos.forEach((d) => {
    const medioInfo = getMedioPagoInfo(d.medioPago);
    const tipoMedioTexto =
      medioInfo.tipo === 'efectivo'
        ? 'Efectivo'
        : medioInfo.tipo === 'credito'
        ? 'Crédito'
        : 'Electrónico';

    docRows.push([
      d.id,
      d.fechaEmision,
      getTipoDocumentoLabel(d.tipoDocumento),
      d.prefijo,
      d.folio,
      d.cufe || '',
      d.proveedor?.nit || '',
      d.proveedor?.razonSocial || '',
      catMap.get(d.categoriaId) || '',
      ccMap.get(d.centroCostoId) || '',
      d.formaPago,
      medioInfo.label,
      tipoMedioTexto,
      d.estadoPago,
      d.fechaVencimiento || '',
      d.subtotal,
      d.descuentos,
      d.totalIva,
      d.impoconsumo,
      d.totalRetenciones,
      d.total,
      d.saldoPendiente,
      d.observaciones || '',
    ]);
  });

  const wsDocs = XLSX.utils.aoa_to_sheet(docRows);
  for (let r = 2; r <= docRows.length; r++) {
    ['P', 'Q', 'R', 'S', 'T', 'U', 'V'].forEach((col) => {
      const ref = `${col}${r}`;
      if (wsDocs[ref]) wsDocs[ref].z = '"$"#,##0';
    });
  }
  wsDocs['!autofilter'] = { ref: `A1:W${docRows.length}` };
  wsDocs['!cols'] = autoAjustarColumnas(docRows);
  XLSX.utils.book_append_sheet(wb, wsDocs, 'Documentos');

  // 2. Hoja Detalle de Líneas
  const lineaHeaders = [
    'ID Documento',
    'Fecha Emisión',
    'Factura',
    'NIT Proveedor',
    'Razón Social',
    'Código Ítem',
    'Descripción del Producto / Insumo',
    'Cantidad',
    'Unidad',
    'Valor Unitario',
    'Descuento Línea',
    '% IVA',
    'Valor IVA Línea',
    'Total Línea',
  ];

  const lineaRows: any[][] = [lineaHeaders];
  documentos.forEach((d) => {
    (d.lineas || []).forEach((l) => {
      lineaRows.push([
        d.id,
        d.fechaEmision,
        d.folio,
        d.proveedor?.nit || '',
        d.proveedor?.razonSocial || '',
        l.codigo || '',
        l.descripcion,
        l.cantidad,
        l.unidad,
        l.valorUnitario,
        l.descuento,
        l.porcentajeIva,
        l.valorIva,
        l.totalLinea,
      ]);
    });
  });

  const wsLineas = XLSX.utils.aoa_to_sheet(lineaRows);
  for (let r = 2; r <= lineaRows.length; r++) {
    ['J', 'K', 'M', 'N'].forEach((col) => {
      const ref = `${col}${r}`;
      if (wsLineas[ref]) wsLineas[ref].z = '"$"#,##0';
    });
  }
  wsLineas['!autofilter'] = { ref: `A1:N${lineaRows.length}` };
  wsLineas['!cols'] = autoAjustarColumnas(lineaRows);
  XLSX.utils.book_append_sheet(wb, wsLineas, 'Detalle de Líneas');

  // 3. Hoja Proveedores
  const provHeaders = [
    'ID Proveedor',
    'NIT',
    'DV',
    'Razón Social',
    'Nombre Comercial',
    'Teléfono',
    'Correo Electrónico',
    'Dirección',
    'Ciudad',
    'Categoría Habitual',
    'Notas',
  ];

  const provRows: any[][] = [provHeaders];
  proveedores.forEach((p) => {
    provRows.push([
      p.id,
      p.nit,
      p.dv || '',
      p.razonSocial,
      p.nombreComercial || '',
      p.telefono || '',
      p.email || '',
      p.direccion || '',
      p.ciudad || '',
      p.categoriaPredeterminadaId ? catMap.get(p.categoriaPredeterminadaId) || '' : '',
      p.notas || '',
    ]);
  });

  const wsProvs = XLSX.utils.aoa_to_sheet(provRows);
  wsProvs['!autofilter'] = { ref: `A1:K${provRows.length}` };
  wsProvs['!cols'] = autoAjustarColumnas(provRows);
  XLSX.utils.book_append_sheet(wb, wsProvs, 'Proveedores');

  XLSX.writeFile(wb, nombreArchivo);
}

/**
 * ============================================================================
 * IMPORTACIÓN DE FACTURAS DESDE EXCEL
 * ============================================================================
 */

export interface FilaFacturaExcel {
  lineaExcel: number;
  tipoDocumento: string;
  prefijo?: string;
  folio: string;
  cufe?: string;
  fechaEmision: string;
  fechaVencimiento?: string;
  formaPago: 'contado' | 'credito';
  medioPago?: string;
  nitProveedor: string;
  dvProveedor?: string;
  razonSocialProveedor: string;
  telefonoProveedor?: string;
  emailProveedor?: string;
  ciudadProveedor?: string;
  categoriaNombre?: string;
  centroCostoNombre?: string;
  subtotal: number;
  iva: number;
  tarifaIva?: number;
  reteFuente?: number;
  reteIva?: number;
  reteIca?: number;
  total: number;
  estadoPago: 'pagada' | 'pendiente' | 'parcial';
  observaciones?: string;
  esValida: boolean;
  errores: string[];
}

/**
 * Parsea una fecha de Excel (puede ser número serial, objeto Date o string) a formato YYYY-MM-DD
 * Soporta años 2025/2026/etc., formato con 2 dígitos (ej: 15/03/25), nombres de mes y números seriales.
 */
function parsearFechaExcel(val: any): string {
  if (!val) return '2025-01-01';

  // 1. Si es un objeto Date nativo de JS
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // 2. Si es un número serial de Excel (ej: 45678)
  if (typeof val === 'number') {
    const dateObj = XLSX.SSF.parse_date_code(val);
    if (dateObj) {
      const y = dateObj.y;
      const m = String(dateObj.m).padStart(2, '0');
      const d = String(dateObj.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const str = String(val).trim();
  if (!str) return '2025-01-01';

  // 3. Si es un string numérico que representa un serial de Excel (ej: "45678")
  const numSerial = Number(str);
  if (!isNaN(numSerial) && numSerial > 25000 && numSerial < 70000 && !str.includes('-') && !str.includes('/')) {
    const dateObj = XLSX.SSF.parse_date_code(numSerial);
    if (dateObj) {
      const y = dateObj.y;
      const m = String(dateObj.m).padStart(2, '0');
      const d = String(dateObj.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // 4. Formato YYYY-MM-DD o YYYY/MM/DD (ej: 2025-03-15 o 2025/03/15)
  const matchYmd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (matchYmd) {
    const y = matchYmd[1];
    const m = matchYmd[2].padStart(2, '0');
    const d = matchYmd[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 5. Formato DD/MM/YYYY o DD-MM-YYYY (ej: 15/03/2025)
  const partesDmy4 = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (partesDmy4) {
    const d = partesDmy4[1].padStart(2, '0');
    const m = partesDmy4[2].padStart(2, '0');
    const y = partesDmy4[3];
    return `${y}-${m}-${d}`;
  }

  // 6. Formato DD/MM/YY o DD-MM-YY con 2 dígitos en el año (ej: 15/03/25 -> 2025)
  const partesDmy2 = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (partesDmy2) {
    const d = partesDmy2[1].padStart(2, '0');
    const m = partesDmy2[2].padStart(2, '0');
    const rawYear = parseInt(partesDmy2[3], 10);
    const y = rawYear <= 60 ? `20${partesDmy2[3]}` : `19${partesDmy2[3]}`;
    return `${y}-${m}-${d}`;
  }

  // 7. Formatos con nombre o abreviatura de mes (ej: 15-mar-2025, 20/abr/25, etc.)
  const mesesMap: Record<string, string> = {
    ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
    jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12',
    jan: '01', apr: '04', aug: '08', dec: '12',
  };
  const matchTexto = str.toLowerCase().match(/^(\d{1,2})[\/\-\s]+([a-z]{3,4})[\/\-\s]+(\d{2,4})/);
  if (matchTexto) {
    const d = matchTexto[1].padStart(2, '0');
    const mesKey = matchTexto[2].substring(0, 3);
    const m = mesesMap[mesKey] || '01';
    let y = matchTexto[3];
    if (y.length === 2) {
      y = parseInt(y, 10) <= 60 ? `20${y}` : `19${y}`;
    }
    return `${y}-${m}-${d}`;
  }

  // 8. Intentar con Date estándar si trae fecha legible
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return '2025-01-01';
}

/**
 * Normaliza nombres de columnas eliminando acentos, espacios y caracteres especiales
 */
function normalizarClave(key: string): string {
  return key
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Procesa un archivo Excel cargado y extrae la lista de facturas
 */
export async function procesarExcelFacturas(file: File): Promise<{
  filas: FilaFacturaExcel[];
  totalValidas: number;
  totalConError: number;
}> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array', cellDates: false });

  // Usar la primera hoja del libro
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convertir a array de objetos JSON con cabeceras originales
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  const filas: FilaFacturaExcel[] = [];

  rawRows.forEach((row, index) => {
    // Mapear claves normalizadas
    const normalizedRow: Record<string, any> = {};
    Object.keys(row).forEach((k) => {
      normalizedRow[normalizarClave(k)] = row[k];
    });

    const getVal = (...keys: string[]) => {
      for (const k of keys) {
        if (normalizedRow[k] !== undefined && normalizedRow[k] !== '') {
          return normalizedRow[k];
        }
      }
      return '';
    };

    const getNum = (...keys: string[]) => {
      const v = getVal(...keys);
      if (typeof v === 'number') return v;
      const clean = String(v).replace(/[^0-9.-]/g, '');
      const parsed = parseFloat(clean);
      return isNaN(parsed) ? 0 : parsed;
    };

    const errores: string[] = [];

    // Extraer campos simplificados requeridos: fecha, nit, nombre, numero de factura, valor facturado, medio de pago, cufe
    const folioStr = String(
      getVal('numero_de_factura', 'numero_factura', 'factura', 'folio', 'no_factura', 'numero', 'consecutivo', 'documento')
    ).trim();
    const fechaEmisionRaw = getVal('fecha', 'fecha_factura', 'fecha_emision', 'emision', 'date');
    const nitStr = String(
      getVal('nit', 'nit_proveedor', 'cedula', 'identificacion', 'tercero_nit', 'rut')
    ).replace(/[^0-9]/g, '');
    const proveedorStr = String(
      getVal('nombre', 'nombre_proveedor', 'proveedor', 'razon_social', 'tercero')
    ).trim();

    if (!folioStr) errores.push('Falta el número de factura.');
    if (!nitStr) errores.push('Falta el NIT del proveedor.');
    if (!proveedorStr) errores.push('Falta el nombre o razón social del proveedor.');

    const fechaEmision = parsearFechaExcel(fechaEmisionRaw);
    const fechaVencRaw = getVal('vencimiento', 'fecha_vencimiento', 'vence');
    const fechaVencimiento = fechaVencRaw ? parsearFechaExcel(fechaVencRaw) : undefined;

    // Valor facturado (total)
    let total = getNum('valor_facturado', 'valor', 'total', 'total_pagar', 'valor_total', 'total_factura', 'monto');
    let subtotal = getNum('subtotal', 'base', 'base_gravable', 'neto', 'valor_antes_iva');
    let iva = getNum('iva', 'total_iva', 'valor_iva', 'impuesto');

    const reteFuente = getNum('retefuente', 'retencion_fuente', 'rete_renta');
    const reteIva = getNum('reteiva', 'retencion_iva');
    const reteIca = getNum('reteica', 'retencion_ica');
    const totalRetenciones = reteFuente + reteIva + reteIca;

    // Si viene la plantilla simplificada (solo valor facturado)
    if (total > 0 && subtotal === 0 && iva === 0) {
      subtotal = Math.round(total / 1.19);
      iva = total - subtotal;
    } else if (total === 0 && subtotal > 0) {
      total = subtotal + iva - totalRetenciones;
    } else if (subtotal === 0 && total > 0) {
      if (iva > 0) {
        subtotal = total - iva + totalRetenciones;
      } else {
        subtotal = Math.round(total / 1.19);
        iva = total - subtotal;
      }
    }

    if (total <= 0) {
      errores.push('El valor facturado debe ser mayor a cero.');
    }

    // CUFE opcional
    const cufeStr = String(getVal('cufe', 'cude', 'uuid')).trim() || undefined;

    // Medio de pago y forma de pago
    const medioRaw = String(
      getVal('medio_de_pago', 'medio_pago', 'medio', 'forma_pago', 'metodo_pago', 'pago', 'condicion')
    ).trim();
    const medioLower = medioRaw.toLowerCase();

    let formaPago: 'contado' | 'credito' = 'contado';
    let estadoPago: 'pagada' | 'pendiente' | 'parcial' = 'pagada';
    let medioPago = medioRaw || 'Transferencia';

    if (medioLower.includes('cred') || medioLower.includes('plazo') || medioLower.includes('pend')) {
      formaPago = 'credito';
      estadoPago = 'pendiente';
      medioPago = 'Crédito';
    } else if (medioLower.includes('efect') || medioLower.includes('cash')) {
      medioPago = 'Efectivo';
    } else if (medioLower.includes('tarj') || medioLower.includes('deb') || medioLower.includes('card')) {
      medioPago = 'Tarjeta';
    } else if (medioLower.includes('transf') || medioLower.includes('banc') || medioLower.includes('nequi') || medioLower.includes('daviplata')) {
      medioPago = 'Transferencia';
    }

    // Tipo de documento
    let tipoDoc = String(getVal('tipo', 'tipo_documento', 'tipo_doc')).toLowerCase();
    if (!tipoDoc) {
      tipoDoc = cufeStr ? 'factura_electronica' : 'factura_electronica';
    } else if (tipoDoc.includes('electron')) tipoDoc = 'factura_electronica';
    else if (tipoDoc.includes('soporte')) tipoDoc = 'documento_soporte';
    else if (tipoDoc.includes('cuenta') || tipoDoc.includes('cobro')) tipoDoc = 'cuenta_cobro';
    else if (tipoDoc.includes('papel')) tipoDoc = 'factura_papel';
    else if (tipoDoc.includes('pos')) tipoDoc = 'tiquete_pos';
    else tipoDoc = 'factura_electronica';

    filas.push({
      lineaExcel: index + 2, // Fila en Excel contando encabezado
      tipoDocumento: tipoDoc,
      prefijo: String(getVal('prefijo', 'serie')).trim() || undefined,
      folio: folioStr,
      cufe: cufeStr,
      fechaEmision,
      fechaVencimiento: fechaVencimiento || (formaPago === 'credito' ? fechaEmision : undefined),
      formaPago,
      medioPago,
      nitProveedor: nitStr,
      dvProveedor: String(getVal('dv', 'digito_verificacion')).trim() || undefined,
      razonSocialProveedor: proveedorStr,
      telefonoProveedor: String(getVal('telefono', 'celular', 'tel')).trim() || undefined,
      emailProveedor: String(getVal('email', 'correo', 'mail')).trim() || undefined,
      ciudadProveedor: String(getVal('ciudad', 'municipio')).trim() || 'Bogotá D.C.',
      categoriaNombre: String(getVal('categoria', 'clasificacion', 'rubro')).trim() || undefined,
      centroCostoNombre: String(getVal('centro_costo', 'centro', 'area', 'sede')).trim() || undefined,
      subtotal: Math.round(subtotal),
      iva: Math.round(iva),
      reteFuente: Math.round(reteFuente),
      reteIva: Math.round(reteIva),
      reteIca: Math.round(reteIca),
      total: Math.round(total),
      estadoPago,
      observaciones: String(getVal('observaciones', 'notas', 'descripcion', 'concepto')).trim() || undefined,
      esValida: errores.length === 0,
      errores,
    });
  });

  const totalValidas = filas.filter((f) => f.esValida).length;
  const totalConError = filas.filter((f) => !f.esValida).length;

  return { filas, totalValidas, totalConError };
}

/**
 * Descarga una plantilla modelo en Excel (.xlsx) sencilla para importar facturas
 * Requiere únicamente: Fecha, NIT, Nombre, Número de Factura, Valor Facturado, Medio de Pago y CUFE
 */
export function descargarPlantillaExcel(): void {
  const wb = XLSX.utils.book_new();

  // Encabezados sencillos solicitados
  const headers = [
    'Fecha',
    'NIT',
    'Nombre',
    'Número de Factura',
    'Valor Facturado',
    'Medio de Pago',
    'CUFE',
  ];

  const filasEjemplo = [
    [
      '2026-03-10',
      '900593450',
      'ZOETIS COLOMBIA S.A.S.',
      'FE-10948',
      2500000,
      'Transferencia',
      'a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    ],
    [
      '2026-03-12',
      '900223847',
      'ROYAL CANIN COLOMBIA S.A.S.',
      'RC-884321',
      3800000,
      'Transferencia',
      '',
    ],
    [
      '2026-03-15',
      '860002130',
      'MSD SALUD ANIMAL COLOMBIA S.A.S.',
      'MSD-54210',
      1450000,
      'Crédito',
      '',
    ],
    [
      '2026-03-18',
      '900889123',
      'DISTRIBUIDORA MEDICO QUIRURGICA VET S.A.S.',
      'VQ-3321',
      890000,
      'Efectivo',
      '',
    ],
    [
      '2026-03-20',
      '800123987',
      'INMOBILIARIA DEL NORTE S.A.S.',
      'AR-2026-03',
      3500000,
      'Transferencia',
      '',
    ],
  ];

  const dataRows: any[][] = [headers, ...filasEjemplo];
  const ws = XLSX.utils.aoa_to_sheet(dataRows);

  // Formato en columna E (Valor Facturado en COP)
  for (let r = 2; r <= dataRows.length; r++) {
    const ref = `E${r}`;
    if (ws[ref]) ws[ref].z = '"$"#,##0';
  }

  ws['!cols'] = autoAjustarColumnas(dataRows);
  XLSX.utils.book_append_sheet(wb, ws, 'Facturas');

  // Hoja 2: Guía rápida y sencilla
  const wsGuia = XLSX.utils.aoa_to_sheet([
    ['GUÍA DE CAMPOS PARA LA PLANTILLA SIMPLIFICADA DE VETCOMPRAS'],
    [],
    ['Campo', '¿Es Obligatorio?', 'Descripción', 'Ejemplo'],
    ['Fecha', 'Sí', 'Fecha de emisión de la factura (formato AAAA-MM-DD)', '2026-03-15'],
    ['NIT', 'Sí', 'NIT o Cédula del proveedor sin puntos ni guión', '900593450'],
    ['Nombre', 'Sí', 'Nombre o Razón Social del proveedor', 'ZOETIS COLOMBIA S.A.S.'],
    ['Número de Factura', 'Sí', 'Folio o número oficial de la factura', 'FE-10948'],
    ['Valor Facturado', 'Sí', 'Valor total facturado en pesos colombianos (sin centavos)', '2500000'],
    ['Medio de Pago', 'Opcional', 'Transferencia, Efectivo, Tarjeta o Crédito', 'Transferencia'],
    ['CUFE', 'Opcional', 'Código electrónico de la DIAN (déjalo vacío si no aplica)', 'a1b2c3d...'],
  ]);
  wsGuia['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 55 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsGuia, 'Instrucciones');

  XLSX.writeFile(wb, 'Plantilla_Facturas_VetCompras.xlsx');
}

/**
 * Exporta el listado de ventas veterinarias a Excel
 */
export function exportarVentasAExcel(
  ventas: Venta[],
  nombreArchivo = 'VetCompras_Ventas.xlsx'
): void {
  // Una fila por ítem vendido: permite tablas dinámicas por categoría y concepto
  const headers = [
    'Recibo', 'Fecha', 'Cliente', 'CC/NIT', 'Teléfono', 'Mascota',
    'Categoría', 'Subcategoría', 'Concepto', 'Cantidad', 'Valor unitario', 'Descuento', 'Subtotal ítem',
    'Total venta', 'Formas de pago', 'Saldo a crédito', 'Estado', 'Observaciones',
  ];
  const filas: any[][] = [];
  for (const v of ventas) {
    const pagos = pagosDeVenta(v)
      .map((p) => `${getMedioPagoVentaInfo(p.medio).label} ${p.monto}`)
      .join(' + ');
    const saldo = saldoDeVenta(v);
    itemsDeVenta(v).forEach((i, n) => {
      filas.push([
        v.consecutivo, v.fecha, v.clienteNombre || '', v.clienteDocumento || '', v.clienteTelefono || '', v.mascotaNombre || '',
        getCategoriaVentaInfo(i.categoria).label, getSubcategoriaVentaInfo(i.categoria, i.subcategoria)?.label || '',
        i.concepto, i.cantidad, i.precioUnitario, i.descuento || 0, i.subtotal,
        // Los valores de la venta solo en la primera fila, para que las sumas no se dupliquen
        n === 0 ? v.monto : '', n === 0 ? pagos || 'A crédito' : '', n === 0 ? saldo : '',
        n === 0 ? (saldo === 0 ? 'Pagada' : saldo < v.monto ? 'Abono parcial' : 'Pendiente') : '',
        n === 0 ? v.observaciones || '' : '',
      ]);
    });
  }
  const totalVentas = ventas.reduce((acc, v) => acc + v.monto, 0);
  const totalSaldo = ventas.reduce((acc, v) => acc + saldoDeVenta(v), 0);
  const dataRows: any[][] = [headers, ...filas, ['TOTAL', '', '', '', '', '', '', '', '', '', '', '', '', totalVentas, '', totalSaldo, '', '']];
  const ws = XLSX.utils.aoa_to_sheet(dataRows);
  for (let r = 2; r <= dataRows.length; r++) {
    for (const col of ['K', 'L', 'M', 'N', 'P']) {
      const ref = `${col}${r}`;
      if (ws[ref] && typeof ws[ref].v === 'number') ws[ref].z = '"$"#,##0';
    }
  }
  ws['!cols'] = autoAjustarColumnas(dataRows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ventas');
  XLSX.writeFile(wb, nombreArchivo);
}

/**
 * Exporta el reporte consolidado de Utilidad, Ventas por Categoría y Compras a Excel
 */
export function exportarReporteUtilidadYCategoriasExcel(
  periodoTexto: string,
  resumenUtilidad: {
    ventasTotales: number;
    comprasInventario: number;
    gastosOperativos: number;
    egresosTotales: number;
    utilidadNeta: number;
    margenOperativo: number;
  },
  ventasPorCategoria: Array<{
    categoriaKey: string;
    nombre: string;
    cantidad: number;
    total: number;
    porcentaje: number;
  }>,
  comprasPorCategoria: Array<{
    nombre: string;
    esGasto: boolean;
    cantidad: number;
    total: number;
    porcentaje: number;
  }>,
  ventasDetalle: Venta[],
  comprasDetalle: CompraDocumento[],
  categorias: Categoria[],
  nombreArchivo = 'VetCompras_Reporte_Utilidad_Ventas_Compras.xlsx'
): void {
  const wb = XLSX.utils.book_new();

  // 1. Hoja Resumen de Utilidad
  const resumenRows: any[][] = [
    ['REPORTE FINANCIERO Y UTILIDAD OPERATIVA VETERINARIA'],
    ['Período:', periodoTexto],
    ['Fecha de Generación:', new Date().toLocaleDateString('es-CO')],
    [],
    ['Concepto Financiero', 'Monto (COP)', 'Participación / Margen'],
    ['(+) Ventas Totales', resumenUtilidad.ventasTotales, '100.0%'],
    ['(-) Compras de Mercancía / Insumos', resumenUtilidad.comprasInventario, resumenUtilidad.ventasTotales > 0 ? `${((resumenUtilidad.comprasInventario / resumenUtilidad.ventasTotales) * 100).toFixed(1)}%` : '0%'],
    ['(-) Gastos Operativos (Servicios, Arriendos, Personal, Varios)', resumenUtilidad.gastosOperativos, resumenUtilidad.ventasTotales > 0 ? `${((resumenUtilidad.gastosOperativos / resumenUtilidad.ventasTotales) * 100).toFixed(1)}%` : '0%'],
    ['(=) TOTAL EGRESOS (Compras + Gastos)', resumenUtilidad.egresosTotales, resumenUtilidad.ventasTotales > 0 ? `${((resumenUtilidad.egresosTotales / resumenUtilidad.ventasTotales) * 100).toFixed(1)}%` : '0%'],
    ['(=) UTILIDAD NETA / RESULTADO OPERATIVO', resumenUtilidad.utilidadNeta, `${resumenUtilidad.margenOperativo.toFixed(1)}%`],
  ];
  const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows);
  for (let r = 6; r <= 10; r++) {
    const ref = `B${r}`;
    if (wsResumen[ref]) wsResumen[ref].z = '"$"#,##0';
  }
  wsResumen['!cols'] = autoAjustarColumnas(resumenRows);
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Estado Utilidad');

  // 2. Hoja Ventas por Categoría (7 categorías exactas)
  const vCatRows: any[][] = [
    ['VENTAS DISCRIMINADAS POR CATEGORÍA'],
    ['Período:', periodoTexto],
    [],
    ['Categoría de Venta', 'Cantidad de Ventas', 'Total Ventas (COP)', 'Participación (%)'],
    ...ventasPorCategoria.map((vc) => [
      vc.nombre,
      vc.cantidad,
      vc.total,
      `${vc.porcentaje.toFixed(1)}%`,
    ]),
    [
      'TOTAL GENERAL VENTAS',
      ventasPorCategoria.reduce((acc, vc) => acc + vc.cantidad, 0),
      resumenUtilidad.ventasTotales,
      '100.0%',
    ],
  ];
  const wsVCat = XLSX.utils.aoa_to_sheet(vCatRows);
  for (let r = 5; r <= vCatRows.length; r++) {
    const ref = `C${r}`;
    if (wsVCat[ref]) wsVCat[ref].z = '"$"#,##0';
  }
  wsVCat['!cols'] = autoAjustarColumnas(vCatRows);
  XLSX.utils.book_append_sheet(wb, wsVCat, 'Ventas x Categoria');

  // 3. Hoja Compras por Categoría
  const cCatRows: any[][] = [
    ['COMPRAS Y GASTOS DISCRIMINADOS POR CATEGORÍA'],
    ['Período:', periodoTexto],
    [],
    ['Categoría', 'Tipo', 'Cantidad Facturas', 'Total (COP)', 'Participación (%)'],
    ...comprasPorCategoria.map((cc) => [
      cc.nombre,
      cc.esGasto ? 'Gasto' : 'Compra',
      cc.cantidad,
      cc.total,
      `${cc.porcentaje.toFixed(1)}%`,
    ]),
    [
      'TOTAL GENERAL EGRESOS',
      '',
      comprasPorCategoria.reduce((acc, cc) => acc + cc.cantidad, 0),
      resumenUtilidad.egresosTotales,
      '100.0%',
    ],
  ];
  const wsCCat = XLSX.utils.aoa_to_sheet(cCatRows);
  for (let r = 5; r <= cCatRows.length; r++) {
    const ref = `D${r}`;
    if (wsCCat[ref]) wsCCat[ref].z = '"$"#,##0';
  }
  wsCCat['!cols'] = autoAjustarColumnas(cCatRows);
  XLSX.utils.book_append_sheet(wb, wsCCat, 'Compras x Categoria');

  // 4. Hoja Detalle de Ventas
  const vDetRows: any[][] = [
    ['Consecutivo', 'Fecha', 'Categoría', 'Subcategoría', 'Concepto', 'Monto (COP)', 'Medio de Pago', 'Estado', 'Cliente', 'Mascota'],
    ...ventasDetalle.map((v) => {
      const subInfo = getSubcategoriaVentaInfo(v.categoria, v.subcategoria);
      return [
        v.consecutivo,
        v.fecha,
        getCategoriaVentaInfo(v.categoria).label,
        subInfo?.label || '-',
        v.concepto,
        v.monto,
        getMedioPagoVentaInfo(v.medioPago).label,
        saldoDeVenta(v) === 0 ? 'Pagada' : `Saldo ${saldoDeVenta(v)}`,
        v.clienteNombre || '-',
        v.mascotaNombre || '-',
      ];
    }),
  ];
  const wsVDet = XLSX.utils.aoa_to_sheet(vDetRows);
  for (let r = 2; r <= vDetRows.length; r++) {
    const ref = `F${r}`;
    if (wsVDet[ref]) wsVDet[ref].z = '"$"#,##0';
  }
  wsVDet['!cols'] = autoAjustarColumnas(vDetRows);
  XLSX.utils.book_append_sheet(wb, wsVDet, 'Detalle Ventas');

  // 5. Hoja Detalle Compras
  const catMap = new Map(categorias.map((c) => [c.id, c.nombre]));
  const cDetRows: any[][] = [
    ['Fecha', 'Factura / Folio', 'Proveedor', 'NIT', 'Tipo', 'Categoría', 'Medio de Pago', 'Total (COP)', 'Estado'],
    ...comprasDetalle.map((d) => [
      d.fechaEmision,
      d.folio,
      d.proveedor?.razonSocial || 'Proveedor',
      d.proveedor?.nit || '',
      d.esGasto ? 'Gasto' : 'Compra',
      catMap.get(d.categoriaId) || 'General',
      d.medioPago || 'Efectivo',
      d.total,
      d.estadoPago,
    ]),
  ];
  const wsCDet = XLSX.utils.aoa_to_sheet(cDetRows);
  for (let r = 2; r <= cDetRows.length; r++) {
    const ref = `H${r}`;
    if (wsCDet[ref]) wsCDet[ref].z = '"$"#,##0';
  }
  wsCDet['!cols'] = autoAjustarColumnas(cDetRows);
  XLSX.utils.book_append_sheet(wb, wsCDet, 'Detalle Compras');

  XLSX.writeFile(wb, nombreArchivo);
}



