import React, { useState, useMemo } from 'react';
import {
  CircleDollarSign,
  Plus,
  Search,
  FileSpreadsheet,
  Trash2,
  Edit3,
  CheckCircle2,
  Clock,
  ShoppingBag,
  Stethoscope,
  Scissors,
  Wheat,
  Pill,
  Banknote,
  Smartphone,
  CreditCard,
  User,
  Heart,
  Calendar,
  X,
  Filter,
  RefreshCw,
  Syringe,
  Activity,
  Package,
  Receipt,
} from 'lucide-react';
import { Venta, CategoriaVenta, MedioPagoVenta, EstadoVenta } from '../../types';
import {
  formatCOP,
  formatFecha,
  getCategoriaVentaInfo,
  getMedioPagoVentaInfo,
  getSubcategoriaVentaInfo,
  SUBCATEGORIAS_POR_CATEGORIA,
  SUBCATEGORIAS_TRATAMIENTOS,
  SUBCATEGORIAS_VITRINA,
} from '../../utils/formatters';
import { exportarVentasAExcel } from '../../services/excelService';
import { dataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { ModalRegistroVenta } from './ModalRegistroVenta';
import { ModalDocumentoVenta } from './ModalDocumentoVenta';
import { ModalConfirmacion } from '../common/ModalConfirmacion';

interface VentasViewProps {
  ventas: Venta[];
  onDatosActualizados: () => void;
}

export const VentasView: React.FC<VentasViewProps> = ({
  ventas,
  onDatosActualizados,
}) => {
  const { mostrarToast } = useToast();

  // Estados de modales
  const [modalRegistroAbierto, setModalRegistroAbierto] = useState(false);
  const [ventaParaEditar, setVentaParaEditar] = useState<Venta | undefined>(undefined);
  const [ventaParaDocumento, setVentaParaDocumento] = useState<Venta | null>(null);

  // Estados de confirmación para eliminar
  const [ventaParaEliminar, setVentaParaEliminar] = useState<Venta | null>(null);
  const [eliminarLoteAbierto, setEliminarLoteAbierto] = useState(false);
  const [limpiarTodoAbierto, setLimpiarTodoAbierto] = useState(false);

  // Selección múltiple
  const [seleccionadas, setSeleccionadas] = useState<string[]>([]);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');
  const [filtroSubcategoria, setFiltroSubcategoria] = useState<string>('todas');
  const [filtroMedioPago, setFiltroMedioPago] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('todas');
  const [filtroAnio, setFiltroAnio] = useState<string>('todos');

  // Filtrado de ventas
  const ventasFiltradas = useMemo(() => {
    return ventas.filter((v) => {
      // Búsqueda de texto
      if (busqueda.trim()) {
        const query = busqueda.toLowerCase().trim();
        const textoCompleto = `${v.consecutivo} ${v.concepto} ${v.clienteNombre || ''} ${v.mascotaNombre || ''} ${v.clienteTelefono || ''} ${v.observaciones || ''}`.toLowerCase();
        if (!textoCompleto.includes(query)) return false;
      }

      // Categoría
      if (filtroCategoria !== 'todas' && v.categoria !== filtroCategoria) {
        return false;
      }

      // Subcategoría (para tratamientos o vitrina)
      if (filtroSubcategoria !== 'todas') {
        if (v.subcategoria !== filtroSubcategoria) return false;
      }

      // Medio de pago
      if (filtroMedioPago !== 'todos' && v.medioPago !== filtroMedioPago) {
        return false;
      }

      // Estado
      if (filtroEstado !== 'todas' && v.estado !== filtroEstado) {
        return false;
      }

      // Año
      if (filtroAnio !== 'todos') {
        const anioVenta = v.fecha ? v.fecha.split('-')[0] : '';
        if (anioVenta !== filtroAnio) return false;
      }

      return true;
    });
  }, [ventas, busqueda, filtroCategoria, filtroSubcategoria, filtroMedioPago, filtroEstado, filtroAnio]);

  // Cálculos estadísticos (KPIs)
  const estadisticas = useMemo(() => {
    const total = ventasFiltradas.reduce((acc, v) => acc + v.monto, 0);
    const pagadas = ventasFiltradas.filter((v) => v.estado === 'pagada').reduce((acc, v) => acc + v.monto, 0);
    const pendientes = ventasFiltradas.filter((v) => v.estado === 'pendiente').reduce((acc, v) => acc + v.monto, 0);

    // Por las 7 categorías de venta
    const porCategoria: Record<string, { total: number; cantidad: number }> = {
      banos: { total: 0, cantidad: 0 },
      vacunas: { total: 0, cantidad: 0 },
      consultas_clinica: { total: 0, cantidad: 0 },
      tratamientos_clinica: { total: 0, cantidad: 0 },
      purinas_empaque: { total: 0, cantidad: 0 },
      purinas_granel: { total: 0, cantidad: 0 },
      vitrina: { total: 0, cantidad: 0 },
    };

    // Por medio de pago
    const porMedio: Record<MedioPagoVenta, { total: number; cantidad: number }> = {
      efectivo: { total: 0, cantidad: 0 },
      nequi: { total: 0, cantidad: 0 },
      bancos: { total: 0, cantidad: 0 },
      credito: { total: 0, cantidad: 0 },
    };

    ventasFiltradas.forEach((v) => {
      let catKey = v.categoria as string;
      if (catKey === 'pet_shop') catKey = 'vitrina';
      else if (catKey === 'clinica') catKey = 'consultas_clinica';
      else if (catKey === 'purinas') catKey = 'purinas_empaque';
      else if (catKey === 'medicamentos') catKey = 'tratamientos_clinica';

      if (porCategoria[catKey]) {
        porCategoria[catKey].total += v.monto;
        porCategoria[catKey].cantidad += 1;
      }
      if (porMedio[v.medioPago]) {
        porMedio[v.medioPago].total += v.monto;
        porMedio[v.medioPago].cantidad += 1;
      }
    });

    return { total, pagadas, pendientes, porCategoria, porMedio };
  }, [ventasFiltradas]);

  // Manejar cambio rápido de estado (Pagada <-> Pendiente)
  const handleToggleEstado = async (venta: Venta) => {
    const nuevoEstado: EstadoVenta = venta.estado === 'pagada' ? 'pendiente' : 'pagada';
    try {
      await dataService.actualizarVenta({
        ...venta,
        estado: nuevoEstado,
      });
      mostrarToast(
        'success',
        'Estado actualizado',
        `La venta ${venta.consecutivo} ahora está ${nuevoEstado === 'pagada' ? 'Pagada' : 'Pendiente'}`
      );
      onDatosActualizados();
    } catch (err: any) {
      mostrarToast('error', 'Error al actualizar', err?.message);
    }
  };

  // Confirmar eliminación individual
  const confirmarEliminarIndividual = async () => {
    if (!ventaParaEliminar) return;
    try {
      await dataService.eliminarVenta(ventaParaEliminar.id);
      mostrarToast('info', 'Venta eliminada', `Se eliminó ${ventaParaEliminar.consecutivo} correctamente.`);
      setVentaParaEliminar(null);
      setSeleccionadas((prev) => prev.filter((id) => id !== ventaParaEliminar.id));
      onDatosActualizados();
    } catch (err: any) {
      mostrarToast('error', 'Error al eliminar', err?.message);
    }
  };

  // Confirmar eliminación en lote
  const confirmarEliminarLote = async () => {
    if (seleccionadas.length === 0) return;
    try {
      await dataService.eliminarVentasLote(seleccionadas);
      mostrarToast('info', 'Ventas eliminadas', `Se eliminaron ${seleccionadas.length} registros seleccionados.`);
      setSeleccionadas([]);
      setEliminarLoteAbierto(false);
      onDatosActualizados();
    } catch (err: any) {
      mostrarToast('error', 'Error al eliminar lote', err?.message);
    }
  };

  // Limpiar todas las ventas
  const confirmarLimpiarTodo = async () => {
    try {
      await dataService.limpiarVentas();
      mostrarToast('info', 'Registro de ventas limpio', 'Se han borrado todas las ventas registradas.');
      setSeleccionadas([]);
      setLimpiarTodoAbierto(false);
      onDatosActualizados();
    } catch (err: any) {
      mostrarToast('error', 'Error al limpiar ventas', err?.message);
    }
  };

  // Selección individual o total
  const toggleSeleccionarTodas = () => {
    if (seleccionadas.length === ventasFiltradas.length) {
      setSeleccionadas([]);
    } else {
      setSeleccionadas(ventasFiltradas.map((v) => v.id));
    }
  };

  const toggleSeleccionarItem = (id: string) => {
    setSeleccionadas((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Header con botones principales */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20">
            <CircleDollarSign className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              Ventas de la Veterinaria
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800">
                Guardado en este PC
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Control de ingresos por Pet Shop, Clínica, Baños, Purinas y Medicamentos
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => exportarVentasAExcel(ventasFiltradas)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
            title="Descargar tabla en formato Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Exportar Excel</span>
          </button>

          {ventas.length > 0 && (
            <button
              onClick={() => setLimpiarTodoAbierto(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900 transition-colors"
              title="Borrar todas las ventas registradas"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Limpiar Todo</span>
            </button>
          )}

          <button
            onClick={() => {
              setVentaParaEditar(undefined);
              setModalRegistroAbierto(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Venta</span>
          </button>
        </div>
      </div>

      {/* 2. Tarjetas de Resumen (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI: Total General */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Ventas
            </span>
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <CircleDollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {formatCOP(estadisticas.total)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {ventasFiltradas.length} venta{ventasFiltradas.length === 1 ? '' : 's'} en el periodo filtrado
          </p>
        </div>

        {/* KPI: Ventas Pagadas / Cobradas */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Cobrado / Efectivo / Nequi
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
            {formatCOP(estadisticas.pagadas)}
          </div>
          <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-1">
            Ingreso real en caja o banco
          </p>
        </div>

        {/* KPI: Cuentas por Cobrar (Crédito Pendiente) */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Por Cobrar (A Crédito)
            </span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
            {formatCOP(estadisticas.pendientes)}
          </div>
          <p className="text-[11px] text-rose-500 mt-1">
            {ventasFiltradas.filter((v) => v.estado === 'pendiente').length} cobro{ventasFiltradas.filter((v) => v.estado === 'pendiente').length === 1 ? '' : 's'} pendiente{ventasFiltradas.filter((v) => v.estado === 'pendiente').length === 1 ? '' : 's'}
          </p>
        </div>

        {/* KPI: Desglose por Medio de Pago */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Modalidades de Pago
          </span>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5 text-amber-500" /> Efectivo</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">{formatCOP(estadisticas.porMedio.efectivo.total)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5 text-fuchsia-500" /> Nequi</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">{formatCOP(estadisticas.porMedio.nequi.total)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-sky-500" /> Bancos</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">{formatCOP(estadisticas.porMedio.bancos.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Barra de Categorías de Ventas (7 Categorías) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
        {[
          { id: 'banos', label: 'Baños', icon: Scissors, color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800' },
          { id: 'vacunas', label: 'Vacunas', icon: Syringe, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' },
          { id: 'consultas_clinica', label: 'Consultas clinica', icon: Stethoscope, color: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800' },
          { id: 'tratamientos_clinica', label: 'Tratamientos clinica', icon: Activity, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800' },
          { id: 'purinas_empaque', label: 'Purinas (bultos y paq.)', icon: Package, color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800' },
          { id: 'purinas_granel', label: 'Purinas a granel', icon: Wheat, color: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800' },
          { id: 'vitrina', label: 'Vitrina', icon: ShoppingBag, color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800' },
        ].map((c) => {
          const Icono = c.icon;
          const datos = estadisticas.porCategoria[c.id] || { total: 0, cantidad: 0 };
          const activo = filtroCategoria === c.id;
          return (
            <button
              key={c.id}
              onClick={() => {
                const nuevo = activo ? 'todas' : c.id;
                setFiltroCategoria(nuevo);
                setFiltroSubcategoria('todas');
              }}
              className={`p-3 rounded-2xl border text-left transition-all ${
                activo
                  ? `${c.color} ring-2 ring-emerald-500 shadow-sm font-bold`
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold line-clamp-1">{c.label}</span>
                <Icono className="w-3.5 h-3.5 opacity-75 shrink-0" />
              </div>
              <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                {formatCOP(datos.total)}
              </div>
              <div className="text-[10px] text-slate-500">
                {datos.cantidad} venta{datos.cantidad === 1 ? '' : 's'}
              </div>
            </button>
          );
        })}
      </div>

      {/* 4. Barra de Búsqueda y Filtros */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Input de Búsqueda */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por cliente, mascota, producto, consecutivo..."
              className="w-full pl-10 pr-9 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filtro de Categoría */}
          <select
            value={filtroCategoria}
            onChange={(e) => {
              setFiltroCategoria(e.target.value);
              setFiltroSubcategoria('todas');
            }}
            className="px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
          >
            <option value="todas">Todas las categorías</option>
            <option value="banos">Baños</option>
            <option value="vacunas">Vacunas</option>
            <option value="consultas_clinica">Consultas clinica</option>
            <option value="tratamientos_clinica">Tratamientos clinica</option>
            <option value="purinas_empaque">Purinas (bultos y paquetes)</option>
            <option value="purinas_granel">Purinas a granel</option>
            <option value="vitrina">Vitrina</option>
            <option value="varios">Varios / Otros</option>
          </select>

          {/* Filtro de Subcategoría dinámico (muestra las opciones de cualquier categoría seleccionada, incluyendo Varios) */}
          {filtroCategoria !== 'todas' && SUBCATEGORIAS_POR_CATEGORIA[filtroCategoria] && (
            <select
              value={filtroSubcategoria}
              onChange={(e) => setFiltroSubcategoria(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 font-bold text-emerald-900 dark:text-emerald-200"
            >
              <option value="todas">Todas las subcategorías (incluye Varios)</option>
              {SUBCATEGORIAS_POR_CATEGORIA[filtroCategoria].map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          )}

          {/* Filtro Medio de Pago */}
          <select
            value={filtroMedioPago}
            onChange={(e) => setFiltroMedioPago(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
          >
            <option value="todos">Todos los medios</option>
            <option value="efectivo">Efectivo</option>
            <option value="nequi">Nequi</option>
            <option value="bancos">Bancos / Tarjeta</option>
            <option value="credito">A Crédito</option>
          </select>

          {/* Filtro Estado */}
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
          >
            <option value="todas">Todos los estados</option>
            <option value="pagada">Pagadas</option>
            <option value="pendiente">Pendientes</option>
          </select>

          {/* Filtro Año */}
          <select
            value={filtroAnio}
            onChange={(e) => setFiltroAnio(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
          >
            <option value="todos">Todos los años</option>
            <option value="2026">Año 2026</option>
            <option value="2025">Año 2025</option>
          </select>
        </div>

        {/* Barra de Acciones por Lote */}
        {seleccionadas.length > 0 && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
            <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
              {seleccionadas.length} venta{seleccionadas.length === 1 ? '' : 's'} seleccionada{seleccionadas.length === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSeleccionadas([])}
                className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Deseleccionar
              </button>
              <button
                onClick={() => setEliminarLoteAbierto(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Seleccionadas</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Tabla de Ventas (Desktop) y Tarjetas (Mobile) */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {ventasFiltradas.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <CircleDollarSign className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              No se encontraron ventas con los filtros aplicados.
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Haz clic en &quot;Registrar Venta&quot; para ingresar los ingresos de Pet Shop, Clínica, Baños, Purinas o Medicamentos.
            </p>
            <button
              onClick={() => {
                setVentaParaEditar(undefined);
                setModalRegistroAbierto(true);
              }}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Venta</span>
            </button>
          </div>
        ) : (
          <>
            {/* Vista Desktop (Tabla) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-bold text-slate-600 dark:text-slate-300">
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={seleccionadas.length === ventasFiltradas.length && ventasFiltradas.length > 0}
                        onChange={toggleSeleccionarTodas}
                        className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500"
                      />
                    </th>
                    <th className="py-3 px-3">Consecutivo</th>
                    <th className="py-3 px-3">Fecha</th>
                    <th className="py-3 px-3">Categoría</th>
                    <th className="py-3 px-4">Concepto / Detalle</th>
                    <th className="py-3 px-3">Cliente / Mascota</th>
                    <th className="py-3 px-3 text-right">Monto ($ COP)</th>
                    <th className="py-3 px-3">Medio de Pago</th>
                    <th className="py-3 px-3">Estado</th>
                    <th className="py-3 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ventasFiltradas.map((v) => {
                    const catInfo = getCategoriaVentaInfo(v.categoria);
                    const subInfo = getSubcategoriaVentaInfo(v.categoria, v.subcategoria);
                    const medioInfo = getMedioPagoVentaInfo(v.medioPago);
                    const seleccionada = seleccionadas.includes(v.id);

                    return (
                      <tr
                        key={v.id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                          seleccionada ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <input
                            type="checkbox"
                            checked={seleccionada}
                            onChange={() => toggleSeleccionarItem(v.id)}
                            className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500"
                          />
                        </td>

                        <td className="py-3.5 px-3 font-bold text-slate-900 dark:text-white">
                          {v.consecutivo}
                        </td>

                        <td className="py-3.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatFecha(v.fecha)}
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${catInfo.badgeColor}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${catInfo.dotColor}`} />
                              {catInfo.label}
                            </span>
                            {subInfo && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${subInfo.badgeColor}`}>
                                {subInfo.nombreCorto}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {v.concepto}
                          </div>
                          {v.observaciones && (
                            <div className="text-[11px] text-slate-400 line-clamp-1">
                              {v.observaciones}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-3">
                          {v.clienteNombre || v.mascotaNombre ? (
                            <div>
                              {v.clienteNombre && (
                                <div className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                  <User className="w-3 h-3 text-slate-400" />
                                  <span>{v.clienteNombre}</span>
                                </div>
                              )}
                              {v.mascotaNombre && (
                                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                  <Heart className="w-3 h-3 text-rose-400" />
                                  <span>{v.mascotaNombre}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 text-right font-black text-slate-900 dark:text-white whitespace-nowrap">
                          {formatCOP(v.monto)}
                        </td>

                        <td className="py-3.5 px-3">
                          <span className={`inline-block px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border ${medioInfo.badgeColor}`}>
                            {medioInfo.label}
                          </span>
                        </td>

                        <td className="py-3.5 px-3">
                          <button
                            type="button"
                            onClick={() => handleToggleEstado(v)}
                            title="Haz clic para alternar entre Pagada y Pendiente"
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-transform hover:scale-105 active:scale-95 ${
                              v.estado === 'pagada'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                            }`}
                          >
                            {v.estado === 'pagada' ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Pagada</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3 text-rose-600" />
                                <span>Pendiente</span>
                              </>
                            )}
                          </button>
                        </td>

                        <td className="py-3.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setVentaParaDocumento(v)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors"
                              title="Generar Recibo / Factura de Venta (Imprimir / WhatsApp)"
                            >
                              <Receipt className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setVentaParaEditar(v);
                                setModalRegistroAbierto(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition-colors"
                              title="Editar venta"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setVentaParaEliminar(v)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors"
                              title="Eliminar venta"
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

            {/* Vista Mobile (Tarjetas adaptadas para Celular) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800 p-2 space-y-2">
              {ventasFiltradas.map((v) => {
                const catInfo = getCategoriaVentaInfo(v.categoria);
                const subInfo = getSubcategoriaVentaInfo(v.categoria, v.subcategoria);
                const medioInfo = getMedioPagoVentaInfo(v.medioPago);
                return (
                  <div
                    key={v.id}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            {v.consecutivo}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {formatFecha(v.fecha)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${catInfo.badgeColor}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${catInfo.dotColor}`} />
                            {catInfo.label}
                          </span>
                          {subInfo && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold border ${subInfo.badgeColor}`}>
                              {subInfo.nombreCorto}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-sm text-slate-900 dark:text-white">
                          {formatCOP(v.monto)}
                        </div>
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold border mt-1 ${medioInfo.badgeColor}`}>
                          {medioInfo.label}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                      {v.concepto}
                    </div>

                    {(v.clienteNombre || v.mascotaNombre) && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-2">
                        {v.clienteNombre && <span>Cliente: {v.clienteNombre}</span>}
                        {v.mascotaNombre && <span className="text-emerald-600">Mascota: {v.mascotaNombre}</span>}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleToggleEstado(v)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          v.estado === 'pagada'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300'
                        }`}
                      >
                        {v.estado === 'pagada' ? '✓ Pagada' : '⏳ Pendiente'}
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setVentaParaDocumento(v)}
                          className="p-1.5 rounded-lg text-blue-600 bg-blue-50 dark:bg-blue-950/60"
                          title="Generar Recibo de Venta (Imprimir / WhatsApp)"
                        >
                          <Receipt className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setVentaParaEditar(v);
                            setModalRegistroAbierto(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-600 bg-slate-100 dark:bg-slate-700"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setVentaParaEliminar(v)}
                          className="p-1.5 rounded-lg text-rose-600 bg-rose-50 dark:bg-rose-950/60"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Modal para Crear / Editar Venta */}
      {modalRegistroAbierto && (
        <ModalRegistroVenta
          ventaParaEditar={ventaParaEditar}
          onGuardado={() => {
            setModalRegistroAbierto(false);
            setVentaParaEditar(undefined);
            onDatosActualizados();
          }}
          onCerrar={() => {
            setModalRegistroAbierto(false);
            setVentaParaEditar(undefined);
          }}
        />
      )}

      {/* Modal Confirmación Eliminación Individual */}
      <ModalConfirmacion
        abierto={!!ventaParaEliminar}
        titulo="¿Eliminar esta venta?"
        mensaje={`¿Estás seguro de eliminar el registro de venta "${ventaParaEliminar?.consecutivo} - ${ventaParaEliminar?.concepto}" por valor de ${formatCOP(ventaParaEliminar?.monto || 0)}? Se eliminará de la base de datos de este equipo.`}
        textoConfirmar="Sí, eliminar venta"
        textoCancelar="Cancelar"
        tipo="peligro"
        enConfirmar={confirmarEliminarIndividual}
        enCancelar={() => setVentaParaEliminar(null)}
      />

      {/* Modal Confirmación Eliminación en Lote */}
      <ModalConfirmacion
        abierto={eliminarLoteAbierto}
        titulo={`¿Eliminar ${seleccionadas.length} ventas seleccionadas?`}
        mensaje={`Esta acción eliminará de forma permanente las ${seleccionadas.length} ventas seleccionadas de la base de datos de este equipo.`}
        textoConfirmar="Sí, eliminar lote"
        textoCancelar="Cancelar"
        tipo="peligro"
        enConfirmar={confirmarEliminarLote}
        enCancelar={() => setEliminarLoteAbierto(false)}
      />

      {/* Modal Confirmación Limpiar Todo */}
      <ModalConfirmacion
        abierto={limpiarTodoAbierto}
        titulo="¿Borrar todas las ventas registradas?"
        mensaje="Esta acción borrará todas las ventas registradas en la veterinaria. Las facturas de compra y gastos NO se verán afectadas."
        textoConfirmar="Sí, borrar todas las ventas"
        textoCancelar="Cancelar"
        tipo="peligro"
        enConfirmar={confirmarLimpiarTodo}
        enCancelar={() => setLimpiarTodoAbierto(false)}
      />

      {/* Modal Generar Documento de Venta / Recibo Oficial */}
      {ventaParaDocumento && (
        <ModalDocumentoVenta
          venta={ventaParaDocumento}
          empresa={dataService.obtenerDatosEmpresa()}
          onCerrar={() => setVentaParaDocumento(null)}
        />
      )}
    </div>
  );
};
