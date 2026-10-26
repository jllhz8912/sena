import React, { useState, useRef, useEffect } from 'react';
import { Plus, UploadCloud, FilePenLine, FileSpreadsheet, CircleDollarSign, X } from 'lucide-react';

interface BotonFlotanteNuevoProps {
  onSubirFactura: () => void;
  onCargarExcel: () => void;
  onRegistroManual: () => void;
  onNuevaVenta?: () => void;
}

export const BotonFlotanteNuevo: React.FC<BotonFlotanteNuevoProps> = ({
  onSubirFactura,
  onCargarExcel,
  onRegistroManual,
  onNuevaVenta,
}) => {
  const [abierto, setAbierto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
      {/* Opciones desplegables hacia arriba */}
      {abierto && (
        <div className="mb-3 space-y-2 flex flex-col items-end animate-in fade-in slide-in-from-bottom-3 duration-150">
          {onNuevaVenta && (
            <button
              onClick={() => {
                setAbierto(false);
                onNuevaVenta();
              }}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-emerald-500 dark:border-emerald-500 shadow-xl text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 font-bold text-xs group transition-all"
            >
              <span>+ Registrar Venta</span>
              <div className="p-1.5 rounded-xl bg-emerald-500 text-white group-hover:scale-110 transition-transform">
                <CircleDollarSign className="w-4 h-4" />
              </div>
            </button>
          )}

          <button
            onClick={() => {
              setAbierto(false);
              onSubirFactura();
            }}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-slate-800 dark:text-slate-100 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 font-semibold text-xs group transition-all"
          >
            <span>Subir factura electrónica</span>
            <div className="p-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-4 h-4" />
            </div>
          </button>

          <button
            onClick={() => {
              setAbierto(false);
              onCargarExcel();
            }}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-slate-800 dark:text-slate-100 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 font-semibold text-xs group transition-all"
          >
            <span>Importar desde Excel</span>
            <div className="p-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </button>

          <button
            onClick={() => {
              setAbierto(false);
              onRegistroManual();
            }}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-slate-800 dark:text-slate-100 hover:bg-teal-50 dark:hover:bg-teal-950/60 font-semibold text-xs group transition-all"
          >
            <span>Registro manual compra/gasto</span>
            <div className="p-1.5 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform">
              <FilePenLine className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* Botón Principal Flotante */}
      <button
        onClick={() => setAbierto(!abierto)}
        className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white shadow-xl shadow-emerald-600/30 flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        title="Crear nuevo registro de compra o gasto"
      >
        {abierto ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
      </button>
    </div>
  );
};
