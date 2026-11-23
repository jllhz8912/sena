import React, { useRef } from 'react';
import { Camera, ChevronRight, FileUp, PenLine } from 'lucide-react';
import type { CompraDocumento } from '../../types';
import { formatCOP } from '../../utils/formatters';

/**
 * Compras desde el celular: foto de la factura (se lee en el teléfono con el QR
 * de la DIAN, el texto o el reconocimiento de letras), factura electrónica
 * (XML, ZIP o PDF) o registro a mano. Debajo, las últimas compras.
 */
export const ComprasMovil: React.FC<{
  documentos: CompraDocumento[];
  onArchivos: (archivos: File[]) => void;
  onManual: () => void;
  onEditar: (d: CompraDocumento) => void;
  onVerTodas: () => void;
}> = ({ documentos, onArchivos, onManual, onEditar, onVerTodas }) => {
  const camara = useRef<HTMLInputElement>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const recientes = [...documentos].sort((a, b) => (b.creadoEn || b.fechaEmision || '').localeCompare(a.creadoEn || a.fechaEmision || '')).slice(0, 12);
  const alElegir = (e: React.ChangeEvent<HTMLInputElement>) => {
    const lista = Array.from(e.target.files || []);
    e.target.value = '';
    if (lista.length) onArchivos(lista);
  };

  const Boton: React.FC<{ id: string; color: string; icono: React.ReactNode; titulo: string; texto: string; onClick: () => void }> = ({ id, color, icono, titulo, texto, onClick }) => (
    <button id={id} onClick={onClick} className="w-full flex items-center gap-4 p-4 rounded-3xl text-white text-left shadow-md active:scale-[0.98] transition-transform" style={{ background: color }}>
      <span className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">{icono}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-lg font-black leading-tight">{titulo}</span>
        <span className="block text-[13px] text-white/85 leading-snug">{texto}</span>
      </span>
    </button>
  );

  return (
    <div className="p-4 space-y-3">
      <Boton id="compra-foto" color="#ea580c" icono={<Camera className="w-7 h-7" />} titulo="Tomar foto a la factura" texto="El celular lee el QR de la DIAN y el texto, sin internet." onClick={() => camara.current?.click()} />
      <Boton id="compra-archivo" color="#7c3aed" icono={<FileUp className="w-7 h-7" />} titulo="Subir factura electrónica" texto="XML, ZIP o PDF que le llegó por correo o WhatsApp." onClick={() => archivo.current?.click()} />
      <Boton id="compra-manual" color="#475569" icono={<PenLine className="w-7 h-7" />} titulo="Registrar a mano" texto="Compra o gasto sin factura electrónica." onClick={onManual} />
      <input ref={camara} type="file" accept="image/*" capture="environment" className="hidden" onChange={alElegir} />
      <input ref={archivo} id="compra-archivo-input" type="file" multiple accept=".xml,.zip,.pdf,.jpg,.jpeg,.png,application/xml,text/xml,application/pdf,application/zip,image/*" className="hidden" onChange={alElegir} />

      <div className="pt-3 flex items-center justify-between">
        <h3 className="font-bold text-slate-800 dark:text-slate-100">Últimas compras</h3>
        <button onClick={onVerTodas} className="text-sm font-semibold text-blue-600 dark:text-blue-400">
          Ver todas
        </button>
      </div>
      {!recientes.length && <p className="text-sm text-slate-500">Aún no hay compras registradas.</p>}
      <div className="space-y-2">
        {recientes.map((d) => (
          <button key={d.id} onClick={() => onEditar(d)} className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-left">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-slate-900 dark:text-white">{d.proveedor?.razonSocial || 'Sin proveedor'}</p>
              <p className="text-xs text-slate-500">
                {[d.prefijo, d.folio].filter(Boolean).join('') || 'Sin número'} · {d.fechaEmision}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{formatCOP(d.total)}</p>
              {d.saldoPendiente > 0 && <p className="text-[11px] font-semibold text-rose-600 tabular-nums">Debe {formatCOP(d.saldoPendiente)}</p>}
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        ))}
      </div>
    </div>
  );
};
