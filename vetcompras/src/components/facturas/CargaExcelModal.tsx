import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  UploadCloud,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  Trash2,
  ShieldAlert,
  FileCheck,
  Save,
  HelpCircle,
} from 'lucide-react';
import { CompraDocumento, Categoria, CentroCosto, Proveedor } from '../../types';
import { procesarExcelFacturas, descargarPlantillaExcel, FilaFacturaExcel } from '../../services/excelService';
import { dataService } from '../../services/dataService';
import { formatCOP, formatFecha } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';

interface CargaExcelModalProps {
  categorias: Categoria[];
  centrosCosto: CentroCosto[];
  proveedores: Proveedor[];
  onFacturasImportadas: () => void;
  onCerrar: () => void;
}

export const CargaExcelModal: React.FC<CargaExcelModalProps> = ({
  categorias,
  centrosCosto,
  proveedores,
  onFacturasImportadas,
  onCerrar,
}) => {
  const { mostrarToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [arrastrando, setArrastrando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [filas, setFilas] = useState<FilaFacturaExcel[]>([]);
  const [duplicadosMap, setDuplicadosMap] = useState<Record<number, boolean>>({});
  const [filtroVista, setFiltroVista] = useState<'todas' | 'validas' | 'errores'>('todas');
  const [ignorarDuplicados, setIgnorarDuplicados] = useState(true);
  const [reemplazarExistentes, setReemplazarExistentes] = useState(false);
  const [guardando, setGuardando] = useState(false);

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
      cargarArchivoExcel(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      cargarArchivoExcel(e.target.files[0]);
      e.target.value = '';
    }
  };

  const cargarArchivoExcel = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      mostrarToast('error', 'Formato no soportado', 'Por favor selecciona un archivo Excel (.xlsx, .xls) o .csv');
      return;
    }

    try {
      setProcesando(true);
      setNombreArchivo(file.name);

      const resultado = await procesarExcelFacturas(file);
      setFilas(resultado.filas);

      // Comprobar duplicados contra la base de datos
      const mapDup: Record<number, boolean> = {};
      for (const fila of resultado.filas) {
        if (fila.folio && fila.nitProveedor) {
          const dup = await dataService.buscarDuplicado(fila.cufe, fila.nitProveedor, fila.folio);
          if (dup) {
            mapDup[fila.lineaExcel] = true;
          }
        }
      }
      setDuplicadosMap(mapDup);

      if (resultado.filas.length === 0) {
        mostrarToast('warning', 'Archivo sin datos', 'No se encontraron filas con información en la hoja de Excel.');
      } else {
        mostrarToast(
          'info',
          'Archivo leído',
          `Se extrajeron ${resultado.filas.length} registros (${resultado.totalValidas} válidos).`
        );
      }
    } catch (err: any) {
      console.error('Error al procesar Excel:', err);
      mostrarToast('error', 'Error al leer Excel', err?.message || 'Verifica la estructura del archivo.');
    } finally {
      setProcesando(false);
    }
  };

  // Mapear nombre de categoría a ID existente o sugerido
  const resolverCategoriaId = (nombreCat?: string): string => {
    if (!nombreCat) return 'cat-medicamentos';
    const clean = nombreCat.toLowerCase();
    const match = categorias.find(
      (c) => c.nombre.toLowerCase().includes(clean) || clean.includes(c.nombre.toLowerCase())
    );
    return match ? match.id : 'cat-medicamentos';
  };

  // Mapear nombre de centro de costo
  const resolverCentroCostoId = (nombreCC?: string): string => {
    if (!nombreCC) return 'cc-clinica';
    const clean = nombreCC.toLowerCase();
    const match = centrosCosto.find(
      (cc) => cc.nombre.toLowerCase().includes(clean) || clean.includes(cc.nombre.toLowerCase())
    );
    return match ? match.id : 'cc-clinica';
  };

  // Guardar facturas válidas en lote
  const handleConfirmarImportacion = async () => {
    const candidatas = filas.filter((f) => {
      if (!f.esValida) return false;
      if (ignorarDuplicados && duplicadosMap[f.lineaExcel]) return false;
      return true;
    });

    if (candidatas.length === 0) {
      mostrarToast('warning', 'Sin registros para importar', 'No hay registros válidos disponibles para archivar.');
      return;
    }

    try {
      setGuardando(true);

      // Si el usuario eligió reemplazar facturas existentes
      if (reemplazarExistentes) {
        await dataService.limpiarTodosLosDatos();
      }

      let importadas = 0;

      for (const f of candidatas) {
        const catId = resolverCategoriaId(f.categoriaNombre);
        const ccId = resolverCentroCostoId(f.centroCostoNombre);
        const catObj = categorias.find((c) => c.id === catId);

        const doc: CompraDocumento = {
          id: 'doc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
          tipoDocumento: f.tipoDocumento as any,
          origen: f.tipoDocumento === 'factura_electronica' ? 'electronica' : 'manual',
          prefijo: f.prefijo || '',
          folio: f.folio,
          cufe: f.cufe,
          fechaEmision: f.fechaEmision,
          fechaVencimiento: f.fechaVencimiento || f.fechaEmision,
          formaPago: f.formaPago,
          medioPago: f.medioPago || 'transferencia',
          proveedor: {
            nit: f.nitProveedor,
            dv: f.dvProveedor,
            razonSocial: f.razonSocialProveedor,
            telefono: f.telefonoProveedor,
            email: f.emailProveedor,
            ciudad: f.ciudadProveedor || 'Bogotá D.C.',
          },
          categoriaId: catId,
          centroCostoId: ccId,
          esGasto: catObj ? catObj.esGasto : false,
          moneda: 'COP',
          subtotal: f.subtotal,
          descuentos: 0,
          baseIva0: f.iva === 0 ? f.subtotal : 0,
          baseIva5: f.tarifaIva === 5 ? f.subtotal : 0,
          baseIva19: f.tarifaIva === 19 || (f.tarifaIva === undefined && f.iva > 0) ? f.subtotal : 0,
          iva5: f.tarifaIva === 5 ? f.iva : 0,
          iva19: f.tarifaIva === 19 || (f.tarifaIva === undefined && f.iva > 0) ? f.iva : 0,
          totalIva: f.iva,
          impoconsumo: 0,
          reteFuente: f.reteFuente || 0,
          reteIva: f.reteIva || 0,
          reteIca: f.reteIca || 0,
          totalRetenciones: (f.reteFuente || 0) + (f.reteIva || 0) + (f.reteIca || 0),
          total: f.total,
          saldoPendiente: f.estadoPago === 'pagada' ? 0 : f.total,
          estadoPago: f.estadoPago,
          fechaPago: f.estadoPago === 'pagada' ? f.fechaEmision : undefined,
          lineas: [
            {
              id: 'lin-excel-1',
              descripcion: f.observaciones || `Compra factura ${f.folio} (${f.categoriaNombre || 'Insumo'})`,
              cantidad: 1,
              unidad: 'UND',
              valorUnitario: f.subtotal,
              descuento: 0,
              porcentajeIva: f.iva > 0 ? (f.tarifaIva || 19) : 0,
              valorIva: f.iva,
              totalLinea: f.subtotal + f.iva,
            },
          ],
          observaciones: f.observaciones,
          pagos:
            f.estadoPago === 'pagada'
              ? [
                  {
                    id: 'pago-excel-' + Date.now(),
                    fecha: f.fechaEmision,
                    monto: f.total,
                    medio: f.medioPago || 'transferencia',
                    nota: 'Pago registrado desde importación Excel',
                  },
                ]
              : [],
          historialCambios: [
            {
              fecha: new Date().toISOString(),
              usuario: 'Usuario actual',
              accion: 'Importación masiva desde archivo Excel',
              detalle: `Archivo origen: ${nombreArchivo}`,
            },
          ],
          creadoEn: new Date().toISOString(),
          actualizadoEn: new Date().toISOString(),
        };

        await dataService.guardarDocumento(doc);
        importadas++;
      }

      mostrarToast('success', 'Importación completada', `Se registraron ${importadas} facturas en el sistema.`);
      onFacturasImportadas();
      onCerrar();
    } catch (err: any) {
      console.error('Error al guardar facturas de Excel:', err);
      mostrarToast('error', 'Error al importar', err?.message);
    } finally {
      setGuardando(false);
    }
  };

  // Contadores
  const totalValidas = filas.filter((f) => f.esValida).length;
  const totalErrores = filas.filter((f) => !f.esValida).length;
  const totalDuplicadas = filas.filter((f) => duplicadosMap[f.lineaExcel]).length;

  const filasFiltradas = filas.filter((f) => {
    if (filtroVista === 'validas') return f.esValida;
    if (filtroVista === 'errores') return !f.esValida || duplicadosMap[f.lineaExcel];
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-hidden animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Importar Facturas desde Excel (.xlsx / .csv)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Plantilla sencilla de solo 7 datos: Fecha, NIT, Nombre, Factura, Valor, Medio de pago y CUFE.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={descargarPlantillaExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 transition-colors"
              title="Descargar plantilla de Excel sencilla con solo 7 campos"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar Plantilla Sencilla</span>
            </button>

            <button
              onClick={onCerrar}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Zona de Carga si no hay archivo procesado */}
          {filas.length === 0 ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all ${
                arrastrando
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 scale-[0.99]'
                  : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500/80 bg-slate-50/60 dark:bg-slate-800/30 hover:bg-emerald-50/20'
              }`}
            >
              {procesando ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Procesando libro de Excel...
                  </p>
                </div>
              ) : (
                <div className="max-w-md mx-auto space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
                    <FileSpreadsheet className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-800 dark:text-slate-100">
                      Arrastra tu archivo Excel aquí o haz clic para seleccionarlo
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Formatos compatibles: <strong>.XLSX</strong>, <strong>.XLS</strong> o <strong>.CSV</strong>
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Estructura requerida: <strong>Fecha</strong>, <strong>NIT</strong>, <strong>Nombre</strong>, <strong>Número de Factura</strong>, <strong>Valor Facturado</strong>, <strong>Medio de Pago</strong> y <strong>CUFE</strong>.
                  </p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          ) : (
            /* Vista Previa de Filas */
            <div className="space-y-4">
              {/* Barra de Resumen y Controles */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-xs">
                    📄 {nombreArchivo}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span>{filas.length} filas leídas</span>
                  <span className="text-emerald-600 font-semibold">({totalValidas} válidas)</span>
                  {totalDuplicadas > 0 && (
                    <span className="text-amber-600 font-semibold">({totalDuplicadas} duplicadas)</span>
                  )}
                  {totalErrores > 0 && (
                    <span className="text-rose-600 font-semibold">({totalErrores} con error)</span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* Filtro de Vista */}
                  <div className="flex rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-0.5">
                    <button
                      onClick={() => setFiltroVista('todas')}
                      className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] ${
                        filtroVista === 'todas'
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                          : 'text-slate-500'
                      }`}
                    >
                      Todas ({filas.length})
                    </button>
                    <button
                      onClick={() => setFiltroVista('validas')}
                      className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] ${
                        filtroVista === 'validas'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'text-slate-500'
                      }`}
                    >
                      Válidas ({totalValidas})
                    </button>
                    {(totalErrores > 0 || totalDuplicadas > 0) && (
                      <button
                        onClick={() => setFiltroVista('errores')}
                        className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] ${
                          filtroVista === 'errores'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : 'text-slate-500'
                        }`}
                      >
                        Alertas ({totalErrores + totalDuplicadas})
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setFilas([]);
                      setNombreArchivo('');
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                    title="Cargar otro archivo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Opción de Reemplazar / Limpiar Facturas de Prueba */}
              <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-emerald-950 dark:text-emerald-200">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    ¿Reemplazar facturas anteriores? Marca esto si deseas eliminar facturas previas de prueba y dejar <strong>únicamente</strong> las de este archivo.
                  </span>
                </div>
                <label className="flex items-center gap-2 font-bold cursor-pointer text-emerald-800 dark:text-emerald-300 shrink-0">
                  <input
                    type="checkbox"
                    checked={reemplazarExistentes}
                    onChange={(e) => setReemplazarExistentes(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Reemplazar todas las existentes</span>
                </label>
              </div>

              {/* Casilla de Duplicados */}
              {totalDuplicadas > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Se detectaron {totalDuplicadas} facturas que ya existen en el sistema (por CUFE o NIT + Factura).</span>
                  </div>
                  <label className="flex items-center gap-2 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ignorarDuplicados}
                      onChange={(e) => setIgnorarDuplicados(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Omitir duplicadas al importar</span>
                  </label>
                </div>
              )}

              {/* Tabla de Vista Previa */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-semibold sticky top-0 z-10">
                      <tr>
                        <th className="p-2.5 w-12 text-center">Fila</th>
                        <th className="p-2.5">Estado</th>
                        <th className="p-2.5">Fecha</th>
                        <th className="p-2.5">NIT</th>
                        <th className="p-2.5">Nombre Proveedor</th>
                        <th className="p-2.5">Número Factura</th>
                        <th className="p-2.5 text-right">Valor Facturado</th>
                        <th className="p-2.5">Medio de Pago</th>
                        <th className="p-2.5">CUFE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filasFiltradas.map((f) => {
                        const esDuplicada = !!duplicadosMap[f.lineaExcel];

                        return (
                          <tr
                            key={f.lineaExcel}
                            className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                              !f.esValida
                                ? 'bg-rose-50/30 dark:bg-rose-950/20'
                                : esDuplicada
                                ? 'bg-amber-50/30 dark:bg-amber-950/20'
                                : ''
                            }`}
                          >
                            <td className="p-2.5 text-center text-slate-400 font-mono text-[11px]">
                              {f.lineaExcel}
                            </td>

                            <td className="p-2.5 whitespace-nowrap">
                              {!f.esValida ? (
                                <span
                                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                  title={f.errores.join(', ')}
                                >
                                  Error: {f.errores[0]}
                                </span>
                              ) : esDuplicada ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                  Duplicada
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                  ✓ Válida
                                </span>
                              )}
                            </td>

                            <td className="p-2.5 whitespace-nowrap">{formatFecha(f.fechaEmision)}</td>

                            <td className="p-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {f.nitProveedor}
                              {f.dvProveedor ? `-${f.dvProveedor}` : ''}
                            </td>

                            <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[180px]">
                              {f.razonSocialProveedor || '—'}
                            </td>

                            <td className="p-2.5 font-bold whitespace-nowrap text-emerald-800 dark:text-emerald-300">
                              {f.prefijo ? `${f.prefijo}-${f.folio}` : f.folio || '—'}
                            </td>

                            <td className="p-2.5 text-right font-black font-mono text-slate-900 dark:text-white">
                              {formatCOP(f.total)}
                            </td>

                            <td className="p-2.5 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {f.medioPago || 'Transferencia'}
                              </span>
                            </td>

                            <td className="p-2.5 font-mono text-[10px] text-slate-400 truncate max-w-[140px]" title={f.cufe || 'Sin CUFE'}>
                              {f.cufe ? `${f.cufe.substring(0, 14)}...` : <span className="italic text-slate-400 font-sans">No aplica</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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

          {filas.length > 0 && (
            <button
              onClick={handleConfirmarImportacion}
              disabled={guardando || totalValidas === 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/25 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>
                {guardando
                  ? 'Guardando en la base de datos...'
                  : `Confirmar e Importar ${
                      ignorarDuplicados ? totalValidas - totalDuplicadas : totalValidas
                    } Facturas`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
