import React, { useEffect, useMemo, useState } from 'react';
import { X, Download, Share2, Mail, MessageCircle, Copy, Check, Receipt } from 'lucide-react';
import { Venta, EmpresaInfo } from '../../types';
import { formatCOP } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';
import {
  FormatoRecibo,
  generarReciboPdf,
  nombreArchivoRecibo,
  mensajeRecibo,
  telefonoWhatsApp,
  descargarBlob,
} from '../../services/reciboPdf';

interface ModalDocumentoVentaProps {
  venta: Venta;
  empresa: EmpresaInfo;
  onCerrar: () => void;
}

/** Recibo de venta: vista previa del PDF real y opciones para enviarlo. */
export const ModalDocumentoVenta: React.FC<ModalDocumentoVentaProps> = ({ venta, empresa, onCerrar }) => {
  const { mostrarToast } = useToast();
  const [formato, setFormato] = useState<FormatoRecibo>('carta');
  const [copiado, setCopiado] = useState(false);

  const pdf = useMemo(() => generarReciboPdf(venta, empresa, formato), [venta, empresa, formato]);
  const urlVistaPrevia = useMemo(() => URL.createObjectURL(pdf), [pdf]);
  useEffect(() => () => URL.revokeObjectURL(urlVistaPrevia), [urlVistaPrevia]);

  const nombre = nombreArchivoRecibo(venta);
  const mensaje = mensajeRecibo(venta, empresa);
  const archivo = useMemo(() => new File([pdf], nombre, { type: 'application/pdf' }), [pdf, nombre]);
  const puedeCompartirArchivo = typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [archivo] });

  const descargar = async () => {
    if (await descargarBlob(pdf, nombre)) {
      mostrarToast('success', 'Recibo descargado', `${nombre} quedó en la carpeta Descargas.`);
    }
  };

  // Windows 10/11, Android e iPhone permiten enviar el PDF directo a WhatsApp, correo, etc.
  const compartir = async () => {
    try {
      await navigator.share({ files: [archivo], title: `Recibo ${venta.consecutivo}`, text: mensaje });
    } catch (err: any) {
      if (err?.name !== 'AbortError') mostrarToast('error', 'No se pudo compartir', 'Descargue el PDF y adjúntelo manualmente.');
    }
  };

  const enviarWhatsApp = async () => {
    await descargarBlob(pdf, nombre);
    const telefono = telefonoWhatsApp(venta.clienteTelefono);
    const url = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank', 'noopener');
    mostrarToast('info', 'Adjunte el PDF en WhatsApp', `Se descargó ${nombre}. En el chat que se abrió, use el clip 📎 para adjuntarlo.`, 9000);
  };

  const enviarCorreo = async () => {
    await descargarBlob(pdf, nombre);
    const asunto = `Recibo de venta ${venta.consecutivo} - ${empresa.nombreComercial || empresa.razonSocial}`;
    window.location.href = `mailto:${venta.clienteEmail || ''}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje.replace(/\*/g, ''))}`;
    mostrarToast('info', 'Adjunte el PDF al correo', `Se descargó ${nombre}; adjúntelo en el correo que se abrió.`, 9000);
  };

  const copiarTexto = async () => {
    try {
      await navigator.clipboard.writeText(mensaje.replace(/\*/g, ''));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      mostrarToast('error', 'No se pudo copiar', 'Seleccione el texto manualmente.');
    }
  };

  const boton =
    'flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold border transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-5xl h-full sm:h-[94vh] flex flex-col overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-600 text-white">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                Recibo {venta.consecutivo} · {formatCOP(venta.monto)}
              </h3>
              <p className="text-[11px] text-slate-500 truncate">{venta.clienteNombre || 'Cliente de mostrador'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-semibold">
              {(['carta', 'tirilla'] as FormatoRecibo[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormato(f)}
                  className={`px-3 py-1.5 rounded-lg ${formato === f ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}
                >
                  {f === 'carta' ? 'Hoja carta' : 'Tirilla 80 mm'}
                </button>
              ))}
            </div>
            <button onClick={onCerrar} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800" title="Cerrar">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          <div className="flex-1 min-h-[300px] bg-slate-200 dark:bg-slate-950">
            <iframe title="Vista previa del recibo" src={urlVistaPrevia} className="w-full h-full border-0" />
          </div>

          <aside className="md:w-72 shrink-0 p-4 space-y-2.5 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Enviar o guardar</p>
            <button onClick={descargar} className={`${boton} w-full bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600`}>
              <Download className="w-4 h-4" /> Descargar PDF
            </button>
            {puedeCompartirArchivo && (
              <button onClick={compartir} className={`${boton} w-full border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40`}>
                <Share2 className="w-4 h-4" /> Compartir PDF (WhatsApp, correo…)
              </button>
            )}
            <button onClick={enviarWhatsApp} className={`${boton} w-full border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800`}>
              <MessageCircle className="w-4 h-4 text-green-600" /> WhatsApp {venta.clienteTelefono ? `(${venta.clienteTelefono})` : ''}
            </button>
            <button onClick={enviarCorreo} className={`${boton} w-full border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800`}>
              <Mail className="w-4 h-4 text-sky-600" /> Correo {venta.clienteEmail ? '' : '(sin correo)'}
            </button>
            <button onClick={copiarTexto} className={`${boton} w-full border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800`}>
              {copiado ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />} Copiar resumen
            </button>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              WhatsApp y correo descargan el PDF y abren el mensaje listo; solo falta adjuntar el archivo.
              {puedeCompartirArchivo ? ' Con “Compartir PDF” se envía directamente.' : ''}
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
};
