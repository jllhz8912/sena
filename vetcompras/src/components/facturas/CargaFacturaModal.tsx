import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  FileCode,
  Archive,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Save,
  Download,
} from 'lucide-react';
import { CompraDocumento, Categoria, CentroCosto, Proveedor } from '../../types';
import { procesarFacturaXml } from '../../services/xmlParser';
import { procesarFacturaPdf, procesarPdfDesdeDataUrl } from '../../services/pdfExtractor';
import { completarDocumento } from '../../services/normalizarDocumento';
import { procesarArchivoZip } from '../../services/zipExtractor';
import { procesarExcelFacturas, descargarPlantillaExcel } from '../../services/excelService';
import { dataService } from '../../services/dataService';
import { formatCOP } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';
import { RevisionFacturaModal } from './RevisionFacturaModal';

interface ItemLote {
  id: string;
  nombreArchivo: string;
  tipo: 'xml' | 'pdf' | 'zip' | 'excel';
  tamano: number;
  estado: 'procesando' | 'listo' | 'duplicado' | 'error';
  mensajeError?: string;
  duplicadoInfo?: CompraDocumento;
  datosExtraidos?: Partial<CompraDocumento>;
}

interface CargaFacturaModalProps {
  categorias: Categoria[];
  centrosCosto: CentroCosto[];
  proveedores: Proveedor[];
  onFacturaGuardada: () => void;
  onAbrirCargaExcel?: () => void;
  onCerrar: () => void;
}

export const CargaFacturaModal: React.FC<CargaFacturaModalProps> = ({
  categorias,
  centrosCosto,
  proveedores,
  onFacturaGuardada,
  onAbrirCargaExcel,
  onCerrar,
}) => {
  const { mostrarToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [arrastrando, setArrastrando] = useState(false);
  const [itemsLote, setItemsLote] = useState<ItemLote[]>([]);
  const [procesandoGlobal, setProcesandoGlobal] = useState(false);
  const [itemParaRevision, setItemParaRevision] = useState<Partial<CompraDocumento> | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setArrastrando(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setArrastrando(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setArrastrando(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      procesarArchivos(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      procesarArchivos(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const procesarArchivos = async (archivos: File[]) => {
    setProcesandoGlobal(true);

    const nuevosItems: ItemLote[] = archivos.map((f) => {
      let tipo: 'xml' | 'pdf' | 'zip' | 'excel' = 'xml';
      const name = f.name.toLowerCase();
      if (name.endsWith('.pdf')) tipo = 'pdf';
      else if (name.endsWith('.zip')) tipo = 'zip';
      else if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) tipo = 'excel';

      return {
        id: 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        nombreArchivo: f.name,
        tipo,
        tamano: f.size,
        estado: 'procesando',
      };
    });

    setItemsLote((prev) => [...prev, ...nuevosItems]);

    const catalogos = { categorias, centrosCosto };

    // Procesar cada archivo (un ZIP puede traer varias facturas)
    for (let i = 0; i < archivos.length; i++) {
      const archivo = archivos[i];
      const itemRef = nuevosItems[i];
      const lowerName = archivo.name.toLowerCase();

      try {
        let resultados: Partial<CompraDocumento>[] = [];

        if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) {
          if (onAbrirCargaExcel) {
            setProcesandoGlobal(false);
            onCerrar();
            onAbrirCargaExcel();
            return;
          }
          throw new Error('Use la opción "Importar desde Excel" para este archivo.');
        } else if (lowerName.endsWith('.xml')) {
          resultados = [procesarFacturaXml(await archivo.text(), archivo.name)];
        } else if (/\.(pdf|png|jpe?g|webp)$/.test(lowerName)) {
          resultados = [(await procesarFacturaPdf(archivo, catalogos)).datos];
        } else if (lowerName.endsWith('.zip')) {
          const zipResultados = await procesarArchivoZip(archivo);
          if (zipResultados.length === 0) {
            throw new Error('El archivo ZIP no contiene un XML o PDF de factura válido.');
          }
          for (const r of zipResultados) {
            // ZIP sin XML: el PDF se analiza con Gemini
            if (!r.folio && r.archivoAdjunto?.dataUrl) {
              const adj = r.archivoAdjunto;
              resultados.push(
                (await procesarPdfDesdeDataUrl(adj.dataUrl!, adj.nombre, adj.tamano, 'application/pdf', catalogos)).datos
              );
            } else {
              resultados.push(r);
            }
          }
        } else {
          throw new Error('Formato no soportado. Debe ser archivo .xml, .pdf, .zip, imagen o .xlsx');
        }

        const evaluados = await Promise.all(
          resultados.map(async (datos) => ({
            datos,
            duplicado: await dataService.buscarDuplicado(datos.cufe, datos.proveedor?.nit, datos.folio, datos.prefijo),
          }))
        );

        setItemsLote((prev) => {
          const extras: ItemLote[] = evaluados.slice(1).map(({ datos, duplicado }, k) => ({
            id: `${itemRef.id}-${k + 1}`,
            nombreArchivo: `${archivo.name} › ${datos.prefijo || ''}${datos.folio || 'documento ' + (k + 2)}`,
            tipo: itemRef.tipo,
            tamano: datos.archivoAdjunto?.tamano || 0,
            estado: duplicado ? 'duplicado' : 'listo',
            duplicadoInfo: duplicado || undefined,
            datosExtraidos: datos,
          }));
          const actualizados = prev.map((it) => {
            if (it.id !== itemRef.id) return it;
            const { datos, duplicado } = evaluados[0];
            return {
              ...it,
              nombreArchivo:
                evaluados.length > 1 ? `${archivo.name} › ${datos.prefijo || ''}${datos.folio || 'documento 1'}` : it.nombreArchivo,
              estado: duplicado ? ('duplicado' as const) : ('listo' as const),
              duplicadoInfo: duplicado || undefined,
              datosExtraidos: datos,
            };
          });
          const pos = actualizados.findIndex((it) => it.id === itemRef.id);
          actualizados.splice(pos + 1, 0, ...extras);
          return actualizados;
        });
      } catch (err: any) {
        console.error('Error procesando archivo:', err);
        setItemsLote((prev) =>
          prev.map((it) => {
            if (it.id !== itemRef.id) return it;
            return {
              ...it,
              estado: 'error',
              mensajeError: err?.message || 'Error desconocido al analizar archivo.',
            };
          })
        );
      }
    }

    setProcesandoGlobal(false);
  };

  const handleGuardarTodosLosListos = async () => {
    const listos = itemsLote.filter((it) => it.estado === 'listo' && it.datosExtraidos);
    if (listos.length === 0) {
      mostrarToast('info', 'No hay facturas listas', 'No hay documentos listos para guardar automáticamente.');
      return;
    }

    let guardados = 0;
    let fallidos = 0;
    for (const item of listos) {
      try {
        const docParaGuardar = completarDocumento(item.datosExtraidos!, { categorias, centrosCosto, proveedores });
        await dataService.guardarDocumento(docParaGuardar);
        guardados++;
      } catch (err) {
        console.error('Error guardando factura en lote:', err);
        fallidos++;
      }
    }

    if (fallidos > 0) {
      mostrarToast('error', 'Guardado incompleto', `Se archivaron ${guardados} facturas; ${fallidos} no se pudieron guardar.`);
      return;
    }
    mostrarToast('success', 'Facturas guardadas', `Se archivaron ${guardados} facturas exitosamente.`);
    onFacturaGuardada();
    onCerrar();
  };

  const handleEliminarItemLote = (id: string) => {
    setItemsLote((prev) => prev.filter((it) => it.id !== id));
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-hidden animate-in fade-in">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Carga de Factura Electrónica
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Extracción automática de datos para la veterinaria sin digitación manual.
                </p>
              </div>
            </div>

            <button
              onClick={onCerrar}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {/* Zona Drag & Drop */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
                arrastrando
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 scale-[0.99]'
                  : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500/80 bg-slate-50/60 dark:bg-slate-800/30 hover:bg-emerald-50/30'
              }`}
            >
              <div className="max-w-md mx-auto space-y-3">
                <div className="flex justify-center gap-3">
                  <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 shadow-sm">
                    <FileCode className="w-6 h-6" />
                  </div>
                  <div className="p-3 rounded-2xl bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 shadow-sm">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="p-3 rounded-2xl bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 shadow-sm">
                    <Archive className="w-6 h-6" />
                  </div>
                  <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 shadow-sm">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                </div>

                <div>
                  <p className="text-base font-bold text-slate-800 dark:text-slate-100">
                    Arrastra aquí tus facturas o haz clic para explorar
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Formatos soportados: <strong>.XML</strong> (UBL 2.1 DIAN), <strong>.PDF</strong> (con IA), <strong>.ZIP</strong> o <strong>.XLSX</strong>
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2 pt-2 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                    <Sparkles className="w-3.5 h-3.5" /> Procesamiento en lote
                  </span>
                  <span>•</span>
                  <span>Detección de duplicados</span>
                  <span>•</span>
                  <span>Carga masiva Excel</span>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".xml,.pdf,.zip,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv,application/xml,text/xml,application/pdf,application/zip,application/x-zip-compressed,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Banner de acceso a importación de Excel */}
            {onAbrirCargaExcel && (
              <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-teal-600 shrink-0" />
                  <div>
                    <p className="font-bold text-teal-950 dark:text-teal-200">
                      ¿Tienes una planilla contable en Excel?
                    </p>
                    <p className="text-teal-700 dark:text-teal-400">
                      Puedes importar decenas de facturas de un solo golpe o descargar la plantilla modelo.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onCerrar();
                    onAbrirCargaExcel();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold shrink-0 transition-colors shadow-xs"
                >
                  Abrir Importador Excel
                </button>
              </div>
            )}

            {/* Resumen de Lote Procesado */}
            {itemsLote.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Archivos Cargados ({itemsLote.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                      Listos: <strong>{itemsLote.filter((i) => i.estado === 'listo').length}</strong>
                    </span>
                    {itemsLote.some((i) => i.estado === 'duplicado') && (
                      <span className="text-xs text-amber-600 font-medium">
                        Duplicados: {itemsLote.filter((i) => i.estado === 'duplicado').length}
                      </span>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                  {itemsLote.map((item) => {
                    const datos = item.datosExtraidos;

                    return (
                      <div
                        key={item.id}
                        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                            {item.tipo === 'xml' ? (
                              <FileCode className="w-5 h-5 text-emerald-600" />
                            ) : item.tipo === 'pdf' ? (
                              <FileText className="w-5 h-5 text-teal-600" />
                            ) : (
                              <Archive className="w-5 h-5 text-sky-600" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {item.nombreArchivo}
                            </p>
                            {datos ? (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                Factura <strong>{datos.folio || 'S/N'}</strong> • {datos.proveedor?.razonSocial || 'Proveedor'} • {formatCOP(datos.total)}
                              </p>
                            ) : (
                              <p className="text-[11px] text-slate-400">
                                {(item.tamano / 1024).toFixed(1)} KB
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Estado y Acciones */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          {item.estado === 'procesando' && (
                            <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                              Extrayendo datos...
                            </span>
                          )}

                          {item.estado === 'duplicado' && (
                            <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              Ya existe en sistema
                            </span>
                          )}

                          {item.estado === 'error' && (
                            <span
                              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              title={item.mensajeError}
                            >
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                              Error al leer
                            </span>
                          )}

                          {item.estado === 'listo' && (
                            <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Listo
                            </span>
                          )}

                          {/* Botón Revisar */}
                          {item.datosExtraidos && (
                            <button
                              onClick={() => setItemParaRevision(item.datosExtraidos || null)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm transition-colors"
                            >
                              <span>Revisar</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}

                          <button
                            onClick={() => handleEliminarItemLote(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                            title="Descartar de la lista"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between shrink-0">
            <button
              onClick={onCerrar}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cerrar
            </button>

            {itemsLote.some((i) => i.estado === 'listo') && (
              <button
                onClick={handleGuardarTodosLosListos}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>
                  Guardar válidos ({itemsLote.filter((i) => i.estado === 'listo').length})
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Revisión si se selecciona un archivo */}
      {itemParaRevision && (
        <RevisionFacturaModal
          borradorInicial={itemParaRevision}
          categorias={categorias}
          centrosCosto={centrosCosto}
          proveedores={proveedores}
          onGuardado={(docId) => {
            setItemParaRevision(null);
            onFacturaGuardada();
            onCerrar();
          }}
          onCerrar={() => setItemParaRevision(null)}
        />
      )}
    </>
  );
};
