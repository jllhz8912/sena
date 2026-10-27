import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FileCheck,
  AlertTriangle,
  Building,
  FileText,
  Calculator,
  ListPlus,
  Trash2,
  Eye,
  CheckCircle2,
  Calendar,
  DollarSign,
  ShieldAlert,
  Percent,
} from 'lucide-react';
import { CompraDocumento, LineaFactura, Categoria, CentroCosto, Proveedor } from '../../types';
import { formatCOP } from '../../utils/formatters';
import { dataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { resolverCategoriaId, resolverCentroCostoId } from '../../services/normalizarDocumento';

interface RevisionFacturaModalProps {
  borradorInicial: Partial<CompraDocumento>;
  categorias: Categoria[];
  centrosCosto: CentroCosto[];
  proveedores: Proveedor[];
  onGuardado: (docId: string) => void;
  onCerrar: () => void;
}

export const RevisionFacturaModal: React.FC<RevisionFacturaModalProps> = ({
  borradorInicial,
  categorias,
  centrosCosto,
  proveedores,
  onGuardado,
  onCerrar,
}) => {
  const { mostrarToast } = useToast();

  const [doc, setDoc] = useState<Partial<CompraDocumento>>(() => ({
    id: borradorInicial.id || 'doc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    tipoDocumento: borradorInicial.tipoDocumento || 'factura_electronica',
    origen: borradorInicial.origen || 'electronica',
    prefijo: borradorInicial.prefijo || '',
    folio: borradorInicial.folio || '',
    cufe: borradorInicial.cufe || '',
    fechaEmision: borradorInicial.fechaEmision || new Date().toISOString().split('T')[0],
    fechaVencimiento: borradorInicial.fechaVencimiento || borradorInicial.fechaEmision || new Date().toISOString().split('T')[0],
    formaPago: borradorInicial.formaPago || 'contado',
    medioPago: borradorInicial.medioPago || 'transferencia',
    diasCredito: borradorInicial.diasCredito || 0,
    proveedor: {
      nit: borradorInicial.proveedor?.nit || '',
      dv: borradorInicial.proveedor?.dv || '',
      razonSocial: borradorInicial.proveedor?.razonSocial || '',
      direccion: borradorInicial.proveedor?.direccion || '',
      ciudad: borradorInicial.proveedor?.ciudad || 'Bogotá D.C.',
      telefono: borradorInicial.proveedor?.telefono || '',
      email: borradorInicial.proveedor?.email || '',
    },
    adquirente: borradorInicial.adquirente,
    categoriaId: resolverCategoriaId(borradorInicial.categoriaId, borradorInicial.proveedor?.nit, { categorias, centrosCosto, proveedores }),
    centroCostoId: resolverCentroCostoId(borradorInicial.centroCostoId, borradorInicial.proveedor?.nit, { categorias, centrosCosto, proveedores }),
    esGasto:
      categorias.find(
        (c) => c.id === resolverCategoriaId(borradorInicial.categoriaId, borradorInicial.proveedor?.nit, { categorias, centrosCosto, proveedores })
      )?.esGasto ?? !!borradorInicial.esGasto,
    moneda: borradorInicial.moneda || 'COP',
    subtotal: borradorInicial.subtotal || 0,
    descuentos: borradorInicial.descuentos || 0,
    baseIva0: borradorInicial.baseIva0 || 0,
    baseIva5: borradorInicial.baseIva5 || 0,
    baseIva19: borradorInicial.baseIva19 || 0,
    iva5: borradorInicial.iva5 || 0,
    iva19: borradorInicial.iva19 || 0,
    totalIva: borradorInicial.totalIva || 0,
    impoconsumo: borradorInicial.impoconsumo || 0,
    reteFuente: borradorInicial.reteFuente || 0,
    porcentajeReteFuente: borradorInicial.porcentajeReteFuente || 0,
    reteIva: borradorInicial.reteIva || 0,
    porcentajeReteIva: borradorInicial.porcentajeReteIva || 0,
    reteIca: borradorInicial.reteIca || 0,
    porcentajeReteIca: borradorInicial.porcentajeReteIca || 0,
    totalRetenciones: borradorInicial.totalRetenciones || 0,
    total: borradorInicial.total || 0,
    saldoPendiente: borradorInicial.saldoPendiente !== undefined ? borradorInicial.saldoPendiente : borradorInicial.total || 0,
    estadoPago: borradorInicial.estadoPago || (borradorInicial.formaPago === 'contado' ? 'pagada' : 'pendiente'),
    fechaPago: borradorInicial.fechaPago,
    lineas: borradorInicial.lineas || [],
    archivoAdjunto: borradorInicial.archivoAdjunto,
    observaciones: borradorInicial.observaciones || '',
    metadatosExtraccion: borradorInicial.metadatosExtraccion,
    pagos: borradorInicial.pagos || [],
    historialCambios: borradorInicial.historialCambios || [
      {
        fecha: new Date().toISOString(),
        usuario: 'Sistema',
        accion: 'Extracción de documento',
        detalle: borradorInicial.metadatosExtraccion?.motor === 'gemini_flash' ? 'Extracción con Gemini AI' : 'Extracción XML UBL 2.1',
      },
    ],
    creadoEn: borradorInicial.creadoEn || new Date().toISOString(),
    actualizadoEn: new Date().toISOString(),
  }));

  const [duplicadoExistente, setDuplicadoExistente] = useState<CompraDocumento | null>(null);
  const [forzarGuardadoDuplicado, setForzarGuardadoDuplicado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Comprobar duplicados
  useEffect(() => {
    let activo = true;
    async function check() {
      if (!doc.folio && !doc.cufe) return;
      const dup = await dataService.buscarDuplicado(doc.cufe, doc.proveedor?.nit, doc.folio, doc.prefijo);
      if (activo) {
        setDuplicadoExistente(dup);
      }
    }
    check();
    return () => {
      activo = false;
    };
  }, [doc.cufe, doc.proveedor?.nit, doc.folio, doc.prefijo]);

  // Verificación matemática de cuadre
  const cuadreCalculado = useMemo(() => {
    const sub = Number(doc.subtotal) || 0;
    const desc = Number(doc.descuentos) || 0;
    const iva = Number(doc.totalIva) || 0;
    const inc = Number(doc.impoconsumo) || 0;
    const ret = Number(doc.totalRetenciones) || 0;
    const tot = Number(doc.total) || 0;

    const esperadoSinRet = sub - desc + iva + inc;
    const esperadoConRet = esperadoSinRet - ret;

    const diferencia = Math.abs(esperadoConRet - tot);
    const cuadrado = diferencia <= 2; // Tolerancia de $2 pesos por redondeos en líneas

    return {
      esperadoConRet,
      diferencia: Math.round(esperadoConRet - tot),
      cuadrado,
    };
  }, [doc.subtotal, doc.descuentos, doc.totalIva, doc.impoconsumo, doc.totalRetenciones, doc.total]);

  // Recalcular retenciones totales
  const actualizarRetenciones = (campo: 'reteFuente' | 'reteIva' | 'reteIca', valor: number) => {
    setDoc((prev) => {
      const nuevo = { ...prev, [campo]: valor };
      const totalRet = (nuevo.reteFuente || 0) + (nuevo.reteIva || 0) + (nuevo.reteIca || 0);
      return { ...nuevo, totalRetenciones: totalRet };
    });
  };

  // Recalcular IVA total al modificar sub-bases
  const actualizarIva = (tarifa: '5' | '19', valorIva: number, valorBase?: number) => {
    setDoc((prev) => {
      const base5 = tarifa === '5' && valorBase !== undefined ? valorBase : prev.baseIva5 || 0;
      const base19 = tarifa === '19' && valorBase !== undefined ? valorBase : prev.baseIva19 || 0;
      const iva5 = tarifa === '5' ? valorIva : prev.iva5 || 0;
      const iva19 = tarifa === '19' ? valorIva : prev.iva19 || 0;
      const totalIva = iva5 + iva19;

      return {
        ...prev,
        baseIva5: base5,
        baseIva19: base19,
        iva5,
        iva19,
        totalIva,
      };
    });
  };

  // Manipular líneas de factura
  const handleCambioLinea = (id: string, campo: keyof LineaFactura, valor: any) => {
    setDoc((prev) => {
      const lineas = (prev.lineas || []).map((l) => {
        if (l.id !== id) return l;

        const actualizada = { ...l, [campo]: valor };

        // Si cambió cantidad o precio unitario o descuento o % IVA, recalcular
        if (['cantidad', 'valorUnitario', 'descuento', 'porcentajeIva'].includes(campo)) {
          const qty = Number(actualizada.cantidad) || 0;
          const unit = Number(actualizada.valorUnitario) || 0;
          const desc = Number(actualizada.descuento) || 0;
          const ivaPct = Number(actualizada.porcentajeIva) || 0;

          const baseLinea = Math.max(0, qty * unit - desc);
          const valorIva = Math.round((baseLinea * ivaPct) / 100);
          actualizada.valorIva = valorIva;
          actualizada.totalLinea = baseLinea + valorIva;
        }

        return actualizada;
      });

      return { ...prev, lineas };
    });
  };

  const handleEliminarLinea = (id: string) => {
    setDoc((prev) => ({
      ...prev,
      lineas: (prev.lineas || []).filter((l) => l.id !== id),
    }));
  };

  const handleAgregarLinea = () => {
    const nueva: LineaFactura = {
      id: 'lin-' + Date.now(),
      descripcion: 'Nuevo insumo / producto veterinario',
      cantidad: 1,
      unidad: 'UND',
      valorUnitario: 0,
      descuento: 0,
      porcentajeIva: 19,
      valorIva: 0,
      totalLinea: 0,
    };
    setDoc((prev) => ({
      ...prev,
      lineas: [...(prev.lineas || []), nueva],
    }));
  };

  const handleConfirmarGuardado = async () => {
    if (!doc.folio) {
      mostrarToast('warning', 'Folio requerido', 'Por favor ingresa el número o folio de la factura.');
      return;
    }
    if (!doc.proveedor?.razonSocial || !doc.proveedor?.nit) {
      mostrarToast('warning', 'Proveedor incompleto', 'El NIT y Razón Social del proveedor son obligatorios.');
      return;
    }
    if (duplicadoExistente && !forzarGuardadoDuplicado) {
      mostrarToast(
        'warning',
        'Documento Duplicado',
        'Ya existe un documento con este CUFE o NIT + Factura. Marca la casilla de confirmación para guardar.'
      );
      return;
    }

    try {
      setGuardando(true);
      // Notas crédito (valores negativos) y pagos de contado no generan cuenta por pagar
      const sinSaldo = doc.formaPago === 'contado' || doc.tipoDocumento === 'nota_credito' || Number(doc.total || 0) <= 0;
      const docParaGuardar = {
        ...doc,
        saldoPendiente: sinSaldo ? 0 : Math.max(0, Number(doc.total || 0) - Math.abs(Number(doc.totalRetenciones || 0))),
        estadoPago: sinSaldo ? 'pagada' : (doc.estadoPago || 'pendiente'),
        fechaPago: sinSaldo ? doc.fechaEmision : doc.fechaPago,
      } as CompraDocumento;

      const guardadoId = await dataService.guardarDocumento(docParaGuardar);
      mostrarToast('success', 'Documento Guardado', `Factura ${doc.folio} registrada exitosamente.`);
      onGuardado(guardadoId);
    } catch (err: any) {
      mostrarToast('error', 'Error al guardar', err?.message);
    } finally {
      setGuardando(false);
    }
  };

  const camposDudosos = doc.metadatosExtraccion?.camposDudosos || [];
  const esDudoso = (campo: string) => camposDudosos.some((c) => c.toLowerCase().includes(campo.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-hidden animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Revisión de Factura Extraída
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {doc.archivoAdjunto?.nombre || 'Archivo original'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verifica los datos extraídos automáticamente antes de confirmar y archivar en la base de datos.
              </p>
            </div>
          </div>

          <button
            onClick={onCerrar}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alerta de Confianza Baja o Campos Dudosos */}
        {doc.metadatosExtraccion?.confianzaBaja && (
          <div className="px-6 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 flex items-center gap-3 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Revisión recomendada:</strong>{' '}
              {[...camposDudosos, ...(doc.metadatosExtraccion?.advertencias || [])].join(' • ') || 'revisa los valores resaltados'}
            </span>
          </div>
        )}

        {/* Alerta de Duplicado */}
        {duplicadoExistente && (
          <div className="px-6 py-3 bg-rose-50 dark:bg-rose-950/50 border-b border-rose-300 dark:border-rose-900 flex items-center justify-between text-xs text-rose-900 dark:text-rose-200">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <div>
                <p className="font-bold">¡Alerta de Factura Duplicada!</p>
                <p>
                  Ya existe un documento registrado con este CUFE o NIT ({duplicadoExistente.proveedor?.nit}) y Folio ({duplicadoExistente.folio}) emitido el {duplicadoExistente.fechaEmision} por valor de {formatCOP(duplicadoExistente.total)}.
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 font-medium cursor-pointer shrink-0 ml-4">
              <input
                type="checkbox"
                checked={forzarGuardadoDuplicado}
                onChange={(e) => setForzarGuardadoDuplicado(e.target.checked)}
                className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
              />
              <span>Deseo guardar de todos modos</span>
            </label>
          </div>
        )}

        {/* Modal Body: Split View (Archivo a la izquierda, Formulario a la derecha) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
          {/* Panel Izquierdo: Visor de Archivo Original (4 columnas) */}
          <div className="lg:col-span-5 border-r border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/60 flex flex-col min-h-0">
            <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Eye className="w-4 h-4 text-emerald-600" />
                <span>Archivo Original Adjunto</span>
              </div>
              <span className="text-[11px] font-mono uppercase text-slate-400">
                {doc.archivoAdjunto?.tipo?.toUpperCase()}
              </span>
            </div>

            <div className="flex-1 p-2 overflow-auto flex items-center justify-center">
              {doc.archivoAdjunto?.tipo === 'pdf' && doc.archivoAdjunto?.dataUrl ? (
                <iframe
                  src={doc.archivoAdjunto.dataUrl}
                  title="Visor de PDF de Factura"
                  className="w-full h-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white"
                />
              ) : doc.archivoAdjunto?.contenidoXml ? (
                <div className="w-full h-full p-4 font-mono text-[11px] leading-relaxed bg-slate-900 text-emerald-400 rounded-lg overflow-auto select-text">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400 text-xs font-sans">
                    <span>Estructura XML UBL 2.1</span>
                    <span>{doc.archivoAdjunto.nombre}</span>
                  </div>
                  <pre className="whitespace-pre-wrap break-all">
                    {doc.archivoAdjunto.contenidoXml.slice(0, 5000)}
                    {doc.archivoAdjunto.contenidoXml.length > 5000 && '\n\n... [Contenido extenso truncado para vista previa]'}
                  </pre>
                </div>
              ) : (
                <div className="text-center p-8 text-slate-400">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">Archivo no previsualizable</p>
                  <p className="text-xs">{doc.archivoAdjunto?.nombre}</p>
                </div>
              )}
            </div>
          </div>

          {/* Panel Derecho: Formulario de Revisión Editable (7 columnas) */}
          <div className="lg:col-span-7 flex flex-col min-h-0 bg-white dark:bg-slate-900">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Sección 1: Encabezado del Documento */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-900 dark:text-white">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>Datos del Documento</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Tipo de Documento
                    </label>
                    <select
                      value={doc.tipoDocumento}
                      onChange={(e) => setDoc({ ...doc, tipoDocumento: e.target.value as any })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                    >
                      <option value="factura_electronica">Factura Electrónica</option>
                      <option value="factura_papel">Factura de Papel</option>
                      <option value="documento_soporte">Documento Soporte</option>
                      <option value="cuenta_cobro">Cuenta de Cobro</option>
                      <option value="recibo_caja">Recibo de Caja</option>
                      <option value="tiquete_pos">Tiquete POS</option>
                      <option value="servicios_publicos">Servicios Públicos</option>
                      <option value="nota_credito">Nota Crédito (resta)</option>
                      <option value="nota_debito">Nota Débito</option>
                      <option value="nomina_honorarios">Nómina / Honorarios</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Prefijo
                    </label>
                    <input
                      type="text"
                      value={doc.prefijo || ''}
                      onChange={(e) => setDoc({ ...doc, prefijo: e.target.value })}
                      placeholder="Ej: FE, SETP"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                    >
                    </input>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Número / Folio *
                    </label>
                    <input
                      type="text"
                      value={doc.folio || ''}
                      onChange={(e) => setDoc({ ...doc, folio: e.target.value })}
                      required
                      placeholder="Número de factura"
                      className={`w-full px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-800 font-bold ${
                        esDudoso('folio')
                          ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Fecha de Emisión *
                    </label>
                    <input
                      type="date"
                      value={doc.fechaEmision || ''}
                      onChange={(e) => setDoc({ ...doc, fechaEmision: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Fecha de Vencimiento
                    </label>
                    <input
                      type="date"
                      value={doc.fechaVencimiento || ''}
                      onChange={(e) => setDoc({ ...doc, fechaVencimiento: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Forma de Pago
                    </label>
                    <select
                      value={doc.formaPago}
                      onChange={(e) =>
                        setDoc({
                          ...doc,
                          formaPago: e.target.value as any,
                          estadoPago: e.target.value === 'contado' ? 'pagada' : 'pendiente',
                        })
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                    >
                      <option value="contado">Contado</option>
                      <option value="credito">Crédito</option>
                    </select>
                  </div>
                </div>

                {doc.cufe && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      CUFE / CUDE (DIAN)
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={doc.cufe}
                      className="w-full px-3 py-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 truncate"
                    />
                  </div>
                )}
              </div>

              {/* Sección 2: Proveedor */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-900 dark:text-white">
                  <Building className="w-4 h-4 text-emerald-600" />
                  <span>Proveedor</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-4">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      NIT / Identificación *
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={doc.proveedor?.nit || ''}
                        onChange={(e) =>
                          setDoc({
                            ...doc,
                            proveedor: { ...(doc.proveedor as any), nit: e.target.value },
                          })
                        }
                        placeholder="Sin DV"
                        className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                      />
                      {doc.proveedor?.dv && (
                        <input
                          type="text"
                          value={doc.proveedor.dv}
                          readOnly
                          className="w-10 text-center px-1 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono"
                          title="Dígito de verificación"
                        />
                      )}
                    </div>
                  </div>

                  <div className="sm:col-span-8">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Razón Social / Nombre *
                    </label>
                    <input
                      type="text"
                      value={doc.proveedor?.razonSocial || ''}
                      onChange={(e) =>
                        setDoc({
                          ...doc,
                          proveedor: { ...(doc.proveedor as any), razonSocial: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Ciudad
                    </label>
                    <input
                      type="text"
                      value={doc.proveedor?.ciudad || ''}
                      onChange={(e) =>
                        setDoc({
                          ...doc,
                          proveedor: { ...(doc.proveedor as any), ciudad: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Teléfono
                    </label>
                    <input
                      type="text"
                      value={doc.proveedor?.telefono || ''}
                      onChange={(e) =>
                        setDoc({
                          ...doc,
                          proveedor: { ...(doc.proveedor as any), telefono: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      value={doc.proveedor?.email || ''}
                      onChange={(e) =>
                        setDoc({
                          ...doc,
                          proveedor: { ...(doc.proveedor as any), email: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 3: Clasificación Veterinaria */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-900 dark:text-white">
                  <Calculator className="w-4 h-4 text-emerald-600" />
                  <span>Clasificación Contable Veterinaria</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Categoría
                    </label>
                    <select
                      value={doc.categoriaId}
                      onChange={(e) => {
                        const cat = categorias.find((c) => c.id === e.target.value);
                        setDoc({
                          ...doc,
                          categoriaId: e.target.value,
                          esGasto: cat ? cat.esGasto : doc.esGasto,
                        });
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                    >
                      {categorias.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre} {c.esGasto ? '(Gasto Operativo)' : '(Compra Insumo/Inventario)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Centro de Costo
                    </label>
                    <select
                      value={doc.centroCostoId}
                      onChange={(e) => setDoc({ ...doc, centroCostoId: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                    >
                      {centrosCosto.map((cc) => (
                        <option key={cc.id} value={cc.id}>
                          {cc.codigo} - {cc.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Sección 4: Bases Gravables, IVA y Retenciones */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <span>Totales, Bases Gravables e Impuestos</span>
                  </div>

                  {/* Badge de Verificación Matemática */}
                  {cuadreCalculado.cuadrado ? (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Matemáticamente cuadrado
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Diferencia de {formatCOP(cuadreCalculado.diferencia)}
                    </span>
                  )}
                </div>

                {/* Subtotal y Descuentos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Subtotal Bruto (COP)
                    </label>
                    <input
                      type="number"
                      value={doc.subtotal || 0}
                      onChange={(e) => setDoc({ ...doc, subtotal: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Descuentos (COP)
                    </label>
                    <input
                      type="number"
                      value={doc.descuentos || 0}
                      onChange={(e) => setDoc({ ...doc, descuentos: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>

                {/* Discriminación de IVA por Tarifa (Formulario 300 DIAN) */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-emerald-600" />
                    Discriminación de IVA (Formulario 300 DIAN)
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Base Gravable 19%</label>
                      <input
                        type="number"
                        value={doc.baseIva19 || 0}
                        onChange={(e) => actualizarIva('19', doc.iva19 || 0, Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">IVA 19% (COP)</label>
                      <input
                        type="number"
                        value={doc.iva19 || 0}
                        onChange={(e) => actualizarIva('19', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Base 0% / Exenta</label>
                      <input
                        type="number"
                        value={doc.baseIva0 || 0}
                        onChange={(e) => setDoc({ ...doc, baseIva0: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Base Gravable 5% (Alimentos)</label>
                      <input
                        type="number"
                        value={doc.baseIva5 || 0}
                        onChange={(e) => actualizarIva('5', doc.iva5 || 0, Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">IVA 5% (COP)</label>
                      <input
                        type="number"
                        value={doc.iva5 || 0}
                        onChange={(e) => actualizarIva('5', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Impoconsumo (INC)</label>
                      <input
                        type="number"
                        value={doc.impoconsumo || 0}
                        onChange={(e) => setDoc({ ...doc, impoconsumo: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* Retenciones Practicadas (Formulario 350) */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Retenciones Practicadas (Formulario 350)
                    </p>
                    <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                      Total Retenciones: - {formatCOP(doc.totalRetenciones)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">ReteFuente (COP)</label>
                      <input
                        type="number"
                        value={doc.reteFuente || 0}
                        onChange={(e) => actualizarRetenciones('reteFuente', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">ReteIVA (COP)</label>
                      <input
                        type="number"
                        value={doc.reteIva || 0}
                        onChange={(e) => actualizarRetenciones('reteIva', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">ReteICA (COP)</label>
                      <input
                        type="number"
                        value={doc.reteIca || 0}
                        onChange={(e) => actualizarRetenciones('reteIca', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* Total a Pagar Definitivo */}
                <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs uppercase font-bold tracking-wider text-emerald-900 dark:text-emerald-300">
                      Total a Pagar (Factura)
                    </span>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      Subtotal + IVA + INC - Retenciones
                    </p>
                  </div>
                  <div className="w-48">
                    <input
                      type="number"
                      value={doc.total || 0}
                      onChange={(e) => setDoc({ ...doc, total: Number(e.target.value) })}
                      className="w-full text-right text-lg font-black px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-emerald-900 dark:text-emerald-200"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 5: Detalle de Líneas de Factura */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <ListPlus className="w-4 h-4 text-emerald-600" />
                    <span>Líneas e Ítems Comprados ({(doc.lineas || []).length})</span>
                  </div>
                  <button
                    onClick={handleAgregarLinea}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    + Agregar ítem
                  </button>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {(doc.lineas || []).map((linea, idx) => (
                    <div
                      key={linea.id || idx}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs space-y-2"
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={linea.descripcion}
                            onChange={(e) => handleCambioLinea(linea.id, 'descripcion', e.target.value)}
                            placeholder="Descripción del ítem"
                            className="w-full px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                          />
                        </div>
                        <button
                          onClick={() => handleEliminarLinea(linea.id)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                          title="Eliminar ítem"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                        <div>
                          <label className="text-slate-500 block mb-0.5">Cant.</label>
                          <input
                            type="number"
                            value={linea.cantidad}
                            onChange={(e) => handleCambioLinea(linea.id, 'cantidad', e.target.value)}
                            className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-slate-500 block mb-0.5">Unidad</label>
                          <input
                            type="text"
                            value={linea.unidad}
                            onChange={(e) => handleCambioLinea(linea.id, 'unidad', e.target.value)}
                            className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-slate-500 block mb-0.5">Valor Unitario</label>
                          <input
                            type="number"
                            value={linea.valorUnitario}
                            onChange={(e) => handleCambioLinea(linea.id, 'valorUnitario', e.target.value)}
                            className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-slate-500 block mb-0.5">% IVA</label>
                          <select
                            value={linea.porcentajeIva}
                            onChange={(e) => handleCambioLinea(linea.id, 'porcentajeIva', Number(e.target.value))}
                            className="w-full px-1.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={19}>19%</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-slate-500 block mb-0.5">Total Línea</label>
                          <div className="font-bold text-slate-800 dark:text-slate-100 py-1">
                            {formatCOP(linea.totalLinea)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Observaciones internas
                </label>
                <textarea
                  rows={2}
                  value={doc.observaciones || ''}
                  onChange={(e) => setDoc({ ...doc, observaciones: e.target.value })}
                  placeholder="Detalles de entrega, lotes, prescripción o notas contables..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            {/* Footer con Acciones */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={onCerrar}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500">
                  Total a guardar: <strong className="text-slate-900 dark:text-white">{formatCOP(doc.total)}</strong>
                </span>

                <button
                  type="button"
                  onClick={handleConfirmarGuardado}
                  disabled={guardando || (!!duplicadoExistente && !forzarGuardadoDuplicado)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>{guardando ? 'Guardando...' : 'Confirmar y Guardar'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
