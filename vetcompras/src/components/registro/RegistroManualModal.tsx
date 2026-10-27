import React, { useState } from 'react';
import {
  X,
  FilePenLine,
  Building,
  Plus,
  Trash2,
  Paperclip,
  CheckCircle2,
  DollarSign,
  Calendar,
  AlertCircle,
  FileText,
  UserCheck,
  Percent,
} from 'lucide-react';
import {
  CompraDocumento,
  LineaFactura,
  TipoDocumento,
  Categoria,
  CentroCosto,
  Proveedor,
  FormaPago,
  EstadoPago,
} from '../../types';
import { formatCOP, fechaLocal } from '../../utils/formatters';
import { dataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';

interface RegistroManualModalProps {
  categorias: Categoria[];
  centrosCosto: CentroCosto[];
  proveedores: Proveedor[];
  documentoParaEditar?: CompraDocumento;
  onGuardado: (docId: string) => void;
  onCerrar: () => void;
  onProveedorCreado: () => void;
}

export const RegistroManualModal: React.FC<RegistroManualModalProps> = ({
  categorias,
  centrosCosto,
  proveedores,
  documentoParaEditar,
  onGuardado,
  onCerrar,
  onProveedorCreado,
}) => {
  const { mostrarToast } = useToast();
  const abs = (v: number | undefined) => Math.abs(Number(v) || 0);

  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>(
    documentoParaEditar?.tipoDocumento || 'factura_electronica'
  );
  const [prefijo, setPrefijo] = useState(documentoParaEditar?.prefijo || '');
  const [folio, setFolio] = useState(documentoParaEditar?.folio || '');
  const [cufe, setCufe] = useState(documentoParaEditar?.cufe || '');
  const [fechaEmision, setFechaEmision] = useState(
    documentoParaEditar?.fechaEmision || fechaLocal()
  );
  const [fechaVencimiento, setFechaVencimiento] = useState(
    documentoParaEditar?.fechaVencimiento || fechaLocal()
  );
  const [formaPago, setFormaPago] = useState<FormaPago>(documentoParaEditar?.formaPago || 'contado');
  const [medioPago, setMedioPago] = useState(documentoParaEditar?.medioPago || 'Transferencia (Electrónico)');
  const [estadoPago, setEstadoPago] = useState<EstadoPago>(documentoParaEditar?.estadoPago || 'pagada');
  const [fechaPago, setFechaPago] = useState(
    documentoParaEditar?.fechaPago || fechaLocal()
  );

  // Proveedor seleccionado o texto libre
  const [proveedorSeleccionadoId, setProveedorSeleccionadoId] = useState(
    documentoParaEditar?.proveedorId || ''
  );
  const [nitProveedor, setNitProveedor] = useState(documentoParaEditar?.proveedor?.nit || '');
  const [razonSocialProveedor, setRazonSocialProveedor] = useState(
    documentoParaEditar?.proveedor?.razonSocial || ''
  );
  const [telefonoProveedor, setTelefonoProveedor] = useState(
    documentoParaEditar?.proveedor?.telefono || ''
  );
  const [emailProveedor, setEmailProveedor] = useState(documentoParaEditar?.proveedor?.email || '');
  const [ciudadProveedor, setCiudadProveedor] = useState(
    documentoParaEditar?.proveedor?.ciudad || 'Bogotá D.C.'
  );

  // Clasificación (5 categorías simplificadas)
  const [categoriaId, setCategoriaId] = useState(
    documentoParaEditar?.categoriaId || 'cat-mercancia'
  );
  const [centroCostoId, setCentroCostoId] = useState(
    documentoParaEditar?.centroCostoId || 'cc-clinica'
  );

  // Modo de ingreso: simplificado (Subtotal + IVA = Total) o por líneas.
  // Al editar un documento con detalle (p. ej. cargado desde XML) se abre por líneas
  // para no perder las líneas ni la discriminación de tarifas de IVA.
  const tieneDetalle =
    !!documentoParaEditar?.lineas?.length && !(documentoParaEditar.lineas.length === 1 && documentoParaEditar.lineas[0].id === 'lin-global');
  const [modoDetallado, setModoDetallado] = useState(tieneDetalle);

  // Valores de factura simplificada (No Responsable de IVA)
  const [subtotalRapido, setSubtotalRapido] = useState(abs(documentoParaEditar?.subtotal));
  const [ivaRapido, setIvaRapido] = useState(abs(documentoParaEditar?.totalIva));

  // Retenciones
  const [reteFuente, setReteFuente] = useState(abs(documentoParaEditar?.reteFuente));
  const [reteIva, setReteIva] = useState(abs(documentoParaEditar?.reteIva));
  const [reteIca, setReteIca] = useState(abs(documentoParaEditar?.reteIca));

  // Valores del documento original sin campo propio en este formulario (se conservan)
  const descuentosDocumento = abs(documentoParaEditar?.descuentos);
  const impoconsumo = abs(documentoParaEditar?.impoconsumo);

  // Líneas detalladas
  const [lineas, setLineas] = useState<LineaFactura[]>(
    documentoParaEditar?.lineas?.map((l) => ({ ...l, valorIva: abs(l.valorIva), totalLinea: abs(l.totalLinea) })) || [
      {
        id: 'lin-1',
        descripcion: 'Compra o servicio veterinario',
        cantidad: 1,
        unidad: 'UND',
        valorUnitario: 0,
        descuento: 0,
        porcentajeIva: 19,
        valorIva: 0,
        totalLinea: 0,
      },
    ]
  );

  // Adjunto y observaciones
  const [archivoAdjunto, setArchivoAdjunto] = useState(documentoParaEditar?.archivoAdjunto);
  const [observaciones, setObservaciones] = useState(documentoParaEditar?.observaciones || '');
  const [guardando, setGuardando] = useState(false);

  // Modal para crear proveedor inline
  const [mostrarModalNuevoProveedor, setMostrarModalNuevoProveedor] = useState(false);

  // Seleccionar proveedor del catálogo
  const handleSeleccionarProveedor = (id: string) => {
    setProveedorSeleccionadoId(id);
    const prov = proveedores.find((p) => p.id === id);
    if (prov) {
      setNitProveedor(prov.nit);
      setRazonSocialProveedor(prov.razonSocial);
      setTelefonoProveedor(prov.telefono || '');
      setEmailProveedor(prov.email || '');
      setCiudadProveedor(prov.ciudad || 'Bogotá D.C.');
      if (prov.categoriaPredeterminadaId) setCategoriaId(prov.categoriaPredeterminadaId);
      if (prov.centroCostoPredeterminadoId) setCentroCostoId(prov.centroCostoPredeterminadoId);
    }
  };

  // Cálculos automáticos
  const totalSubtotal = modoDetallado
    ? lineas.reduce((acc, l) => acc + (Number(l.cantidad) || 0) * (Number(l.valorUnitario) || 0) - (Number(l.descuento) || 0), 0)
    : Number(subtotalRapido) || 0;

  const totalIva = modoDetallado
    ? lineas.reduce((acc, l) => acc + (Number(l.valorIva) || 0), 0)
    : Number(ivaRapido) || 0;

  const totalRetenciones = (Number(reteFuente) || 0) + (Number(reteIva) || 0) + (Number(reteIca) || 0);

  // Total = valor de la factura (costo/gasto). Las retenciones no lo reducen:
  // disminuyen lo que se le paga al proveedor (se le pagan a la DIAN).
  const totalGeneral = Math.max(0, totalSubtotal - descuentosDocumento + totalIva + impoconsumo);
  const netoAPagar = Math.max(0, totalGeneral - totalRetenciones);

  // Actualizar cálculo de línea
  const handleCambioLinea = (id: string, campo: keyof LineaFactura, valor: any) => {
    setLineas((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const act = { ...l, [campo]: valor };
        const qty = Number(act.cantidad) || 0;
        const unit = Number(act.valorUnitario) || 0;
        const desc = Number(act.descuento) || 0;
        const ivaPct = Number(act.porcentajeIva) || 0;

        const base = Math.max(0, qty * unit - desc);
        const iva = Math.round((base * ivaPct) / 100);
        act.valorIva = iva;
        act.totalLinea = base + iva;
        return act;
      })
    );
  };

  const handleAgregarLinea = () => {
    setLineas((prev) => [
      ...prev,
      {
        id: 'lin-' + Date.now(),
        descripcion: '',
        cantidad: 1,
        unidad: 'UND',
        valorUnitario: 0,
        descuento: 0,
        porcentajeIva: 19,
        valorIva: 0,
        totalLinea: 0,
      },
    ]);
  };

  const handleEliminarLinea = (id: string) => {
    setLineas((prev) => prev.filter((l) => l.id !== id));
  };

  // Manejar adjunto
  const handleAdjuntarArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setArchivoAdjunto({
        nombre: file.name,
        tipo: file.type.includes('pdf') ? 'pdf' : 'imagen',
        tamano: file.size,
        dataUrl: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  // Guardar documento
  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!folio.trim()) {
      mostrarToast('warning', 'Número requerido', 'Por favor ingresa el número o consecutivo del documento.');
      return;
    }
    if (!nitProveedor.trim() || !razonSocialProveedor.trim()) {
      mostrarToast('warning', 'Proveedor incompleto', 'Debes ingresar el NIT y nombre o razón social del proveedor.');
      return;
    }
    if (totalGeneral <= 0) {
      mostrarToast('warning', 'Valor inválido', 'El total a pagar debe ser mayor a cero.');
      return;
    }

    try {
      setGuardando(true);

      const catObj = categorias.find((c) => c.id === categoriaId);
      const signo = tipoDocumento === 'nota_credito' ? -1 : 1;
      const conSigno = (v: number) => Math.round(v) * signo;

      // Pagos: al editar se conservan los abonos ya registrados
      const pagosPrevios = documentoParaEditar?.pagos || [];
      const pagadoPrevio = pagosPrevios.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
      const pagosFinales =
        signo < 0
          ? pagosPrevios
          : estadoPago === 'pagada' && pagadoPrevio < netoAPagar
            ? [
                ...pagosPrevios,
                {
                  id: 'pago-' + Date.now(),
                  fecha: fechaPago,
                  monto: Math.round(netoAPagar - pagadoPrevio),
                  medio: medioPago,
                  nota: documentoParaEditar ? 'Pago registrado al editar el documento' : 'Pago inicial registrado al crear documento',
                },
              ]
            : pagosPrevios;
      const pagadoFinal = pagosFinales.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
      const saldoPend = signo < 0 ? 0 : Math.max(0, Math.round(netoAPagar - pagadoFinal));
      const estadoFinal: EstadoPago = saldoPend === 0 ? 'pagada' : pagadoFinal > 0 ? 'parcial' : 'pendiente';

      // Calcular bases de IVA
      let base0 = 0;
      let base5 = 0;
      let base19 = 0;
      let iva5Val = 0;
      let iva19Val = 0;

      if (modoDetallado) {
        lineas.forEach((l) => {
          const base = (Number(l.cantidad) || 0) * (Number(l.valorUnitario) || 0) - (Number(l.descuento) || 0);
          if (Math.abs(l.porcentajeIva - 19) < 0.5) {
            base19 += base;
            iva19Val += l.valorIva;
          } else if (Math.abs(l.porcentajeIva - 5) < 0.5) {
            base5 += base;
            iva5Val += l.valorIva;
          } else {
            base0 += base;
          }
        });
      } else {
        // Modo simplificado: la tarifa se deduce de la relación IVA / subtotal
        const tarifa = totalSubtotal > 0 ? (totalIva / totalSubtotal) * 100 : 0;
        if (totalIva > 0 && Math.abs(tarifa - 5) < 1) {
          base5 = totalSubtotal;
          iva5Val = totalIva;
        } else if (totalIva > 0) {
          base19 = totalSubtotal;
          iva19Val = totalIva;
        } else {
          base0 = totalSubtotal;
        }
      }

      const doc: CompraDocumento = {
        // Se parte del documento original para no perder datos sin campo en este formulario
        // (adquirente, DV y dirección del proveedor, datos de extracción, nota crédito, etc.)
        ...(documentoParaEditar || {}),
        id: documentoParaEditar?.id || 'doc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        tipoDocumento,
        origen: tipoDocumento === 'factura_electronica' ? 'electronica' : 'manual',
        prefijo: prefijo.trim(),
        folio: folio.trim(),
        cufe: cufe.trim() || undefined,
        fechaEmision,
        fechaVencimiento: formaPago === 'credito' ? fechaVencimiento : fechaEmision,
        formaPago,
        medioPago,
        proveedorId: proveedorSeleccionadoId || undefined,
        proveedor: {
          ...(documentoParaEditar?.proveedor || {}),
          nit: nitProveedor.trim(),
          razonSocial: razonSocialProveedor.trim(),
          telefono: telefonoProveedor.trim(),
          email: emailProveedor.trim(),
          ciudad: ciudadProveedor.trim(),
        },
        categoriaId,
        centroCostoId,
        esGasto: catObj ? catObj.esGasto : false,
        moneda: 'COP',
        subtotal: conSigno(totalSubtotal),
        descuentos: conSigno(descuentosDocumento),
        baseIva0: conSigno(base0),
        baseIva5: conSigno(base5),
        baseIva19: conSigno(base19),
        iva5: conSigno(iva5Val),
        iva19: conSigno(iva19Val),
        totalIva: conSigno(totalIva),
        impoconsumo: conSigno(impoconsumo),
        reteFuente: conSigno(reteFuente),
        reteIva: conSigno(reteIva),
        reteIca: conSigno(reteIca),
        totalRetenciones: conSigno(totalRetenciones),
        total: conSigno(totalGeneral),
        saldoPendiente: saldoPend,
        estadoPago: estadoFinal,
        fechaPago: estadoFinal === 'pagada' ? fechaPago : undefined,
        lineas: modoDetallado
          ? lineas.map((l) => ({ ...l, valorIva: conSigno(l.valorIva), totalLinea: conSigno(l.totalLinea) }))
          : [
              {
                id: 'lin-global',
                descripcion: `Compra general - ${catObj?.nombre || 'Insumos'}`,
                cantidad: 1,
                unidad: 'UND',
                valorUnitario: Math.round(totalSubtotal),
                descuento: 0,
                porcentajeIva: totalSubtotal > 0 ? Math.round((totalIva / totalSubtotal) * 100) : 0,
                valorIva: Math.round(totalIva),
                totalLinea: Math.round(totalSubtotal + totalIva),
              },
            ],
        archivoAdjunto,
        observaciones,
        pagos: pagosFinales,
        historialCambios: documentoParaEditar
          ? [
              ...(documentoParaEditar.historialCambios || []),
              {
                fecha: new Date().toISOString(),
                usuario: dataService.usuarioActual()?.nombre || 'Usuario',
                accion: 'Edición de registro manual',
              },
            ]
          : [
              {
                fecha: new Date().toISOString(),
                usuario: dataService.usuarioActual()?.nombre || 'Usuario',
                accion: 'Creación de registro manual',
              },
            ],
        creadoEn: documentoParaEditar?.creadoEn || new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      };

      await dataService.guardarDocumento(doc);
      mostrarToast('success', 'Documento guardado', `Se guardó el registro ${doc.folio} exitosamente.`);
      onGuardado(doc.id);
    } catch (err: any) {
      mostrarToast('error', 'Error al guardar', err?.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-hidden animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <FilePenLine className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {documentoParaEditar ? 'Editar Registro' : 'Registro Manual de Compra o Gasto'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Para documentos soporte a no obligados, cuentas de cobro, tiquetes POS o facturas de papel.
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

        {/* Form Body */}
        <form onSubmit={handleGuardar} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Tipo de Documento y Consecutivo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Tipo de Documento *
              </label>
              <select
                value={tipoDocumento}
                onChange={(e) => setTipoDocumento(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-emerald-800 dark:text-emerald-300 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="factura_electronica">Factura Electrónica (DIAN)</option>
                <option value="documento_soporte">Documento Soporte (No Obligados)</option>
                <option value="cuenta_cobro">Cuenta de Cobro (Honorarios/Servicios)</option>
                <option value="factura_papel">Factura de Papel / Talonario</option>
                <option value="tiquete_pos">Tiquete de Caja / POS</option>
                <option value="recibo_caja">Recibo de Caja Menor</option>
                <option value="servicios_publicos">Servicios Públicos</option>
                <option value="nota_credito">Nota Crédito (resta)</option>
                <option value="nota_debito">Nota Débito</option>
                <option value="nomina_honorarios">Nómina / Prestaciones</option>
                <option value="otro">Otro Documento</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Prefijo (Opcional)
              </label>
              <input
                type="text"
                value={prefijo}
                onChange={(e) => setPrefijo(e.target.value)}
                placeholder="Ej: FE, SETT, DS"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Número / Consecutivo de Factura *
              </label>
              <input
                type="text"
                required
                value={folio}
                onChange={(e) => setFolio(e.target.value)}
                placeholder="Ej: 98450, 0045"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Campo CUFE opcional si es Factura Electrónica */}
          {tipoDocumento === 'factura_electronica' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                CUFE (Código Único de Factura Electrónica DIAN) - Opcional
              </label>
              <input
                type="text"
                value={cufe}
                onChange={(e) => setCufe(e.target.value)}
                placeholder="Ej: 4f8b91a2c3d4e5f6... (código alfanumérico generado por la DIAN)"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}

          {/* Fechas, Forma de Pago y Medio de Pago */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Fecha de Emisión *
              </label>
              <input
                type="date"
                required
                value={fechaEmision}
                onChange={(e) => setFechaEmision(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Forma de Pago
              </label>
              <select
                value={formaPago}
                onChange={(e) => {
                  const fp = e.target.value as FormaPago;
                  setFormaPago(fp);
                  if (fp === 'contado') {
                    setEstadoPago('pagada');
                    if (medioPago === 'Crédito Proveedor') setMedioPago('Transferencia (Electrónico)');
                  } else {
                    setEstadoPago('pendiente');
                    setMedioPago('Crédito Proveedor');
                  }
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
              >
                <option value="contado">Contado</option>
                <option value="credito">Crédito</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Medio de Pago *
              </label>
              <select
                value={medioPago}
                onChange={(e) => setMedioPago(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-emerald-900 dark:text-emerald-300"
              >
                <option value="Transferencia (Electrónico)">Transferencia (Electrónico)</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Tarjeta Débito (Electrónico)">Tarjeta Débito (Electrónico)</option>
                <option value="Tarjeta Crédito (Electrónico)">Tarjeta Crédito (Electrónico)</option>
                <option value="Nequi / Daviplata (Electrónico)">Nequi / Daviplata (Electrónico)</option>
                <option value="Crédito Proveedor">Crédito Proveedor</option>
                <option value="Cheque / Otro">Cheque / Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Estado de Pago
              </label>
              <select
                value={estadoPago}
                onChange={(e) => setEstadoPago(e.target.value as EstadoPago)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
              >
                <option value="pagada">Pagada (Cancelada)</option>
                <option value="pendiente">Pendiente (Cuenta por pagar)</option>
                <option value="parcial">Abono Parcial</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {formaPago === 'credito' ? 'Fecha Vencimiento' : 'Fecha Pago'}
              </label>
              <input
                type="date"
                value={formaPago === 'credito' ? fechaVencimiento : fechaPago}
                onChange={(e) => {
                  if (formaPago === 'credito') setFechaVencimiento(e.target.value);
                  else setFechaPago(e.target.value);
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
              />
            </div>
          </div>

          {/* Proveedor con Autocompletado */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Building className="w-4 h-4 text-teal-600" />
                Información del Proveedor / Tercero
              </span>

              {/* Selector de Proveedor Registrado */}
              <select
                value={proveedorSeleccionadoId}
                onChange={(e) => handleSeleccionarProveedor(e.target.value)}
                className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
              >
                <option value="">-- Cargar proveedor guardado --</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.razonSocial} (NIT: {p.nit})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  NIT o Cédula *
                </label>
                <input
                  type="text"
                  required
                  value={nitProveedor}
                  onChange={(e) => setNitProveedor(e.target.value)}
                  placeholder="Ej: 900123456"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                />
              </div>

              <div className="sm:col-span-8">
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Nombre o Razón Social *
                </label>
                <input
                  type="text"
                  required
                  value={razonSocialProveedor}
                  onChange={(e) => setRazonSocialProveedor(e.target.value)}
                  placeholder="Ej: Alimentos y Medicamentos Vet S.A.S"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Teléfono</label>
                <input
                  type="text"
                  value={telefonoProveedor}
                  onChange={(e) => setTelefonoProveedor(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  value={emailProveedor}
                  onChange={(e) => setEmailProveedor(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Ciudad</label>
                <input
                  type="text"
                  value={ciudadProveedor}
                  onChange={(e) => setCiudadProveedor(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Clasificación y Centro de Costo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Categoría *
              </label>
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
              >
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.esGasto ? '(Gasto Operativo)' : '(Compra de Insumo/Inventario)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Centro de Costo *
              </label>
              <select
                value={centroCostoId}
                onChange={(e) => setCentroCostoId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
              >
                {centrosCosto.map((cc) => (
                  <option key={cc.id} value={cc.id}>
                    {cc.codigo} - {cc.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Switch: Ingreso Rápido vs Detalle de Líneas */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {modoDetallado ? 'Modo Detallado por Ítems Activo' : 'Modo Rápido (Base + IVA + Total)'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {modoDetallado
                  ? 'Calcula automáticamente cantidades, precios unitarios e IVA por cada producto'
                  : 'Ingresa directamente el subtotal y el IVA sin desglosar productos'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModoDetallado(!modoDetallado)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-teal-700 dark:text-teal-400 shadow-sm"
            >
              {modoDetallado ? 'Cambiar a Modo Rápido' : 'Desglosar por Ítems'}
            </button>
          </div>

          {/* Formulario según Modo */}
          {modoDetallado ? (
            /* Líneas de Detalle */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Líneas de la Compra ({lineas.length})
                </span>
                <button
                  type="button"
                  onClick={handleAgregarLinea}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar Ítem</span>
                </button>
              </div>

              <div className="space-y-2">
                {lineas.map((linea, idx) => (
                  <div
                    key={linea.id}
                    className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={linea.descripcion}
                        onChange={(e) => handleCambioLinea(linea.id, 'descripcion', e.target.value)}
                        placeholder="Descripción del insumo o servicio"
                        className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                      />
                      {lineas.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleEliminarLinea(linea.id)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                      <div>
                        <label className="text-slate-500 block mb-0.5">Cantidad</label>
                        <input
                          type="number"
                          value={linea.cantidad}
                          onChange={(e) => handleCambioLinea(linea.id, 'cantidad', e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 block mb-0.5">Unidad</label>
                        <input
                          type="text"
                          value={linea.unidad}
                          onChange={(e) => handleCambioLinea(linea.id, 'unidad', e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 block mb-0.5">Valor Unitario</label>
                        <input
                          type="number"
                          value={linea.valorUnitario}
                          onChange={(e) => handleCambioLinea(linea.id, 'valorUnitario', e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 block mb-0.5">% IVA</label>
                        <select
                          value={linea.porcentajeIva}
                          onChange={(e) => handleCambioLinea(linea.id, 'porcentajeIva', Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                        >
                          <option value={0}>0% (Exento)</option>
                          <option value={5}>5% (Alimentos)</option>
                          <option value={19}>19% (General)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-500 block mb-0.5">Total Línea</label>
                        <p className="font-bold py-1.5 text-xs text-slate-900 dark:text-white">
                          {formatCOP(linea.totalLinea)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Modo Simplificado (No Responsable de IVA: Subtotal + IVA = Total) */
            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 flex items-center justify-between text-xs text-teal-800 dark:text-teal-200 font-medium">
                <span>Régimen No Responsable de IVA: Solo ingresa Subtotal e IVA (el Total se calcula automáticamente).</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Valor Subtotal (COP) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="100"
                    value={subtotalRapido}
                    onChange={(e) => setSubtotalRapido(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    {formatCOP(subtotalRapido)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Valor IVA (COP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={ivaRapido}
                    onChange={(e) => setIvaRapido(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    {formatCOP(ivaRapido)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                    Total Factura (Subtotal + IVA)
                  </label>
                  <div className="px-3.5 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-xs font-black text-emerald-800 dark:text-emerald-200">
                    {formatCOP(Number(subtotalRapido) + Number(ivaRapido))}
                  </div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 block font-semibold">
                    Cálculo automático
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Retenciones Practicadas */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Retenciones en la Fuente Practicadas (Opcionales)
              </span>
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                Total Retenciones: - {formatCOP(totalRetenciones)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  ReteFuente (Renta)
                </label>
                <input
                  type="number"
                  value={reteFuente}
                  onChange={(e) => setReteFuente(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  ReteIVA
                </label>
                <input
                  type="number"
                  value={reteIva}
                  onChange={(e) => setReteIva(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  ReteICA (Municipal)
                </label>
                <input
                  type="number"
                  value={reteIca}
                  onChange={(e) => setReteIca(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Adjuntar Soporte y Observaciones */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Adjuntar Foto o PDF del Soporte
              </label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <Paperclip className="w-4 h-4 text-slate-500" />
                  <span>{archivoAdjunto ? 'Cambiar archivo' : 'Seleccionar archivo'}</span>
                  <input
                    type="file"
                    accept="image/*,.pdf,application/pdf"
                    className="hidden"
                    onChange={handleAdjuntarArchivo}
                  />
                </label>
                {archivoAdjunto && (
                  <span className="text-xs text-emerald-600 font-medium truncate max-w-[200px]">
                    ✓ {archivoAdjunto.nombre}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Observaciones
              </label>
              <input
                type="text"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas de caja, paciente atendido, etc."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              />
            </div>
          </div>

          {/* Resumen Final de Totales */}
          <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase font-bold tracking-wider text-teal-900 dark:text-teal-300">
                Total de la factura
              </p>
              <p className="text-xs text-teal-700 dark:text-teal-400">
                Subtotal: {formatCOP(totalSubtotal)}
                {descuentosDocumento > 0 && <> • Descuentos: - {formatCOP(descuentosDocumento)}</>} • IVA: {formatCOP(totalIva)}
                {impoconsumo > 0 && <> • INC: {formatCOP(impoconsumo)}</>}
              </p>
              {totalRetenciones > 0 && (
                <p className="text-xs text-teal-700 dark:text-teal-400">
                  Retenciones practicadas: - {formatCOP(totalRetenciones)} → <strong>Neto a pagar al proveedor: {formatCOP(netoAPagar)}</strong>
                </p>
              )}
            </div>
            <div className="text-2xl font-black text-teal-950 dark:text-teal-100">
              {formatCOP(totalGeneral)}
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onCerrar}
              className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={guardando}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{guardando ? 'Guardando...' : 'Guardar Registro'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
