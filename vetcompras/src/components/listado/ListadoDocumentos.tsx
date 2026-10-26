import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  Trash2,
  CheckCircle,
  MoreVertical,
  Eye,
  FilePenLine,
  Copy,
  ChevronDown,
  ArrowUpDown,
  Calendar,
  Building,
  Tag,
  AlertTriangle,
  Receipt,
  CheckSquare,
  Square,
  DollarSign,
  Plus,
  FileSpreadsheet,
} from 'lucide-react';
import { CompraDocumento, Categoria, CentroCosto, Proveedor, FiltrosBusqueda } from '../../types';
import { formatCOP, formatFecha, getTipoDocumentoLabel, getEstadoPagoLabel, diasParaVencimiento, getMedioPagoInfo } from '../../utils/formatters';
import { dataService } from '../../services/dataService';
import { exportarDocumentosAExcel } from '../../services/excelService';
import { useToast } from '../../context/ToastContext';
import { DetalleDocumentoDrawer } from './DetalleDocumentoDrawer';
import { RegistrarAbonoModal } from './RegistrarAbonoModal';
import { ModalConfirmacion } from '../common/ModalConfirmacion';

interface ListadoDocumentosProps {
  documentos: CompraDocumento[];
  categorias: Categoria[];
  centrosCosto: CentroCosto[];
  proveedores: Proveedor[];
  onDatosActualizados: () => void;
  onEditarDocumento: (doc: CompraDocumento) => void;
  onAbrirCargaFactura: () => void;
  onAbrirCargaExcel?: () => void;
  onAbrirRegistroManual: () => void;
}

export const ListadoDocumentos: React.FC<ListadoDocumentosProps> = ({
  documentos,
  categorias,
  centrosCosto,
  proveedores,
  onDatosActualizados,
  onEditarDocumento,
  onAbrirCargaFactura,
  onAbrirCargaExcel,
  onAbrirRegistroManual,
}) => {
  const { mostrarToast } = useToast();

  const [modalConfirmarEliminar, setModalConfirmarEliminar] = useState<{
    abierto: boolean;
    titulo: string;
    mensaje: string;
    esLote?: boolean;
    id?: string;
    folio?: string;
  }>({
    abierto: false,
    titulo: '',
    mensaje: '',
  });

  // Estados de Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroAnio, setFiltroAnio] = useState('');
  const [filtroProveedor, setFiltroProveedor] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroCentroCosto, setFiltroCentroCosto] = useState('');
  const [filtroTipoDoc, setFiltroTipoDoc] = useState('');
  const [filtroMedioPago, setFiltroMedioPago] = useState('');
  const [filtroEstadoPago, setFiltroEstadoPago] = useState('');
  const [filtroOrigen, setFiltroOrigen] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState('todos');

  // Años disponibles según los registros garantizando 2026, 2025, 2024
  const aniosDisponibles = useMemo(() => {
    const aniosSet = new Set<number>([2026, 2025, 2024, 2023]);
    documentos.forEach((d) => {
      const y = parseInt(d.fechaEmision.split('-')[0], 10);
      if (!isNaN(y)) aniosSet.add(y);
    });
    return Array.from(aniosSet).sort((a, b) => b - a);
  }, [documentos]);

  // Ordenamiento
  const [campoOrden, setCampoOrden] = useState<keyof CompraDocumento>('fechaEmision');
  const [ordenAsc, setOrdenAsc] = useState(false);

  // Selección múltiple
  const [seleccionados, setSeleccionados] = useState<string[]>([]);

  // Modales
  const [documentoSeleccionadoDetalle, setDocumentoSeleccionadoDetalle] = useState<CompraDocumento | null>(null);
  const [documentoParaAbono, setDocumentoParaAbono] = useState<CompraDocumento | null>(null);
  const [mostrarCambioCategoriaLote, setMostrarCambioCategoriaLote] = useState(false);
  const [nuevaCategoriaLote, setNuevaCategoriaLote] = useState('');

  // Mapas para lookup rápido
  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);
  const ccMap = useMemo(() => new Map(centrosCosto.map((cc) => [cc.id, cc])), [centrosCosto]);

  // Filtrado de documentos
  const documentosFiltrados = useMemo(() => {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
    const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1).toISOString().split('T')[0];
    const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0).toISOString().split('T')[0];
    const inicioAnio = new Date(hoy.getFullYear(), 0, 1).toISOString().split('T')[0];

    return documentos.filter((d) => {
      // 1. Texto de búsqueda libre
      if (busqueda.trim()) {
        const query = busqueda.toLowerCase().trim();
        const enFolio = (d.folio || '').toLowerCase().includes(query);
        const enNit = (d.proveedor?.nit || '').includes(query);
        const enProveedor = (d.proveedor?.razonSocial || '').toLowerCase().includes(query);
        const enCufe = (d.cufe || '').toLowerCase().includes(query);
        const enObs = (d.observaciones || '').toLowerCase().includes(query);
        const enLineas = (d.lineas || []).some((l) => l.descripcion.toLowerCase().includes(query));

        if (!enFolio && !enNit && !enProveedor && !enCufe && !enObs && !enLineas) {
          return false;
        }
      }

      // 2. Filtro Período
      if (filtroPeriodo === 'mes_actual') {
        if (d.fechaEmision < inicioMes) return false;
      } else if (filtroPeriodo === 'mes_anterior') {
        if (d.fechaEmision < inicioMesAnterior || d.fechaEmision > finMesAnterior) return false;
      } else if (filtroPeriodo === 'anio_actual') {
        if (d.fechaEmision < inicioAnio) return false;
      }

      // Filtro Año específico
      if (filtroAnio) {
        const anioDoc = d.fechaEmision.split('-')[0];
        if (anioDoc !== filtroAnio) return false;
      }

      // 3. Otros filtros
      if (filtroProveedor && d.proveedorId !== filtroProveedor && d.proveedor?.nit !== filtroProveedor) {
        return false;
      }
      if (filtroCategoria && d.categoriaId !== filtroCategoria) return false;
      if (filtroCentroCosto && d.centroCostoId !== filtroCentroCosto) return false;
      if (filtroTipoDoc && d.tipoDocumento !== filtroTipoDoc) return false;
      if (filtroMedioPago) {
        const medioInfo = getMedioPagoInfo(d.medioPago);
        if (filtroMedioPago === 'electronico' && medioInfo.tipo !== 'electronico' && medioInfo.tipo !== 'tarjeta') {
          return false;
        }
        if (filtroMedioPago === 'efectivo' && medioInfo.tipo !== 'efectivo') {
          return false;
        }
        if (filtroMedioPago === 'credito' && medioInfo.tipo !== 'credito') {
          return false;
        }
      }
      if (filtroEstadoPago && d.estadoPago !== filtroEstadoPago) return false;
      if (filtroOrigen && d.origen !== filtroOrigen) return false;

      return true;
    });
  }, [
    documentos,
    busqueda,
    filtroAnio,
    filtroPeriodo,
    filtroProveedor,
    filtroCategoria,
    filtroCentroCosto,
    filtroTipoDoc,
    filtroMedioPago,
    filtroEstadoPago,
    filtroOrigen,
  ]);

  // Ordenar documentos
  const documentosOrdenados = useMemo(() => {
    return [...documentosFiltrados].sort((a, b) => {
      let valA: any = a[campoOrden];
      let valB: any = b[campoOrden];

      if (campoOrden === 'proveedor') {
        valA = a.proveedor?.razonSocial || '';
        valB = b.proveedor?.razonSocial || '';
      }

      if (typeof valA === 'string') {
        return ordenAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (typeof valA === 'number') {
        return ordenAsc ? valA - valB : valB - valA;
      }
      return 0;
    });
  }, [documentosFiltrados, campoOrden, ordenAsc]);

  const toggleOrden = (campo: keyof CompraDocumento) => {
    if (campoOrden === campo) {
      setOrdenAsc(!ordenAsc);
    } else {
      setCampoOrden(campo);
      setOrdenAsc(false);
    }
  };

  // Manejo de selecciones
  const handleToggleSeleccionarTodos = () => {
    if (seleccionados.length === documentosOrdenados.length) {
      setSeleccionados([]);
    } else {
      setSeleccionados(documentosOrdenados.map((d) => d.id));
    }
  };

  const handleToggleSeleccionarFila = (id: string) => {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Acciones en Lote
  const handleEliminarLote = () => {
    if (seleccionados.length === 0) return;
    setModalConfirmarEliminar({
      abierto: true,
      titulo: `¿Eliminar ${seleccionados.length} facturas seleccionadas?`,
      mensaje: `Esta acción eliminará ${seleccionados.length} facturas seleccionadas de la base de datos de este equipo (queda copia en los respaldos automáticos).`,
      esLote: true,
    });
  };

  const handleMarcarPagadosLote = async () => {
    if (seleccionados.length === 0) return;
    try {
      await dataService.marcarPagadosLote(seleccionados);
      mostrarToast('success', 'Pagos registrados', `Se marcaron como pagados ${seleccionados.length} documentos.`);
      setSeleccionados([]);
      onDatosActualizados();
    } catch (err: any) {
      mostrarToast('error', 'Error al actualizar', err?.message);
    }
  };

  const handleAplicarCambioCategoriaLote = async () => {
    if (!nuevaCategoriaLote) return;
    try {
      const catDestino = categorias.find((c) => c.id === nuevaCategoriaLote);
      await dataService.cambiarCategoriaLote(seleccionados, nuevaCategoriaLote, catDestino?.esGasto);
      mostrarToast('success', 'Categoría actualizada', `Se reasignó la categoría a ${seleccionados.length} documentos.`);
      setMostrarCambioCategoriaLote(false);
      setSeleccionados([]);
      onDatosActualizados();
    } catch (err: any) {
      mostrarToast('error', 'Error al cambiar categoría', err?.message);
    }
  };

  // Acciones individuales
  const handleEliminarIndividual = (id: string, folio: string) => {
    setModalConfirmarEliminar({
      abierto: true,
      titulo: '¿Eliminar factura o documento?',
      mensaje: `¿Estás seguro de que deseas eliminar la factura o documento ${folio}? Se borrará de la base de datos de este equipo (queda copia en los respaldos automáticos).`,
      esLote: false,
      id,
      folio,
    });
  };

  const ejecutarEliminacion = async () => {
    try {
      if (modalConfirmarEliminar.esLote) {
        await dataService.eliminarDocumentosLote(seleccionados);
        mostrarToast('success', 'Documentos eliminados', `Se eliminaron ${seleccionados.length} registros.`);
        setSeleccionados([]);
      } else if (modalConfirmarEliminar.id) {
        await dataService.eliminarDocumento(modalConfirmarEliminar.id);
        mostrarToast('info', 'Documento eliminado', `Se eliminó el registro ${modalConfirmarEliminar.folio || ''}.`);
      }
      onDatosActualizados();
    } catch (err: any) {
      mostrarToast('error', 'Error al eliminar', err?.message);
    } finally {
      setModalConfirmarEliminar({ abierto: false, titulo: '', mensaje: '' });
    }
  };

  const handleDuplicarDocumento = async (doc: CompraDocumento) => {
    try {
      const nuevo: CompraDocumento = {
        ...doc,
        id: 'doc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        folio: `${doc.folio}-COPIA`,
        cufe: undefined,
        fechaEmision: new Date().toISOString().split('T')[0],
        fechaVencimiento: new Date().toISOString().split('T')[0],
        pagos: [],
        saldoPendiente: doc.total,
        estadoPago: 'pendiente',
        historialCambios: [
          {
            fecha: new Date().toISOString(),
            usuario: dataService.usuarioActual()?.nombre || 'Usuario',
            accion: `Copia duplicada de ${doc.folio}`,
          },
        ],
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      };

      await dataService.guardarDocumento(nuevo);
      mostrarToast('success', 'Documento duplicado', `Se creó la copia ${nuevo.folio}.`);
      onDatosActualizados();
    } catch (err: any) {
      mostrarToast('error', 'Error al duplicar', err?.message);
    }
  };

  // Exportar listado filtrado actual a Excel
  const handleExportarExcel = () => {
    if (documentosOrdenados.length === 0) {
      mostrarToast('warning', 'Sin datos', 'No hay registros para exportar con los filtros actuales.');
      return;
    }
    exportarDocumentosAExcel(
      documentosOrdenados,
      categorias,
      centrosCosto,
      `VetCompras_${new Date().toISOString().split('T')[0]}.xlsx`
    );
    mostrarToast('success', 'Excel generado', 'Archivo .xlsx descargado con fórmulas de suma y formato en COP.');
  };

  return (
    <div className="space-y-4">
      {/* Barra Superior: Búsqueda y Filtros Rápidos */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Input de Búsqueda Global */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por NIT, proveedor, folio, CUFE, medicamentos, insumos..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-medium focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          {/* Filtro Período */}
          <select
            value={filtroPeriodo}
            onChange={(e) => setFiltroPeriodo(e.target.value)}
            className="w-full md:w-44 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <option value="todos">Todos los períodos</option>
            <option value="mes_actual">Este mes</option>
            <option value="mes_anterior">Mes anterior</option>
            <option value="anio_actual">Este año en curso</option>
          </select>

          {/* Botón Importar Excel */}
          {onAbrirCargaExcel && (
            <button
              onClick={onAbrirCargaExcel}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900/60 text-teal-800 dark:text-teal-200 text-xs font-semibold border border-teal-200 dark:border-teal-800 transition-colors shrink-0"
              title="Importar facturas masivamente desde archivo Excel (.xlsx, .xls, .csv)"
            >
              <FileSpreadsheet className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Importar Excel</span>
            </button>
          )}

          {/* Botón Exportar a Excel */}
          <button
            onClick={handleExportarExcel}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors shrink-0"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Exportar Excel</span>
          </button>
        </div>

        {/* Filtros Secundarios */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          {/* Filtro de Año */}
          <select
            value={filtroAnio}
            onChange={(e) => setFiltroAnio(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-emerald-800 dark:text-emerald-300"
          >
            <option value="">Año: Todos</option>
            {aniosDisponibles.map((y) => (
              <option key={y} value={y.toString()}>
                Año {y} {y === new Date().getFullYear() ? '(Actual)' : ''}
              </option>
            ))}
          </select>

          <select
            value={filtroProveedor}
            onChange={(e) => setFiltroProveedor(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
          >
            <option value="">Todos los proveedores</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.razonSocial}
              </option>
            ))}
          </select>

          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>

          <select
            value={filtroTipoDoc}
            onChange={(e) => setFiltroTipoDoc(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
          >
            <option value="">Todos los documentos</option>
            <option value="factura_electronica">Factura Electrónica (DIAN)</option>
            <option value="documento_soporte">Documento Soporte</option>
            <option value="cuenta_cobro">Cuenta de Cobro</option>
            <option value="factura_papel">Factura de Papel</option>
            <option value="tiquete_pos">Tiquete POS</option>
            <option value="servicios_publicos">Servicios Públicos</option>
            <option value="nota_credito">Nota Crédito (resta)</option>
            <option value="nota_debito">Nota Débito</option>
            <option value="nomina_honorarios">Nómina / Honorarios</option>
          </select>

          {/* Filtro Medio de Pago */}
          <select
            value={filtroMedioPago}
            onChange={(e) => setFiltroMedioPago(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
          >
            <option value="">Medio Pago: Todos</option>
            <option value="electronico">Electrónico (Transferencias / Tarjetas)</option>
            <option value="efectivo">Efectivo</option>
            <option value="credito">Crédito Proveedor</option>
          </select>

          <select
            value={filtroEstadoPago}
            onChange={(e) => setFiltroEstadoPago(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
          >
            <option value="">Cualquier estado</option>
            <option value="pagada">Pagadas</option>
            <option value="pendiente">Pendientes</option>
            <option value="parcial">Pago Parcial</option>
          </select>

          <select
            value={filtroOrigen}
            onChange={(e) => setFiltroOrigen(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
          >
            <option value="">Origen: Todos</option>
            <option value="electronica">Electrónica (DIAN)</option>
            <option value="manual">Manual</option>
          </select>
        </div>
      </div>

      {/* Barra de Acciones Masivas */}
      {seleccionados.length > 0 && (
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in">
          <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-semibold">
            <CheckSquare className="w-4 h-4 text-emerald-600" />
            <span>{seleccionados.length} documentos seleccionados</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleMarcarPagadosLote}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-700 shadow-xs hover:bg-emerald-50"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Marcar como pagados</span>
            </button>

            <button
              onClick={() => setMostrarCambioCategoriaLote(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold border border-slate-300 dark:border-slate-700 shadow-xs hover:bg-slate-50"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Cambiar categoría</span>
            </button>

            <button
              onClick={handleEliminarLote}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Eliminar</span>
            </button>
          </div>
        </div>
      )}

      {/* Tabla de Documentos */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {documentosOrdenados.length === 0 ? (
          /* Estado Vacío */
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <Receipt className="w-8 h-8 opacity-70" />
            </div>
            <div className="max-w-md mx-auto">
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-200">
                No hay compras o gastos registrados
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Registra compras subiendo la factura electrónica (XML o PDF) de proveedores como Gabrica, Zoetis o Royal Canin, o crea un registro manual.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={onAbrirCargaFactura}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>Subir factura electrónica</span>
              </button>
              {onAbrirCargaExcel && (
                <button
                  onClick={onAbrirCargaExcel}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-semibold text-xs border border-teal-200 dark:border-teal-800"
                >
                  <FileSpreadsheet className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>Importar Excel</span>
                </button>
              )}
              <button
                onClick={onAbrirRegistroManual}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-200 dark:border-slate-700"
              >
                <FilePenLine className="w-4 h-4" />
                <span>Registro manual</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider select-none">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        seleccionados.length > 0 &&
                        seleccionados.length === documentosOrdenados.length
                      }
                      onChange={handleToggleSeleccionarTodos}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                  </th>
                  <th
                    onClick={() => toggleOrden('fechaEmision')}
                    className="p-3 cursor-pointer hover:text-slate-900 dark:hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      <span>Fecha</span>
                      <ArrowUpDown className="w-3 h-3 opacity-60" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleOrden('folio')}
                    className="p-3 cursor-pointer hover:text-slate-900 dark:hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      <span>Documento</span>
                      <ArrowUpDown className="w-3 h-3 opacity-60" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleOrden('proveedor')}
                    className="p-3 cursor-pointer hover:text-slate-900 dark:hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      <span>Proveedor</span>
                      <ArrowUpDown className="w-3 h-3 opacity-60" />
                    </div>
                  </th>
                  <th className="p-3">Categoría & Centro</th>
                  <th
                    onClick={() => toggleOrden('total')}
                    className="p-3 text-right cursor-pointer hover:text-slate-900 dark:hover:text-white"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Total</span>
                      <ArrowUpDown className="w-3 h-3 opacity-60" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleOrden('saldoPendiente')}
                    className="p-3 text-right cursor-pointer hover:text-slate-900 dark:hover:text-white"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Saldo</span>
                      <ArrowUpDown className="w-3 h-3 opacity-60" />
                    </div>
                  </th>
                  <th className="p-3 text-center">Estado</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {documentosOrdenados.map((doc) => {
                  const estaSeleccionado = seleccionados.includes(doc.id);
                  const estadoBadge = getEstadoPagoLabel(doc.estadoPago);
                  const diasFaltantes =
                    doc.estadoPago !== 'pagada' ? diasParaVencimiento(doc.fechaVencimiento) : null;
                  const cat = catMap.get(doc.categoriaId);
                  const cc = ccMap.get(doc.centroCostoId);
                  const medioInfo = getMedioPagoInfo(doc.medioPago);

                  return (
                    <tr
                      key={doc.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        estaSeleccionado ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={estaSeleccionado}
                          onChange={() => handleToggleSeleccionarFila(doc.id)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                        />
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {formatFecha(doc.fechaEmision)}
                        </span>
                        {diasFaltantes !== null && (
                          <span
                            className={`block text-[10px] font-bold ${
                              diasFaltantes < 0
                                ? 'text-rose-600'
                                : diasFaltantes <= 3
                                ? 'text-amber-600'
                                : 'text-slate-400'
                            }`}
                          >
                            {diasFaltantes < 0
                              ? `Vencida (${Math.abs(diasFaltantes)}d)`
                              : diasFaltantes === 0
                              ? 'Vence hoy'
                              : `Vence en ${diasFaltantes}d`}
                          </span>
                        )}
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {doc.prefijo ? `${doc.prefijo}-${doc.folio}` : doc.folio}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-slate-400">
                            {getTipoDocumentoLabel(doc.tipoDocumento)}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border ${medioInfo.colorBadge}`}>
                            {medioInfo.label}
                          </span>
                        </div>
                      </td>

                      <td className="p-3 max-w-[200px]">
                        <span className="font-bold text-slate-800 dark:text-slate-100 truncate block">
                          {doc.proveedor?.razonSocial || 'Proveedor'}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          NIT: {doc.proveedor?.nit || '—'}
                        </span>
                      </td>

                      <td className="p-3">
                        <span className="inline-block px-2 py-0.5 rounded-md font-medium text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                          {cat?.nombre || 'General'}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          {cc?.nombre || 'Clínica'}
                        </span>
                      </td>

                      <td className="p-3 text-right whitespace-nowrap">
                        <span className="font-black text-slate-900 dark:text-white">
                          {formatCOP(doc.total)}
                        </span>
                        {doc.totalIva > 0 && (
                          <span className="block text-[10px] text-slate-400">
                            IVA: {formatCOP(doc.totalIva)}
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-right whitespace-nowrap">
                        {doc.saldoPendiente > 0 ? (
                          <span className="font-black text-rose-600 dark:text-rose-400">
                            {formatCOP(doc.saldoPendiente)}
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-emerald-600">
                            $ 0 (Al día)
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold border ${estadoBadge.colorClass}`}
                        >
                          {estadoBadge.texto}
                        </span>
                      </td>

                      {/* Botones de Acción */}
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {doc.saldoPendiente > 0 && (
                            <button
                              onClick={() => setDocumentoParaAbono(doc)}
                              className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              title="Registrar Abono / Pago"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => setDocumentoSeleccionadoDetalle(doc)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Ver Detalle Completo"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onEditarDocumento(doc)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Editar Documento"
                          >
                            <FilePenLine className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDuplicarDocumento(doc)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Duplicar Registro"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleEliminarIndividual(doc.id, doc.folio)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            title="Eliminar Registro"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer Detalle Documento */}
      {documentoSeleccionadoDetalle && (
        <DetalleDocumentoDrawer
          documento={documentoSeleccionadoDetalle}
          categorias={categorias}
          centrosCosto={centrosCosto}
          onCerrar={() => setDocumentoSeleccionadoDetalle(null)}
          onEditar={(doc) => {
            setDocumentoSeleccionadoDetalle(null);
            onEditarDocumento(doc);
          }}
          onDatosActualizados={onDatosActualizados}
        />
      )}

      {/* Modal Registrar Abono */}
      {documentoParaAbono && (
        <RegistrarAbonoModal
          documento={documentoParaAbono}
          onAbonoRegistrado={() => {
            setDocumentoParaAbono(null);
            onDatosActualizados();
          }}
          onCerrar={() => setDocumentoParaAbono(null)}
        />
      )}

      {/* Modal Cambio Masivo de Categoría */}
      {mostrarCambioCategoriaLote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Cambiar Categoría en Lote
            </h3>
            <p className="text-xs text-slate-500">
              Selecciona la nueva categoría que se asignará a los {seleccionados.length} documentos seleccionados:
            </p>
            <select
              value={nuevaCategoriaLote}
              onChange={(e) => setNuevaCategoriaLote(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
            >
              <option value="">-- Selecciona una categoría --</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setMostrarCambioCategoriaLote(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleAplicarCambioCategoriaLote}
                disabled={!nuevaCategoriaLote}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
              >
                Aplicar Cambio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Eliminar Documentos */}
      <ModalConfirmacion
        abierto={modalConfirmarEliminar.abierto}
        titulo={modalConfirmarEliminar.titulo}
        mensaje={modalConfirmarEliminar.mensaje}
        textoConfirmar="Sí, eliminar"
        textoCancelar="Cancelar"
        tipo="peligro"
        enConfirmar={ejecutarEliminacion}
        enCancelar={() => setModalConfirmarEliminar({ abierto: false, titulo: '', mensaje: '' })}
      />
    </div>
  );
};
