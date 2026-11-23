import React, { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Mail, MessageCircle, Share2, Trash2, X } from 'lucide-react';
import type { EmpresaInfo } from '../../types';
import type { PagoNomina } from '../../utils/nomina';
import { pdfAImagenes } from '../../services/vistaPdf';
import { descargarBlob, telefonoWhatsApp } from '../../services/reciboPdf';
import { generarComprobanteNomina, mensajeComprobante, nombreArchivoComprobante } from '../../services/comprobanteNominaPdf';
import { useToast } from '../../context/ToastContext';

/** Vista previa del comprobante de pago y opciones para descargarlo, imprimirlo o enviarlo. */
export const ModalComprobanteNomina: React.FC<{
  pago: PagoNomina;
  empresa: EmpresaInfo;
  email?: string;
  telefono?: string;
  onCerrar: () => void;
  onEliminar?: () => void;
}> = ({ pago, empresa, email, telefono, onCerrar, onEliminar }) => {
  const { mostrarToast } = useToast();
  const pdf = useMemo(() => generarComprobanteNomina(pago, empresa), [pago, empresa]);
  const nombre = nombreArchivoComprobante(pago);
  const mensaje = mensajeComprobante(pago, empresa);
  const [paginas, setPaginas] = useState<string[] | null>(null);
  useEffect(() => {
    let vigente = true;
    pdfAImagenes(pdf, 1000)
      .then((p) => vigente && setPaginas(p))
      .catch(() => vigente && setPaginas([]));
    return () => {
      vigente = false;
    };
  }, [pdf]);
  const archivo = useMemo(() => new File([pdf], nombre, { type: 'application/pdf' }), [pdf, nombre]);
  const puedeCompartir = typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [archivo] });

  const descargar = async () => {
    if (await descargarBlob(pdf, nombre)) mostrarToast('success', 'Comprobante guardado', nombre);
  };
  const compartir = async () => {
    try {
      await navigator.share({ files: [archivo], title: nombre, text: mensaje });
    } catch {
      /* cancelado */
    }
  };
  const whatsapp = async () => {
    await descargarBlob(pdf, nombre);
    window.open(`https://wa.me/${telefonoWhatsApp(telefono)}?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener');
    mostrarToast('info', 'Adjunte el PDF en WhatsApp', `Se guardó ${nombre}. En el chat, use el clip para adjuntarlo.`, 9000);
  };
  const correo = async () => {
    await descargarBlob(pdf, nombre);
    window.location.href = `mailto:${email || ''}?subject=${encodeURIComponent(`Comprobante de pago ${pago.numero}`)}&body=${encodeURIComponent(mensaje)}`;
    mostrarToast('info', 'Adjunte el PDF al correo', `Se guardó ${nombre}; adjúntelo en el correo que se abrió.`, 9000);
  };

  const boton = 'flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold border border-slate-300 dark:border-slate-700';
  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/60 flex items-center justify-center p-2 sm:p-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-4xl max-h-full overflow-hidden bg-white dark:bg-slate-900 rounded-2xl flex flex-col md:flex-row">
        <div className="flex-1 min-h-0 overflow-y-auto bg-slate-100 dark:bg-slate-800 p-3 max-h-[55vh] md:max-h-[85vh]">
          {!paginas ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            paginas.map((src, i) => <img key={i} src={src} alt={`Comprobante página ${i + 1}`} className="w-full shadow rounded" />)
          )}
        </div>
        <div className="w-full md:w-72 p-4 space-y-2.5 shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-slate-900 dark:text-white">Comprobante {pago.numero}</p>
              <p className="text-xs text-slate-500">{pago.empleadoNombre}</p>
            </div>
            <button onClick={onCerrar} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Cerrar">
              <X className="w-5 h-5" />
            </button>
          </div>
          <button id="comprobante-descargar" onClick={descargar} className={`${boton} w-full bg-blue-600 border-blue-600 text-white`}>
            <Download className="w-4 h-4" /> Descargar PDF (para firmar)
          </button>
          {puedeCompartir && (
            <button onClick={compartir} className={`${boton} w-full`}>
              <Share2 className="w-4 h-4" /> Compartir
            </button>
          )}
          <button onClick={whatsapp} className={`${boton} w-full`}>
            <MessageCircle className="w-4 h-4 text-green-600" /> WhatsApp{telefono ? ` (${telefono})` : ''}
          </button>
          <button onClick={correo} className={`${boton} w-full`}>
            <Mail className="w-4 h-4" /> Correo{email ? ` (${email})` : ''}
          </button>
          <p className="text-[11px] text-slate-500">Imprímalo para la firma del colaborador o envíeselo. El soporte de la consignación, si lo cargó, va dentro del PDF.</p>
          {onEliminar && (
            <button onClick={onEliminar} className={`${boton} w-full text-rose-600 border-rose-200`}>
              <Trash2 className="w-4 h-4" /> Anular comprobante
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
