/**
 * Recibo de venta en PDF (tamaño carta o tirilla de 80 mm), generado en el
 * propio equipo, sin internet, para descargarlo o enviarlo por WhatsApp/correo.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { EmpresaInfo, Venta } from '../types';
import { formatCOP, formatFecha, getCategoriaVentaInfo, getMedioPagoVentaInfo, numeroALetras } from '../utils/formatters';
import { itemsDeVenta, pagosDeVenta, saldoDeVenta, cambioEfectivo } from '../utils/ventas';
import { MARCA, logoDe } from '../data/marca';

export type FormatoRecibo = 'carta' | 'tirilla';

const AVISO_LEGAL_DEFECTO =
  'Documento interno de venta. No reemplaza la factura electrónica de venta cuando esta sea obligatoria (art. 616-1 E.T.).';

function hexARgb(hex: string | undefined, defecto: [number, number, number]): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : defecto;
}

function formatoImagen(dataUrl: string): 'PNG' | 'JPEG' | null {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG';
  return null;
}

export function nombreArchivoRecibo(venta: Venta): string {
  const cliente = (venta.clienteNombre || 'cliente').normalize('NFD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  return `Recibo_${venta.consecutivo}_${cliente}.pdf`;
}

const nitCompleto = (e: EmpresaInfo) => (e.nit ? `NIT ${e.nit}${e.dv ? '-' + e.dv : ''}` : '');

export function generarReciboPdf(venta: Venta, empresa: EmpresaInfo, formato: FormatoRecibo = 'carta'): Blob {
  return formato === 'tirilla' ? reciboTirilla(venta, empresa) : reciboCarta(venta, empresa);
}

// ------------------------------------------------------------------ carta
function reciboCarta(venta: Venta, empresa: EmpresaInfo): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const color = hexARgb(empresa.colorPrimario || MARCA.colorPrimario, [147, 48, 179]);
  const ancho = doc.internal.pageSize.getWidth();
  const margen = 15;
  let y = margen;

  // Encabezado: logo y datos de la veterinaria
  let xTexto = margen;
  const logo = logoDe(empresa);
  if (formatoImagen(logo)) {
    try {
      doc.addImage(logo, formatoImagen(logo)!, margen, y, 22, 22);
      xTexto = margen + 26;
    } catch {
      // Logo con formato no soportado: se omite
    }
  }
  doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(20, 20, 20);
  doc.text(empresa.nombreComercial || empresa.razonSocial || 'Veterinaria', xTexto, y + 5);
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(80, 80, 80);
  const lineasEmpresa = [
    empresa.nombreComercial && empresa.razonSocial !== empresa.nombreComercial ? empresa.razonSocial : '',
    [nitCompleto(empresa), empresa.regimenTributario].filter(Boolean).join(' · '),
    [empresa.direccion, empresa.ciudad, empresa.departamento].filter(Boolean).join(', '),
    [empresa.telefono && `Tel. ${empresa.telefono}`, empresa.whatsapp && `WhatsApp ${empresa.whatsapp}`].filter(Boolean).join(' · '),
    [empresa.email, empresa.sitioWeb].filter(Boolean).join(' · '),
  ].filter(Boolean);
  lineasEmpresa.forEach((l, i) => doc.text(l, xTexto, y + 10 + i * 4));

  // Recuadro del documento
  const cajaAncho = 66;
  const cajaX = ancho - margen - cajaAncho;
  doc.setFont('helvetica', 'bold').setFontSize(9.5);
  const lineasTitulo: string[] = doc.splitTextToSize(empresa.tituloDocumentoVenta || 'RECIBO DE VENTA', cajaAncho - 8);
  const altoCaja = 20 + lineasTitulo.length * 4;
  doc.setFillColor(...color).roundedRect(cajaX, y, cajaAncho, altoCaja, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(lineasTitulo, cajaX + cajaAncho / 2, y + 6, { align: 'center' });
  const yNumero = y + 6 + lineasTitulo.length * 4 + 3;
  doc.setFontSize(14).text(`N.º ${venta.consecutivo}`, cajaX + cajaAncho / 2, yNumero, { align: 'center' });
  doc.setFont('helvetica', 'normal').setFontSize(9).text(`Fecha: ${formatFecha(venta.fecha)}`, cajaX + cajaAncho / 2, yNumero + 6, { align: 'center' });

  y += Math.max(altoCaja + 4, 12 + lineasEmpresa.length * 4) + 2;

  // Cliente y mascota
  doc.setDrawColor(220, 220, 220).setFillColor(248, 250, 252).roundedRect(margen, y, ancho - margen * 2, 20, 2, 2, 'FD');
  doc.setTextColor(100, 100, 100).setFontSize(7.5).setFont('helvetica', 'bold');
  doc.text('CLIENTE', margen + 4, y + 5);
  doc.text('MASCOTA', margen + 120, y + 5);
  doc.setTextColor(20, 20, 20).setFontSize(9.5);
  doc.text(venta.clienteNombre || 'Cliente de mostrador', margen + 4, y + 10.5);
  doc.text(venta.mascotaNombre || '—', margen + 120, y + 10.5);
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(80, 80, 80);
  doc.text(
    [venta.clienteDocumento && `CC/NIT ${venta.clienteDocumento}`, venta.clienteTelefono && `Cel. ${venta.clienteTelefono}`, venta.clienteEmail]
      .filter(Boolean)
      .join(' · ') || ' ',
    margen + 4,
    y + 15.5
  );
  y += 25;

  // Ítems
  const items = itemsDeVenta(venta);
  autoTable(doc, {
    startY: y,
    margin: { left: margen, right: margen },
    head: [['#', 'Categoría', 'Concepto', 'Cant.', 'Valor unit.', 'Desc.', 'Subtotal']],
    body: items.map((i, n) => [
      String(n + 1),
      getCategoriaVentaInfo(i.categoria).label,
      i.concepto,
      String(i.cantidad),
      formatCOP(i.precioUnitario),
      i.descuento ? formatCOP(i.descuento) : '',
      formatCOP(i.subtotal),
    ]),
    styles: { fontSize: 8.5, cellPadding: 2, textColor: [30, 30, 30] },
    headStyles: { fillColor: color, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 34 },
      3: { cellWidth: 12, halign: 'right' },
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Totales y pagos
  const pagos = pagosDeVenta(venta);
  const saldo = saldoDeVenta(venta);
  const cambio = cambioEfectivo(pagos);
  const xEtiqueta = ancho - margen - 70;
  const xValor = ancho - margen;
  const fila = (etiqueta: string, valor: string, negrita = false, rgb: [number, number, number] = [30, 30, 30]) => {
    doc.setFont('helvetica', negrita ? 'bold' : 'normal').setTextColor(...rgb);
    doc.text(etiqueta, xEtiqueta, y);
    doc.text(valor, xValor, y, { align: 'right' });
    y += 5;
  };
  doc.setFontSize(11);
  fila('TOTAL', formatCOP(venta.monto), true);
  doc.setFontSize(8.5);
  for (const p of pagos) {
    fila(`Pagado · ${getMedioPagoVentaInfo(p.medio).label}${p.referencia ? ` (${p.referencia})` : ''}`, formatCOP(p.monto));
  }
  if (cambio > 0) fila('Cambio entregado', formatCOP(cambio));
  if (saldo > 0) fila('SALDO PENDIENTE', formatCOP(saldo), true, [190, 18, 60]);
  else fila('Estado', 'PAGADO', true, color);

  doc.setFont('helvetica', 'italic').setFontSize(8).setTextColor(80, 80, 80);
  doc.text(`Son: ${numeroALetras(venta.monto)}`, margen, y + 2, { maxWidth: ancho - margen * 2 });
  y += 9;

  if (venta.observaciones) {
    doc.setFont('helvetica', 'bold').setTextColor(30, 30, 30).text('Observaciones', margen, y);
    doc.setFont('helvetica', 'normal').setTextColor(60, 60, 60);
    const lineas = doc.splitTextToSize(venta.observaciones, ancho - margen * 2);
    doc.text(lineas, margen, y + 4.5);
    y += 6 + lineas.length * 4;
  }

  // Pie
  const alto = doc.internal.pageSize.getHeight();
  const pie = [empresa.textoPieRecibo, empresa.resolucionLegal || AVISO_LEGAL_DEFECTO].filter(Boolean) as string[];
  doc.setDrawColor(...color).setLineWidth(0.4).line(margen, alto - 26, ancho - margen, alto - 26);
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(90, 90, 90);
  let yPie = alto - 21;
  for (const t of pie) {
    const lineas = doc.splitTextToSize(t, ancho - margen * 2);
    doc.text(lineas, ancho / 2, yPie, { align: 'center' });
    yPie += lineas.length * 3.5 + 1;
  }
  return doc.output('blob');
}

// ---------------------------------------------------------------- tirilla
function reciboTirilla(venta: Venta, empresa: EmpresaInfo): Blob {
  // Primera pasada en un papel largo para medir; la segunda usa el alto exacto
  const medida = dibujarTirilla(venta, empresa, 1000);
  return dibujarTirilla(venta, empresa, Math.ceil(medida.altoUsado + 6)).doc.output('blob');
}

function dibujarTirilla(venta: Venta, empresa: EmpresaInfo, alto: number): { doc: jsPDF; altoUsado: number } {
  const items = itemsDeVenta(venta);
  const pagos = pagosDeVenta(venta);
  const anchoPapel = 80;
  const doc = new jsPDF({ unit: 'mm', format: [anchoPapel, alto] });
  const m = 5;
  const centro = anchoPapel / 2;
  let y = 7;

  const linea = () => {
    doc.setDrawColor(150, 150, 150).setLineDashPattern([1, 1], 0).line(m, y, anchoPapel - m, y);
    y += 3.5;
  };
  const texto = (t: string, opciones: { negrita?: boolean; tamano?: number; alinear?: 'left' | 'center' | 'right'; x?: number } = {}) => {
    doc.setFont('helvetica', opciones.negrita ? 'bold' : 'normal').setFontSize(opciones.tamano || 7.5).setTextColor(20, 20, 20);
    const x = opciones.x ?? (opciones.alinear === 'center' ? centro : opciones.alinear === 'right' ? anchoPapel - m : m);
    const lineas = doc.splitTextToSize(t, anchoPapel - m * 2);
    doc.text(lineas, x, y, { align: opciones.alinear || 'left' });
    y += lineas.length * ((opciones.tamano || 7.5) * 0.42) + 0.8;
  };
  const par = (izq: string, der: string, negrita = false) => {
    doc.setFont('helvetica', negrita ? 'bold' : 'normal').setFontSize(negrita ? 9 : 7.5);
    doc.text(izq, m, y);
    doc.text(der, anchoPapel - m, y, { align: 'right' });
    y += negrita ? 4.5 : 3.6;
  };

  texto(empresa.nombreComercial || empresa.razonSocial || 'Veterinaria', { negrita: true, tamano: 10, alinear: 'center' });
  if (nitCompleto(empresa)) texto(nitCompleto(empresa), { alinear: 'center' });
  if (empresa.direccion) texto([empresa.direccion, empresa.ciudad].filter(Boolean).join(', '), { alinear: 'center' });
  if (empresa.telefono || empresa.whatsapp) texto(`Tel. ${empresa.telefono || empresa.whatsapp}`, { alinear: 'center' });
  y += 1;
  linea();
  texto(`${empresa.tituloDocumentoVenta || 'RECIBO DE VENTA'} N.º ${venta.consecutivo}`, { negrita: true, tamano: 8.5, alinear: 'center' });
  texto(`Fecha: ${formatFecha(venta.fecha)}`, { alinear: 'center' });
  linea();
  texto(`Cliente: ${venta.clienteNombre || 'Cliente de mostrador'}`);
  if (venta.clienteDocumento) texto(`CC/NIT: ${venta.clienteDocumento}`);
  if (venta.mascotaNombre) texto(`Mascota: ${venta.mascotaNombre}`);
  linea();
  for (const i of items) {
    texto(i.concepto, { negrita: true });
    par(`  ${i.cantidad} x ${formatCOP(i.precioUnitario)}${i.descuento ? ` - ${formatCOP(i.descuento)}` : ''}`, formatCOP(i.subtotal));
  }
  linea();
  par('TOTAL', formatCOP(venta.monto), true);
  for (const p of pagos) par(getMedioPagoVentaInfo(p.medio).label, formatCOP(p.monto));
  const cambio = cambioEfectivo(pagos);
  if (cambio > 0) par('Cambio', formatCOP(cambio));
  const saldo = saldoDeVenta(venta);
  if (saldo > 0) par('SALDO PENDIENTE', formatCOP(saldo), true);
  y += 1;
  texto(`Son: ${numeroALetras(venta.monto)}`, { tamano: 6.5 });
  if (venta.observaciones) texto(`Obs.: ${venta.observaciones}`, { tamano: 6.5 });
  linea();
  if (empresa.textoPieRecibo) texto(empresa.textoPieRecibo, { tamano: 6.5, alinear: 'center' });
  texto(empresa.resolucionLegal || AVISO_LEGAL_DEFECTO, { tamano: 6, alinear: 'center' });
  return { doc, altoUsado: y };
}

// ------------------------------------------------------------- compartir
export function mensajeRecibo(venta: Venta, empresa: EmpresaInfo): string {
  const items = itemsDeVenta(venta)
    .map((i) => `• ${i.concepto}${i.cantidad > 1 ? ` x${i.cantidad}` : ''}: ${formatCOP(i.subtotal)}`)
    .join('\n');
  const saldo = saldoDeVenta(venta);
  return [
    `*${empresa.nombreComercial || empresa.razonSocial}*`,
    `Recibo de venta N.º ${venta.consecutivo} · ${formatFecha(venta.fecha)}`,
    venta.clienteNombre ? `Cliente: ${venta.clienteNombre}` : '',
    venta.mascotaNombre ? `Mascota: ${venta.mascotaNombre}` : '',
    '',
    items,
    '',
    `*Total: ${formatCOP(venta.monto)}*`,
    saldo > 0 ? `Saldo pendiente: ${formatCOP(saldo)}` : 'Estado: pagado',
    '',
    'Le enviamos adjunto el recibo en PDF. ¡Gracias por su confianza!',
  ]
    .filter((l, i, arr) => l !== '' || arr[i - 1] !== '')
    .join('\n');
}

export function telefonoWhatsApp(telefono?: string): string {
  let t = (telefono || '').replace(/\D/g, '');
  if (t.length === 10 && t.startsWith('3')) t = '57' + t; // Celular colombiano
  return t;
}

/** Permite que otro entorno (la demostración en línea) guarde los archivos a su manera. */
type GuardarArchivo = (blob: Blob, nombre: string) => Promise<void>;
let guardarArchivoAlterno: GuardarArchivo | null = null;
export function configurarGuardadoArchivos(fn: GuardarArchivo | null): void {
  guardarArchivoAlterno = fn;
}

/** Descarga el archivo. Devuelve false si el usuario canceló el guardado. */
export async function descargarBlob(blob: Blob, nombre: string): Promise<boolean> {
  if (guardarArchivoAlterno) {
    try {
      await guardarArchivoAlterno(blob, nombre);
      return true;
    } catch {
      return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}
