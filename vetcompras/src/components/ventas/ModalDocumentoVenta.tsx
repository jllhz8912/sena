import React, { useState, useRef } from 'react';
import {
  X,
  Printer,
  Share2,
  Download,
  Copy,
  Check,
  Building2,
  FileText,
  Clock,
  User,
  Heart,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import { Venta, EmpresaInfo } from '../../types';
import {
  formatCOP,
  formatFecha,
  getCategoriaVentaInfo,
  getMedioPagoVentaInfo,
  getSubcategoriaVentaInfo,
  numeroALetras,
} from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';

interface ModalDocumentoVentaProps {
  venta: Venta;
  empresa: EmpresaInfo;
  onCerrar: () => void;
}

export const ModalDocumentoVenta: React.FC<ModalDocumentoVentaProps> = ({
  venta,
  empresa,
  onCerrar,
}) => {
  const { mostrarToast } = useToast();
  const [formato, setFormato] = useState<'carta' | 'tirilla'>('carta');
  const [copiado, setCopiado] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  const catInfo = getCategoriaVentaInfo(venta.categoria);
  const subInfo = getSubcategoriaVentaInfo(venta.categoria, venta.subcategoria);
  const medioInfo = getMedioPagoVentaInfo(venta.medioPago);
  const montoEnLetras = numeroALetras(venta.monto);

  const colorPrimario = empresa.colorPrimario || '#059669';

  // Manejar impresión limpia en navegador
  const handleImprimir = () => {
    window.print();
  };

  // Enviar recibo por WhatsApp al cliente
  const handleEnviarWhatsApp = () => {
    let telefono = venta.clienteTelefono?.replace(/\D/g, '') || '';
    if (telefono.length === 10 && !telefono.startsWith('57')) {
      telefono = `57${telefono}`;
    }

    const mensaje = `🐾 *${empresa.nombreComercial || empresa.razonSocial}*
📄 *${empresa.tituloDocumentoVenta || 'COMPROBANTE DE VENTA'} No. ${venta.consecutivo}*
━━━━━━━━━━━━━━━━━━━━━━
📅 *Fecha:* ${formatFecha(venta.fecha)}
👤 *Cliente:* ${venta.clienteNombre || 'Cliente'}
${venta.mascotaNombre ? `🐶 *Mascota:* ${venta.mascotaNombre}\n` : ''}
📋 *Detalle del Servicio / Producto:*
• ${venta.concepto}
• Categoría: ${catInfo.label}${subInfo ? ` (${subInfo.nombreCorto})` : ''}

💰 *TOTAL A PAGAR:* ${formatCOP(venta.monto)}
(${montoEnLetras})
💳 *Medio de pago:* ${medioInfo.label}
📌 *Estado:* ${venta.estado === 'pagada' ? '✅ PAGADO' : '⏳ PENDIENTE DE PAGO'}
━━━━━━━━━━━━━━━━━━━━━━
📍 *Dirección:* ${empresa.direccion}, ${empresa.ciudad}
📞 *Teléfono:* ${empresa.telefono || empresa.whatsapp || ''}
${empresa.textoPieRecibo ? `\n_${empresa.textoPieRecibo}_` : ''}`;

    const url = telefono
      ? `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;

    window.open(url, '_blank');
    mostrarToast('success', 'WhatsApp generado', 'Abriendo chat para enviar el comprobante de venta.');
  };

  // Copiar resumen de recibo al portapapeles
  const handleCopiarTexto = async () => {
    const texto = `COMPROBANTE DE VENTA No. ${venta.consecutivo} - ${empresa.nombreComercial || empresa.razonSocial}
Fecha: ${formatFecha(venta.fecha)}
Cliente: ${venta.clienteNombre || 'Cliente'} ${venta.mascotaNombre ? `| Mascota: ${venta.mascotaNombre}` : ''}
Concepto: ${venta.concepto} (${catInfo.label})
Total: ${formatCOP(venta.monto)} (${montoEnLetras})
Medio: ${medioInfo.label} | Estado: ${venta.estado === 'pagada' ? 'PAGADO' : 'PENDIENTE'}`;

    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      mostrarToast('success', 'Copiado', 'Resumen del comprobante copiado al portapapeles.');
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      mostrarToast('error', 'Error', 'No se pudo copiar al portapapeles.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-hidden animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Barra superior de control del documento */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/80 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div
              className="p-2 rounded-xl text-white shadow-xs"
              style={{ backgroundColor: colorPrimario }}
            >
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>Documento de Venta</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {venta.consecutivo}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Imprima en PDF o envíe el comprobante oficial al cliente
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Selector de formato: Carta vs Tirilla POS */}
            <div className="hidden sm:flex bg-slate-200 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFormato('carta')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  formato === 'carta'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Formato Carta / Factura
              </button>
              <button
                type="button"
                onClick={() => setFormato('tirilla')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  formato === 'tirilla'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Tirilla POS (80mm)
              </button>
            </div>

            <button
              onClick={onCerrar}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra de Acciones rápidas (Imprimir, WhatsApp, Copiar) */}
        <div className="px-5 py-2.5 bg-slate-100/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0 print:hidden text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={handleImprimir}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-white shadow-xs transition-all hover:opacity-95"
              style={{ backgroundColor: colorPrimario }}
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Guardar en PDF</span>
            </button>

            <button
              onClick={handleEnviarWhatsApp}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs transition-all"
            >
              <Smartphone className="w-4 h-4" />
              <span>Enviar por WhatsApp</span>
            </button>

            <button
              onClick={handleCopiarTexto}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
            >
              {copiado ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copiado ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-500 hidden md:inline">
            💡 Puede imprimir o guardar como PDF usando la opción de su navegador
          </span>
        </div>

        {/* Contenedor del documento con scroll y diseño imprimible */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 flex justify-center">
          {/* ======================================================== */}
          {/* FORMATO 1: MEDIA CARTA / CARTA PROFESIONAL */}
          {/* ======================================================== */}
          {formato === 'carta' ? (
            <div
              ref={printAreaRef}
              id="imprimible-venta"
              className="w-full max-w-2xl bg-white text-slate-900 p-6 sm:p-8 rounded-2xl shadow-md border border-slate-200 print:border-none print:shadow-none print:p-0 print:m-0 space-y-6 text-xs"
            >
              {/* Encabezado con Logo y Datos de la Veterinaria */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b pb-5">
                <div className="flex items-start gap-4">
                  {empresa.logoUrl ? (
                    <img
                      src={empresa.logoUrl}
                      alt="Logo de la veterinaria"
                      className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-xl border border-slate-100 p-1"
                    />
                  ) : (
                    <div
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex flex-col items-center justify-center text-white font-black shadow-xs shrink-0"
                      style={{ backgroundColor: colorPrimario }}
                    >
                      <Building2 className="w-8 h-8" />
                      <span className="text-[9px] uppercase tracking-wider mt-0.5">VET</span>
                    </div>
                  )}

                  <div className="space-y-0.5">
                    <h1 className="text-base sm:text-lg font-black tracking-tight" style={{ color: colorPrimario }}>
                      {empresa.nombreComercial || empresa.razonSocial}
                    </h1>
                    <p className="font-bold text-[11px] text-slate-700">
                      NIT: {empresa.nit}{empresa.dv ? `-${empresa.dv}` : ''} • {empresa.regimenTributario || 'No Responsable de IVA'}
                    </p>
                    {empresa.slogan && (
                      <p className="text-[10px] italic text-slate-500">{empresa.slogan}</p>
                    )}
                    <p className="text-[11px] text-slate-600">
                      {empresa.direccion} • {empresa.ciudad}, {empresa.departamento}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      Tel: {empresa.telefono} {empresa.whatsapp ? `• WhatsApp: ${empresa.whatsapp}` : ''}
                    </p>
                    {empresa.email && <p className="text-[10px] text-slate-500">{empresa.email}</p>}
                  </div>
                </div>

                {/* Recuadro de Consecutivo y Fecha */}
                <div className="sm:text-right shrink-0">
                  <div
                    className="p-3 rounded-xl border text-center sm:text-right space-y-1"
                    style={{ borderColor: `${colorPrimario}40`, backgroundColor: `${colorPrimario}08` }}
                  >
                    <span className="block text-[10px] font-bold uppercase tracking-wider" style={{ color: colorPrimario }}>
                      {empresa.tituloDocumentoVenta || 'COMPROBANTE DE VENTA'}
                    </span>
                    <span className="block font-black text-lg text-slate-900 font-mono">
                      {venta.consecutivo}
                    </span>
                    <span className="block text-[11px] text-slate-600 font-medium">
                      Fecha: <strong>{formatFecha(venta.fecha)}</strong>
                    </span>
                  </div>

                  <div className="mt-2 text-center sm:text-right">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase ${
                        venta.estado === 'pagada'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}
                    >
                      {venta.estado === 'pagada' ? '✓ PAGADO' : '⏳ PENDIENTE POR COBRAR'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Información del Cliente y Mascota */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    DATOS DEL CLIENTE / PROPIETARIO
                  </span>
                  <div className="text-xs font-bold text-slate-900 mt-0.5">
                    {venta.clienteNombre || 'Cliente de Mostrador'}
                  </div>
                  {venta.clienteTelefono && (
                    <div className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{venta.clienteTelefono}</span>
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    PACIENTE / MASCOTA ATENDIDA
                  </span>
                  <div className="text-xs font-bold text-emerald-700 mt-0.5 flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                    <span>{venta.mascotaNombre || 'No especificada'}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Modalidad: <strong>{medioInfo.label}</strong>
                  </div>
                </div>
              </div>

              {/* Tabla de Detalle de Venta */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-2.5 px-3 w-12 text-center">Cant.</th>
                      <th className="py-2.5 px-3">Descripción del Producto / Servicio</th>
                      <th className="py-2.5 px-3">Categoría</th>
                      <th className="py-2.5 px-3 text-right">Valor Unitario</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-3 px-3 text-center font-bold">1</td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{venta.concepto}</div>
                        {subInfo && (
                          <div className="text-[11px] text-slate-500 font-medium">
                            Subdivisión: {subInfo.label}
                          </div>
                        )}
                        {venta.observaciones && (
                          <div className="text-[10px] italic text-slate-400 mt-0.5">
                            Nota: {venta.observaciones}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {catInfo.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-700">
                        {formatCOP(venta.monto)}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-slate-900">
                        {formatCOP(venta.monto)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Totales y Letras */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2">
                <div className="space-y-1.5 flex-1">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      VALOR EN LETRAS
                    </span>
                    <span className="font-bold text-slate-800">{montoEnLetras}</span>
                  </div>

                  <div className="text-[10px] text-slate-500 space-y-0.5">
                    <p>• Medio de pago acordado: <strong>{medioInfo.label}</strong></p>
                    <p>• {empresa.resolucionLegal || 'Documento soporte equivalente no responsable de IVA (Art. 437 E.T.)'}</p>
                  </div>
                </div>

                {/* Caja de Liquidación de Totales */}
                <div className="w-full sm:w-64 space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Subtotal:</span>
                    <span className="font-semibold text-slate-900">{formatCOP(venta.monto)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 text-slate-500">
                    <span>IVA (Exento / No Aplica):</span>
                    <span className="font-mono">$ 0</span>
                  </div>
                  <div
                    className="flex justify-between py-2 px-3 rounded-xl text-white font-black text-sm"
                    style={{ backgroundColor: colorPrimario }}
                  >
                    <span>TOTAL A PAGAR:</span>
                    <span>{formatCOP(venta.monto)}</span>
                  </div>
                </div>
              </div>

              {/* Firmas de Responsabilidad */}
              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200">
                <div className="text-center">
                  <div className="border-t border-dashed border-slate-400 pt-1.5 w-3/4 mx-auto"></div>
                  <span className="block font-bold text-[11px] text-slate-800">
                    {empresa.nombreComercial || empresa.razonSocial}
                  </span>
                  <span className="block text-[10px] text-slate-400">Médico Veterinario / Firma Autorizada</span>
                </div>

                <div className="text-center">
                  <div className="border-t border-dashed border-slate-400 pt-1.5 w-3/4 mx-auto"></div>
                  <span className="block font-bold text-[11px] text-slate-800">
                    {venta.clienteNombre || 'Cliente / Propietario'}
                  </span>
                  <span className="block text-[10px] text-slate-400">Firma de Recibido a Conformidad</span>
                </div>
              </div>

              {/* Pie de página con términos y agradecimiento */}
              {empresa.textoPieRecibo && (
                <div className="text-center pt-2 text-[10px] italic text-slate-500 border-t border-slate-100">
                  {empresa.textoPieRecibo}
                </div>
              )}
            </div>
          ) : (
            /* ======================================================== */
            /* FORMATO 2: TIRILLA POS TÉRMICA (80MM)                    */
            /* ======================================================== */
            <div
              ref={printAreaRef}
              id="imprimible-venta-tirilla"
              className="w-full max-w-xs bg-white text-slate-900 p-5 rounded-2xl shadow-md border border-slate-200 font-mono text-[11px] space-y-3 print:border-none print:shadow-none print:p-0 print:m-0"
            >
              <div className="text-center space-y-1 border-b border-dashed border-slate-400 pb-3">
                {empresa.logoUrl && (
                  <img
                    src={empresa.logoUrl}
                    alt="Logo"
                    className="w-14 h-14 object-contain mx-auto mb-1"
                  />
                )}
                <h2 className="font-black text-sm uppercase">{empresa.nombreComercial || empresa.razonSocial}</h2>
                <p className="text-[10px]">NIT: {empresa.nit}{empresa.dv ? `-${empresa.dv}` : ''}</p>
                <p className="text-[10px]">{empresa.regimenTributario || 'No Responsable de IVA'}</p>
                <p className="text-[10px]">{empresa.direccion} - {empresa.ciudad}</p>
                <p className="text-[10px]">Tel: {empresa.telefono}</p>
                {empresa.whatsapp && <p className="text-[10px]">WhatsApp: {empresa.whatsapp}</p>}
              </div>

              <div className="border-b border-dashed border-slate-400 pb-2 space-y-0.5 text-[10px]">
                <div className="flex justify-between font-bold">
                  <span>RECIBO No:</span>
                  <span>{venta.consecutivo}</span>
                </div>
                <div className="flex justify-between">
                  <span>FECHA:</span>
                  <span>{formatFecha(venta.fecha)}</span>
                </div>
                <div className="flex justify-between">
                  <span>CLIENTE:</span>
                  <span className="truncate max-w-[150px]">{venta.clienteNombre || 'Mostrador'}</span>
                </div>
                {venta.mascotaNombre && (
                  <div className="flex justify-between">
                    <span>MASCOTA:</span>
                    <span>{venta.mascotaNombre}</span>
                  </div>
                )}
              </div>

              <div className="border-b border-dashed border-slate-400 pb-3 space-y-1">
                <div className="flex justify-between font-bold text-[10px]">
                  <span>CONCEPTO / PRODUCTO</span>
                  <span>TOTAL</span>
                </div>
                <div className="text-[11px] font-bold">{venta.concepto}</div>
                <div className="text-[10px] text-slate-500">
                  {catInfo.label} {subInfo ? `• ${subInfo.nombreCorto}` : ''}
                </div>
                <div className="flex justify-between font-bold pt-1">
                  <span>1 x {formatCOP(venta.monto)}</span>
                  <span>{formatCOP(venta.monto)}</span>
                </div>
              </div>

              <div className="space-y-1 text-right border-b border-dashed border-slate-400 pb-3 text-xs">
                <div className="flex justify-between font-black text-sm pt-1">
                  <span>TOTAL COP:</span>
                  <span>{formatCOP(venta.monto)}</span>
                </div>
                <div className="text-[9px] text-left text-slate-500 pt-0.5">
                  SON: {montoEnLetras}
                </div>
                <div className="flex justify-between text-[10px] pt-1">
                  <span>PAGO:</span>
                  <span className="font-bold">{medioInfo.label.toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>ESTADO:</span>
                  <span className="font-black text-emerald-700">{venta.estado === 'pagada' ? 'PAGADO' : 'PENDIENTE'}</span>
                </div>
              </div>

              <div className="text-center text-[9px] text-slate-500 space-y-1 pt-2">
                <p>{empresa.textoPieRecibo || '¡Gracias por confiar en nosotros!'}</p>
                <p>{empresa.resolucionLegal || 'Documento Soporte No Responsable de IVA'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
