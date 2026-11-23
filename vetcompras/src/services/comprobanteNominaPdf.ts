/**
 * Comprobante de pago de nómina (desprendible) en PDF, tamaño carta, con el
 * membrete de la empresa, devengados y deducciones, neto en letras, medio de pago,
 * soporte de la consignación y espacio para la firma del colaborador.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { EmpresaInfo } from '../types';
import { formatCOP, formatFecha, numeroALetras } from '../utils/formatters';
import { MARCA, logoDe } from '../data/marca';
import { hexARgb, formatoImagen, nitCompleto } from './reciboPdf';
import { MEDIOS_PAGO_NOMINA, NOMBRE_TIPO_PAGO, type PagoNomina } from '../utils/nomina';

export function nombreArchivoComprobante(p: PagoNomina): string {
  const nombre = p.empleadoNombre.normalize('NFD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  return `Comprobante_${p.numero}_${nombre}.pdf`;
}

export function generarComprobanteNomina(p: PagoNomina, empresa: EmpresaInfo): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const color = hexARgb(empresa.colorPrimario || MARCA.colorPrimario, [37, 99, 235]);
  const ancho = doc.internal.pageSize.getWidth();
  const margen = 15;
  let y = margen;

  // Membrete
  let xTexto = margen;
  const logo = logoDe(empresa);
  if (formatoImagen(logo)) {
    try {
      doc.addImage(logo, formatoImagen(logo)!, margen, y, 20, 20);
      xTexto = margen + 24;
    } catch {
      /* logo no compatible */
    }
  }
  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(20, 20, 20);
  doc.text(empresa.razonSocial || empresa.nombreComercial || 'Mi Empresa', xTexto, y + 5);
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(80, 80, 80);
  const lineas = [nitCompleto(empresa), [empresa.direccion, empresa.ciudad].filter(Boolean).join(', '), [empresa.telefono, empresa.email].filter(Boolean).join(' · ')].filter(Boolean);
  lineas.forEach((l, i) => doc.text(l, xTexto, y + 10 + i * 4));

  const cajaAncho = 68;
  const cajaX = ancho - margen - cajaAncho;
  doc.setFillColor(...color).roundedRect(cajaX, y, cajaAncho, 24, 2, 2, 'F');
  doc.setTextColor(255, 255, 255).setFont('helvetica', 'bold').setFontSize(9);
  doc.text(p.tipo === 'nomina' ? 'COMPROBANTE DE PAGO DE NÓMINA' : `COMPROBANTE DE PAGO · ${NOMBRE_TIPO_PAGO[p.tipo].toUpperCase()}`, cajaX + cajaAncho / 2, y + 6, { align: 'center', maxWidth: cajaAncho - 6 });
  doc.setFontSize(13).text(`N.º ${p.numero}`, cajaX + cajaAncho / 2, y + 14, { align: 'center' });
  doc.setFont('helvetica', 'normal').setFontSize(8.5).text(`Fecha de pago: ${formatFecha(p.fechaPago)}`, cajaX + cajaAncho / 2, y + 20, { align: 'center' });
  y += 30;

  // Colaborador y periodo
  doc.setDrawColor(220, 220, 220).setFillColor(248, 250, 252).roundedRect(margen, y, ancho - margen * 2, 18, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(100, 100, 100);
  doc.text('COLABORADOR', margen + 4, y + 5);
  doc.text('PERIODO', margen + 120, y + 5);
  doc.setTextColor(20, 20, 20).setFontSize(10);
  doc.text(p.empleadoNombre, margen + 4, y + 10.5);
  doc.text(`${formatFecha(p.periodoDesde)} a ${formatFecha(p.periodoHasta)}`, margen + 120, y + 10.5);
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(80, 80, 80);
  doc.text([`C.C. ${p.empleadoDocumento}`, p.cargo].filter(Boolean).join(' · '), margen + 4, y + 15);
  y += 23;

  // Devengados y deducciones lado a lado
  const filas = Math.max(p.devengados.length, p.deducciones.length);
  const cuerpo = Array.from({ length: filas }, (_, i) => [
    p.devengados[i] ? p.devengados[i].concepto + (p.devengados[i].detalle ? ` (${p.devengados[i].detalle})` : '') : '',
    p.devengados[i] ? formatCOP(p.devengados[i].valor) : '',
    p.deducciones[i] ? p.deducciones[i].concepto : '',
    p.deducciones[i] ? formatCOP(p.deducciones[i].valor) : '',
  ]);
  autoTable(doc, {
    startY: y,
    margin: { left: margen, right: margen },
    head: [['Devengados', 'Valor', 'Deducciones', 'Valor']],
    body: cuerpo,
    foot: [['Total devengado', formatCOP(p.totalDevengado), 'Total deducciones', formatCOP(p.totalDeducciones)]],
    styles: { fontSize: 8.5, cellPadding: 2, textColor: [30, 30, 30] },
    headStyles: { fillColor: color, textColor: [255, 255, 255] },
    footStyles: { fillColor: [241, 245, 249], textColor: [20, 20, 20], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right', cellWidth: 30 }, 3: { halign: 'right', cellWidth: 30 } },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Neto
  doc.setFillColor(...color).roundedRect(margen, y, ancho - margen * 2, 16, 2, 2, 'F');
  doc.setTextColor(255, 255, 255).setFont('helvetica', 'bold').setFontSize(11).text('NETO A PAGAR', margen + 5, y + 7);
  doc.setFontSize(15).text(formatCOP(p.neto), ancho - margen - 5, y + 9, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(7.5).text(`Son: ${numeroALetras(p.neto)}`, margen + 5, y + 13, { maxWidth: ancho - margen * 2 - 60 });
  y += 22;

  // Medio de pago y soporte
  const medio = MEDIOS_PAGO_NOMINA.find((m) => m.id === p.medioPago)?.texto || p.medioPago;
  doc.setTextColor(30, 30, 30).setFont('helvetica', 'bold').setFontSize(9).text('Forma de pago:', margen, y);
  doc.setFont('helvetica', 'normal').text(`${medio}${p.referenciaPago ? ` · Ref. ${p.referenciaPago}` : ''}`, margen + 28, y);
  if (p.observaciones) {
    y += 5;
    doc.setFontSize(8.5).setTextColor(80, 80, 80).text(`Observaciones: ${p.observaciones}`, margen, y, { maxWidth: ancho - margen * 2 });
  }
  y += 6;
  if (p.soporte && formatoImagen(p.soporte)) {
    try {
      const props = doc.getImageProperties(p.soporte);
      const alto = 45;
      const anchoImg = Math.min(80, (props.width / props.height) * alto);
      doc.setFontSize(8).setTextColor(100, 100, 100).text('Soporte de pago:', margen, y + 3);
      doc.addImage(p.soporte, formatoImagen(p.soporte)!, margen, y + 5, anchoImg, alto);
      y += alto + 9;
    } catch {
      /* soporte no compatible */
    }
  }

  // Firmas
  y = Math.max(y + 14, 225);
  doc.setDrawColor(120, 120, 120);
  doc.line(margen, y, margen + 75, y);
  doc.line(ancho - margen - 75, y, ancho - margen, y);
  doc.setFontSize(8.5).setTextColor(40, 40, 40);
  doc.text('Firma del colaborador', margen, y + 4.5);
  doc.text(`C.C. ${p.empleadoDocumento}`, margen, y + 9);
  doc.text('Firma del empleador', ancho - margen - 75, y + 4.5);
  doc.text(empresa.razonSocial || empresa.nombreComercial || '', ancho - margen - 75, y + 9);
  doc.setFontSize(7.5).setTextColor(120, 120, 120);
  doc.text('Con mi firma declaro que recibí a satisfacción el valor neto indicado en este comprobante.', margen, y + 16);
  doc.text(`Generado con ${MARCA.nombre}`, ancho / 2, 272, { align: 'center' });
  return doc.output('blob');
}

export function mensajeComprobante(p: PagoNomina, empresa: EmpresaInfo): string {
  return [
    `Hola ${p.empleadoNombre.split(' ')[0]},`,
    `${empresa.nombreComercial || empresa.razonSocial || ''} le envía el comprobante ${p.numero} de ${NOMBRE_TIPO_PAGO[p.tipo].toLowerCase()}`,
    `del ${formatFecha(p.periodoDesde)} al ${formatFecha(p.periodoHasta)}.`,
    `Neto pagado: ${formatCOP(p.neto)} (${MEDIOS_PAGO_NOMINA.find((m) => m.id === p.medioPago)?.texto || p.medioPago}${p.referenciaPago ? `, ref. ${p.referenciaPago}` : ''}).`,
  ].join(' ');
}
