import React, { useState } from 'react';
import {
  X,
  FileText,
  Building,
  DollarSign,
  Calendar,
  CreditCard,
  Download,
  Clock,
  History,
  Tag,
  Receipt,
  FileCheck,
  Percent,
  Plus,
} from 'lucide-react';
import { CompraDocumento, Categoria, CentroCosto } from '../../types';
import { formatCOP, formatFecha, getTipoDocumentoLabel, getEstadoPagoLabel } from '../../utils/formatters';
import { RegistrarAbonoModal } from './RegistrarAbonoModal';

interface DetalleDocumentoDrawerProps {
  documento: CompraDocumento | null;
  categorias: Categoria[];
  centrosCosto: CentroCosto[];
  onCerrar: () => void;
  onEditar: (doc: CompraDocumento) => void;
  onDatosActualizados: () => void;
}

export const DetalleDocumentoDrawer: React.FC<DetalleDocumentoDrawerProps> = ({
  documento,
  categorias,
  centrosCosto,
  onCerrar,
  onEditar,
  onDatosActualizados,
}) => {
  const [mostrarModalAbono, setMostrarModalAbono] = useState(false);

  if (!documento) return null;

  const categoria = categorias.find((c) => c.id === documento.categoriaId);
  const centroCosto = centrosCosto.find((cc) => cc.id === documento.centroCostoId);
  const estadoLabel = getEstadoPagoLabel(documento.estadoPago);

  const handleDescargarAdjunto = () => {
    if (!documento.archivoAdjunto) return;

    if (documento.archivoAdjunto.dataUrl) {
      const a = document.createElement('a');
      a.href = documento.archivoAdjunto.dataUrl;
      a.download = documento.archivoAdjunto.nombre;
      a.click();
    } else if (documento.archivoAdjunto.contenidoXml) {
      const blob = new Blob([documento.archivoAdjunto.contenidoXml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = documento.archivoAdjunto.nombre || 'factura.xml';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-xs flex justify-end animate-in fade-in">
        <div className="bg-white dark:bg-slate-900 w-full max-w-2xl h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-right">
          {/* Header */}
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50 dark:bg-slate-900/60">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                  {getTipoDocumentoLabel(documento.tipoDocumento)}
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${estadoLabel.colorClass}`}
                >
                  {estadoLabel.texto}
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {documento.prefijo ? `${documento.prefijo}-${documento.folio}` : documento.folio}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {documento.proveedor?.razonSocial} (NIT: {documento.proveedor?.nit})
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onEditar(documento)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
              >
                Editar
              </button>
              <button
                onClick={onCerrar}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Banner de Saldo y Totales */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Total Factura
                </span>
                <p className="text-2xl font-black text-emerald-950 dark:text-emerald-100">
                  {formatCOP(documento.total)}
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                  Subtotal: {formatCOP(documento.subtotal)} • IVA: {formatCOP(documento.totalIva)}
                </p>
              </div>

              {documento.saldoPendiente > 0 ? (
                <div className="text-right">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    Saldo Pendiente
                  </span>
                  <p className="text-xl font-black text-rose-600 dark:text-rose-400">
                    {formatCOP(documento.saldoPendiente)}
                  </p>
                  <button
                    onClick={() => setMostrarModalAbono(true)}
                    className="mt-1 flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Registrar Abono
                  </button>
                </div>
              ) : (
                <div className="text-right">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">
                    ✓ Totalmente Cancelada
                  </span>
                </div>
              )}
            </div>

            {/* Fechas y Condiciones */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block mb-1">Fecha Emisión</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {formatFecha(documento.fechaEmision)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block mb-1">Vencimiento</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {formatFecha(documento.fechaVencimiento)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block mb-1">Forma Pago</span>
                <span className="font-bold text-slate-800 dark:text-slate-100 uppercase">
                  {documento.formaPago}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block mb-1">Medio</span>
                <span className="font-bold text-slate-800 dark:text-slate-100 capitalize">
                  {documento.medioPago.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Clasificación y Centro de Costo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 block">Categoría</span>
                <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-emerald-600" />
                  {categoria?.nombre || 'Sin categoría'}
                </span>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 block">Centro de Costo</span>
                <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-teal-600" />
                  {centroCosto?.codigo} - {centroCosto?.nombre}
                </span>
              </div>
            </div>

            {/* CUFE */}
            {documento.cufe && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs">
                <span className="text-slate-400 block mb-1 font-mono text-[10px]">
                  CUFE / CUDE (DIAN)
                </span>
                <p className="font-mono text-[11px] text-slate-600 dark:text-slate-300 break-all select-all">
                  {documento.cufe}
                </p>
              </div>
            )}

            {/* Desglose Tributario (Bases, IVA, Retenciones) */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Desglose Tributario (Formularios DIAN 300 y 350)
              </h3>
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800">
                  <span className="text-slate-500">Base Gravable 19%:</span>
                  <span className="font-semibold">{formatCOP(documento.baseIva19)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800">
                  <span className="text-slate-500">IVA 19%:</span>
                  <span className="font-semibold text-emerald-600">{formatCOP(documento.iva19)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800">
                  <span className="text-slate-500">Base Gravable 5%:</span>
                  <span className="font-semibold">{formatCOP(documento.baseIva5)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800">
                  <span className="text-slate-500">IVA 5%:</span>
                  <span className="font-semibold text-emerald-600">{formatCOP(documento.iva5)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800">
                  <span className="text-slate-500">Base 0% / Exenta:</span>
                  <span className="font-semibold">{formatCOP(documento.baseIva0)}</span>
                </div>
                {documento.reteFuente > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800 text-rose-600">
                    <span>ReteFuente:</span>
                    <span className="font-semibold">- {formatCOP(documento.reteFuente)}</span>
                  </div>
                )}
                {documento.reteIva > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800 text-rose-600">
                    <span>ReteIVA:</span>
                    <span className="font-semibold">- {formatCOP(documento.reteIva)}</span>
                  </div>
                )}
                {documento.reteIca > 0 && (
                  <div className="flex justify-between py-1 text-rose-600">
                    <span>ReteICA:</span>
                    <span className="font-semibold">- {formatCOP(documento.reteIca)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Detalle de Líneas de Factura */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Productos e Ítems Comprados ({(documento.lineas || []).length})
              </h3>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {(documento.lineas || []).map((linea, idx) => (
                  <div key={linea.id || idx} className="p-3 flex justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {linea.descripcion}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {linea.cantidad} {linea.unidad} x {formatCOP(linea.valorUnitario)} • IVA {linea.porcentajeIva}% ({formatCOP(linea.valorIva)})
                      </p>
                    </div>
                    <div className="font-bold text-slate-800 dark:text-slate-100 shrink-0">
                      {formatCOP(linea.totalLinea)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Historial de Pagos y Abonos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Historial de Pagos y Abonos ({(documento.pagos || []).length})
                </h3>
                {documento.saldoPendiente > 0 && (
                  <button
                    onClick={() => setMostrarModalAbono(true)}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                  >
                    + Registrar Pago
                  </button>
                )}
              </div>

              {(documento.pagos || []).length > 0 ? (
                <div className="space-y-1.5">
                  {documento.pagos.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {formatFecha(p.fecha)}
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Medio: {p.medio} {p.referencia ? `• Ref: ${p.referencia}` : ''} {p.nota ? `• ${p.nota}` : ''}
                        </p>
                      </div>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        + {formatCOP(p.monto)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No hay pagos registrados aún.</p>
              )}
            </div>

            {/* Archivo Original Adjunto */}
            {documento.archivoAdjunto && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Archivo Original Adjunto
                </h3>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-5 h-5 text-emerald-600" />
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {documento.archivoAdjunto.nombre}
                      </p>
                      <p className="text-[10px] text-slate-400 uppercase">
                        Tipo: {documento.archivoAdjunto.tipo} • {(documento.archivoAdjunto.tamano / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleDescargarAdjunto}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar</span>
                  </button>
                </div>
              </div>
            )}

            {/* Historial de Auditoría */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                Historial de Cambios y Auditoría
              </h3>
              <div className="space-y-1.5">
                {(documento.historialCambios || []).map((h, i) => (
                  <div key={i} className="text-xs p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-800/60">
                    <div className="flex justify-between text-slate-400 text-[10px] mb-0.5">
                      <span>{h.usuario}</span>
                      <span>{formatFecha(h.fecha)}</span>
                    </div>
                    <p className="font-semibold text-slate-700 dark:text-slate-300">{h.accion}</p>
                    {h.detalle && <p className="text-[11px] text-slate-500 mt-0.5">{h.detalle}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Registrar Abono */}
      {mostrarModalAbono && (
        <RegistrarAbonoModal
          documento={documento}
          onAbonoRegistrado={() => {
            setMostrarModalAbono(false);
            onDatosActualizados();
            onCerrar();
          }}
          onCerrar={() => setMostrarModalAbono(false)}
        />
      )}
    </>
  );
};
