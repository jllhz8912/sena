import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Download,
  Building2,
  Tag,
  Clock,
  CreditCard,
  Database,
  Pencil,
  Filter,
  Scissors,
  Syringe,
  Stethoscope,
  Activity,
  Package,
  Wheat,
  ShoppingBag,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Layers,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Building,
  BarChart3,
} from 'lucide-react';
import {
  CompraDocumento,
  Categoria,
  CentroCosto,
  Proveedor,
  TipoPeriodoReporte,
  EmpresaInfo,
  Venta,
  CategoriaVenta,
} from '../../types';
import {
  formatCOP,
  formatFecha,
  diasParaVencimiento,
  getTipoDocumentoLabel,
  getMedioPagoInfo,
  getCategoriaVentaInfo,
  getMedioPagoVentaInfo,
  getSubcategoriaVentaInfo,
  SUBCATEGORIAS_POR_CATEGORIA,
  SUBCATEGORIAS_TRATAMIENTOS,
  SUBCATEGORIAS_VITRINA,
  fechaLocal,
} from '../../utils/formatters';
import { itemsDeVenta, montosPorMedio, categoriaNormalizada, saldoDeVenta } from '../../utils/ventas';
import {
  exportarDocumentosAExcel,
  exportarVentasAExcel,
  exportarReporteMediosPagoExcel,
  exportarTodaLaBaseAExcel,
  exportarReporteUtilidadYCategoriasExcel,
} from '../../services/excelService';
import { dataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { ModalDatosEmpresa } from '../catalogos/ModalDatosEmpresa';

interface ReportesViewProps {
  documentos: CompraDocumento[];
  categorias: Categoria[];
  centrosCosto: CentroCosto[];
  proveedores: Proveedor[];
  ventas?: Venta[];
}

// Las 7 Categorías Oficiales de Venta de la Veterinaria
const CATEGORIAS_VENTA_DEF: Array<{
  key: CategoriaVenta;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgLight: string;
  borderLight: string;
}> = [
  { key: 'banos', label: 'Baños', icon: Scissors, color: 'text-cyan-600 dark:text-cyan-400', bgLight: 'bg-cyan-50 dark:bg-cyan-950/40', borderLight: 'border-cyan-200 dark:border-cyan-800' },
  { key: 'vacunas', label: 'Vacunas', icon: Syringe, color: 'text-indigo-600 dark:text-indigo-400', bgLight: 'bg-indigo-50 dark:bg-indigo-950/40', borderLight: 'border-indigo-200 dark:border-indigo-800' },
  { key: 'consultas_clinica', label: 'Consultas clinica', icon: Stethoscope, color: 'text-emerald-600 dark:text-emerald-400', bgLight: 'bg-emerald-50 dark:bg-emerald-950/40', borderLight: 'border-emerald-200 dark:border-emerald-800' },
  { key: 'tratamientos_clinica', label: 'Tratamientos clinica', icon: Activity, color: 'text-rose-600 dark:text-rose-400', bgLight: 'bg-rose-50 dark:bg-rose-950/40', borderLight: 'border-rose-200 dark:border-rose-800' },
  { key: 'purinas_empaque', label: 'Purinas ( bultos y paquetes)', icon: Package, color: 'text-amber-600 dark:text-amber-400', bgLight: 'bg-amber-50 dark:bg-amber-950/40', borderLight: 'border-amber-200 dark:border-amber-800' },
  { key: 'purinas_granel', label: 'Purinas a granel', icon: Wheat, color: 'text-orange-600 dark:text-orange-400', bgLight: 'bg-orange-50 dark:bg-orange-950/40', borderLight: 'border-orange-200 dark:border-orange-800' },
  { key: 'vitrina', label: 'Vitrina', icon: ShoppingBag, color: 'text-purple-600 dark:text-purple-400', bgLight: 'bg-purple-50 dark:bg-purple-950/40', borderLight: 'border-purple-200 dark:border-purple-800' },
  { key: 'varios', label: 'Varios / Otros', icon: Tag, color: 'text-slate-600 dark:text-slate-400', bgLight: 'bg-slate-50 dark:bg-slate-900', borderLight: 'border-slate-200 dark:border-slate-800' },
];

export const ReportesView: React.FC<ReportesViewProps> = ({
  documentos,
  categorias,
  centrosCosto,
  proveedores,
  ventas = [],
}) => {
  const { mostrarToast } = useToast();

  // Tab activo:
  // 1: Utilidad y Rendimiento
  // 2: Ventas por Categoría (las 7 categorías)
  // 3: Compras y Gastos por Categoría
  // 4: Medios de Pago
  // 5: Cartera (Por Cobrar y Por Pagar)
  // 6: Compras por Proveedor
  const [tabActivo, setTabActivo] = useState<number>(1);

  // Filtros de Período: Días, Meses, Años
  const [periodoTipo, setPeriodoTipo] = useState<TipoPeriodoReporte>('mes_actual');
  const [diaEspecifico, setDiaEspecifico] = useState<string>(
    fechaLocal()
  );
  const [anioSeleccionado, setAnioSeleccionado] = useState<number>(new Date().getFullYear());
  const [mesSeleccionado, setMesSeleccionado] = useState<number>(new Date().getMonth() + 1);
  const [fechaInicioPersonalizada, setFechaInicioPersonalizada] = useState<string>(
    fechaLocal(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  );
  const [fechaFinPersonalizada, setFechaFinPersonalizada] = useState<string>(
    fechaLocal()
  );

  // Filtros por Categoría específicos
  const [filtroCategoriaVenta, setFiltroCategoriaVenta] = useState<string>('todas');
  const [filtroSubcategoriaVenta, setFiltroSubcategoriaVenta] = useState<string>('todas');
  const [filtroCategoriaCompra, setFiltroCategoriaCompra] = useState<string>('todas');
  const [busquedaTexto, setBusquedaTexto] = useState<string>('');

  // Datos de la empresa veterinaria
  const [empresaInfo, setEmpresaInfo] = useState<EmpresaInfo>(() => dataService.obtenerDatosEmpresa());
  const [modalEmpresaAbierto, setModalEmpresaAbierto] = useState(false);

  // Años disponibles garantizando 2026, 2025, 2024, 2023 y los detectados
  const aniosDisponibles = useMemo(() => {
    const aniosSet = new Set<number>([2026, 2025, 2024, 2023]);
    documentos.forEach((d) => {
      const y = parseInt((d.fechaEmision || '').split('-')[0], 10);
      if (!isNaN(y)) aniosSet.add(y);
    });
    ventas.forEach((v) => {
      const y = parseInt((v.fecha || '').split('-')[0], 10);
      if (!isNaN(y)) aniosSet.add(y);
    });
    return Array.from(aniosSet).sort((a, b) => b - a);
  }, [documentos, ventas]);

  // Mapa de nombres de categorías y centros de compras
  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c.nombre])), [categorias]);
  const ccMap = useMemo(() => new Map(centrosCosto.map((cc) => [cc.id, cc.nombre])), [centrosCosto]);

  // Rango de fechas calculado según el selector
  const { fechaInicio, fechaFin, periodoTexto } = useMemo(() => {
    let inicio = '';
    let fin = '';
    let texto = '';

    const format = (y: number, m: number, d: number) =>
      `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;

    if (periodoTipo === 'dia_especifico') {
      inicio = diaEspecifico;
      fin = diaEspecifico;
      texto = `Día ${formatFecha(diaEspecifico)}`;
    } else if (periodoTipo === 'mes_actual') {
      const hoy = new Date();
      inicio = format(hoy.getFullYear(), hoy.getMonth() + 1, 1);
      const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
      fin = format(hoy.getFullYear(), hoy.getMonth() + 1, ultimoDia);
      texto = `Mes Actual (${hoy.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })})`;
    } else if (periodoTipo === 'mes_anterior') {
      const hoy = new Date();
      const prev = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      inicio = format(prev.getFullYear(), prev.getMonth() + 1, 1);
      const ultimoDia = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate();
      fin = format(prev.getFullYear(), prev.getMonth() + 1, ultimoDia);
      texto = `Mes Anterior (${prev.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })})`;
    } else if (periodoTipo === 'mes_especifico') {
      inicio = format(anioSeleccionado, mesSeleccionado, 1);
      const ultimoDia = new Date(anioSeleccionado, mesSeleccionado, 0).getDate();
      fin = format(anioSeleccionado, mesSeleccionado, ultimoDia);
      const d = new Date(anioSeleccionado, mesSeleccionado - 1, 1);
      texto = `${d.toLocaleDateString('es-CO', { month: 'long' })} de ${anioSeleccionado}`;
    } else if (periodoTipo === 'anio_actual') {
      inicio = format(anioSeleccionado, 1, 1);
      fin = format(anioSeleccionado, 12, 31);
      texto = `Año Completo ${anioSeleccionado}`;
    } else {
      inicio = fechaInicioPersonalizada;
      fin = fechaFinPersonalizada;
      texto = `Rango del ${formatFecha(inicio)} al ${formatFecha(fin)}`;
    }

    return { fechaInicio: inicio, fechaFin: fin, periodoTexto: texto };
  }, [
    periodoTipo,
    diaEspecifico,
    anioSeleccionado,
    mesSeleccionado,
    fechaInicioPersonalizada,
    fechaFinPersonalizada,
  ]);

  // 1. Filtrado de Ventas en el período seleccionado
  const ventasEnPeriodo = useMemo(() => {
    return ventas.filter((v) => {
      const enRango = v.fecha >= fechaInicio && v.fecha <= fechaFin;
      if (!enRango) return false;
      const items = itemsDeVenta(v);
      if (filtroCategoriaVenta !== 'todas' && !items.some((i) => categoriaNormalizada(i.categoria) === filtroCategoriaVenta)) return false;
      if (filtroSubcategoriaVenta !== 'todas' && !items.some((i) => i.subcategoria === filtroSubcategoriaVenta)) return false;
      if (busquedaTexto.trim()) {
        const q = busquedaTexto.toLowerCase();
        const coincide =
          v.concepto.toLowerCase().includes(q) ||
          itemsDeVenta(v).some((i) => i.concepto.toLowerCase().includes(q)) ||
          (v.clienteNombre && v.clienteNombre.toLowerCase().includes(q)) ||
          (v.mascotaNombre && v.mascotaNombre.toLowerCase().includes(q)) ||
          v.consecutivo.toLowerCase().includes(q);
        if (!coincide) return false;
      }
      return true;
    });
  }, [ventas, fechaInicio, fechaFin, filtroCategoriaVenta, filtroSubcategoriaVenta, busquedaTexto]);

  // Ventas de todo el período (sin filtro de categoría puntual) para calcular totales y porcentajes
  const todasVentasPeriodo = useMemo(() => {
    return ventas.filter((v) => v.fecha >= fechaInicio && v.fecha <= fechaFin);
  }, [ventas, fechaInicio, fechaFin]);

  // 2. Filtrado de Compras y Gastos en el período seleccionado
  const docsEnPeriodo = useMemo(() => {
    return documentos.filter((d) => {
      const enRango = d.fechaEmision >= fechaInicio && d.fechaEmision <= fechaFin;
      if (!enRango) return false;
      if (filtroCategoriaCompra !== 'todas' && d.categoriaId !== filtroCategoriaCompra) return false;
      if (busquedaTexto.trim()) {
        const q = busquedaTexto.toLowerCase();
        const coincide =
          (d.proveedor?.razonSocial && d.proveedor.razonSocial.toLowerCase().includes(q)) ||
          (d.proveedor?.nit && d.proveedor.nit.includes(q)) ||
          d.folio.toLowerCase().includes(q);
        if (!coincide) return false;
      }
      return true;
    });
  }, [documentos, fechaInicio, fechaFin, filtroCategoriaCompra, busquedaTexto]);

  const todosDocsPeriodo = useMemo(() => {
    return documentos.filter((d) => d.fechaEmision >= fechaInicio && d.fechaEmision <= fechaFin);
  }, [documentos, fechaInicio, fechaFin]);

  // 3. Métricas Financieras y de Utilidad Operativa
  const resumenFinanciero = useMemo(() => {
    const totalVentas = Math.round(todasVentasPeriodo.reduce((acc, v) => acc + v.monto, 0));
    
    // Compras de mercancía / insumos (esGasto === false)
    const totalCompras = Math.round(
      todosDocsPeriodo.filter((d) => !d.esGasto).reduce((acc, d) => acc + d.total, 0)
    );

    // Gastos operativos / administrativos (esGasto === true)
    const totalGastos = Math.round(
      todosDocsPeriodo.filter((d) => d.esGasto).reduce((acc, d) => acc + d.total, 0)
    );

    const totalEgresos = totalCompras + totalGastos;
    const utilidadNeta = totalVentas - totalEgresos;
    const margenOperativo = totalVentas > 0 ? (utilidadNeta / totalVentas) * 100 : 0;

    // Cartera del negocio:
    // - Cartera por Cobrar (Ventas pendientes a crédito)
    const carteraPorCobrar = Math.round(
      ventas.reduce((acc, v) => acc + saldoDeVenta(v), 0)
    );
    // - Cartera por Pagar (Compras pendientes con saldo a proveedores)
    const carteraPorPagar = Math.round(
      documentos.filter((d) => d.saldoPendiente > 0).reduce((acc, d) => acc + d.saldoPendiente, 0)
    );

    return {
      totalVentas,
      totalCompras,
      totalGastos,
      totalEgresos,
      utilidadNeta,
      margenOperativo,
      carteraPorCobrar,
      carteraPorPagar,
    };
  }, [todasVentasPeriodo, todosDocsPeriodo, ventas, documentos]);

  // 4. Desglose de Ventas por las 7 Categorías Oficiales
  const reporte7CategoriasVenta = useMemo(() => {
    const mapa = new Map<
      string,
      {
        categoriaKey: CategoriaVenta;
        nombre: string;
        cantidad: number;
        total: number;
        porcentaje: number;
      }
    >();

    // Inicializar con las 7 categorías oficiales para que siempre aparezcan
    CATEGORIAS_VENTA_DEF.forEach((cat) => {
      mapa.set(cat.key, {
        categoriaKey: cat.key,
        nombre: cat.label,
        cantidad: 0,
        total: 0,
        porcentaje: 0,
      });
    });

    // Cada ítem suma a su categoría; "cantidad" = ventas en que aparece la categoría
    todasVentasPeriodo.forEach((v) => {
      const contadas = new Set<string>();
      for (const item of itemsDeVenta(v)) {
        const key = categoriaNormalizada(item.categoria);
        const entry = mapa.get(key) || {
          categoriaKey: key as CategoriaVenta,
          nombre: getCategoriaVentaInfo(key).label,
          cantidad: 0,
          total: 0,
          porcentaje: 0,
        };
        if (!contadas.has(key)) entry.cantidad += 1;
        contadas.add(key);
        entry.total += item.subtotal;
        mapa.set(key, entry);
      }
    });

    const granTotal = resumenFinanciero.totalVentas;
    return Array.from(mapa.values())
      .map((item) => ({
        ...item,
        total: Math.round(item.total),
        porcentaje: granTotal > 0 ? (item.total / granTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [todasVentasPeriodo, resumenFinanciero.totalVentas]);

  // 4b. Desglose detallado de las 7 subcategorías de Tratamientos
  const reporteSubcategoriasTratamientos = useMemo(() => {
    const mapa = new Map<
      string,
      {
        key: string;
        label: string;
        nombreCorto: string;
        badgeColor: string;
        cantidad: number;
        total: number;
        porcentaje: number;
      }
    >();

    SUBCATEGORIAS_TRATAMIENTOS.forEach((s) => {
      mapa.set(s.value, {
        key: s.value,
        label: s.label,
        nombreCorto: s.nombreCorto,
        badgeColor: s.badgeColor,
        cantidad: 0,
        total: 0,
        porcentaje: 0,
      });
    });

    const itemsTrat = todasVentasPeriodo
      .flatMap(itemsDeVenta)
      .filter((i) => categoriaNormalizada(i.categoria) === 'tratamientos_clinica');
    const granTotalTrat = itemsTrat.reduce((acc, i) => acc + i.subtotal, 0);

    itemsTrat.forEach((i) => {
      const item = mapa.get(i.subcategoria || 'varios') || mapa.get('varios')!;
      item.cantidad += 1;
      item.total += i.subtotal;
    });

    return Array.from(mapa.values())
      .map((item) => ({
        ...item,
        total: Math.round(item.total),
        porcentaje: granTotalTrat > 0 ? (item.total / granTotalTrat) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [todasVentasPeriodo]);

  // 4c. Desglose detallado de las 7 subcategorías de Vitrina
  const reporteSubcategoriasVitrina = useMemo(() => {
    const mapa = new Map<
      string,
      {
        key: string;
        label: string;
        nombreCorto: string;
        badgeColor: string;
        cantidad: number;
        total: number;
        porcentaje: number;
      }
    >();

    SUBCATEGORIAS_VITRINA.forEach((s) => {
      mapa.set(s.value, {
        key: s.value,
        label: s.label,
        nombreCorto: s.nombreCorto,
        badgeColor: s.badgeColor,
        cantidad: 0,
        total: 0,
        porcentaje: 0,
      });
    });

    const itemsVit = todasVentasPeriodo.flatMap(itemsDeVenta).filter((i) => categoriaNormalizada(i.categoria) === 'vitrina');
    const granTotalVit = itemsVit.reduce((acc, i) => acc + i.subtotal, 0);

    itemsVit.forEach((i) => {
      const item = mapa.get(i.subcategoria || 'varios') || mapa.get('varios')!;
      item.cantidad += 1;
      item.total += i.subtotal;
    });

    return Array.from(mapa.values())
      .map((item) => ({
        ...item,
        total: Math.round(item.total),
        porcentaje: granTotalVit > 0 ? (item.total / granTotalVit) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [todasVentasPeriodo]);

  // 5. Desglose de Compras y Gastos por Categoría
  const reporteCategoriasCompra = useMemo(() => {
    const mapa = new Map<
      string,
      {
        id: string;
        nombre: string;
        esGasto: boolean;
        cantidad: number;
        total: number;
        porcentaje: number;
      }
    >();

    todosDocsPeriodo.forEach((d) => {
      const catId = d.categoriaId || 'general';
      const catNombre = catMap.get(catId) || (d.esGasto ? 'Gastos Varios' : 'Compra de Mercancía');
      const item = mapa.get(catId) || {
        id: catId,
        nombre: catNombre,
        esGasto: d.esGasto,
        cantidad: 0,
        total: 0,
        porcentaje: 0,
      };
      item.cantidad += 1;
      item.total += d.total;
      mapa.set(catId, item);
    });

    const granTotal = resumenFinanciero.totalEgresos;
    return Array.from(mapa.values())
      .map((item) => ({
        ...item,
        total: Math.round(item.total),
        porcentaje: granTotal > 0 ? (item.total / granTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [todosDocsPeriodo, catMap, resumenFinanciero.totalEgresos]);

  // 6. Consolidado de Medios de Pago en Ventas
  const mediosPagoVentas = useMemo(() => {
    const mapa = new Map<string, { label: string; cantidad: number; total: number; porcentaje: number }>();
    // Cada forma de pago suma por separado; el saldo no pagado cuenta como crédito
    todasVentasPeriodo.forEach((v) => {
      for (const [medio, monto] of Object.entries(montosPorMedio(v))) {
        const info = getMedioPagoVentaInfo(medio);
        const item = mapa.get(info.label) || { label: info.label, cantidad: 0, total: 0, porcentaje: 0 };
        item.cantidad += 1;
        item.total += monto as number;
        mapa.set(info.label, item);
      }
    });
    const total = resumenFinanciero.totalVentas;
    return Array.from(mapa.values()).map((m) => ({
      ...m,
      total: Math.round(m.total),
      porcentaje: total > 0 ? (m.total / total) * 100 : 0,
    })).sort((a, b) => b.total - a.total);
  }, [todasVentasPeriodo, resumenFinanciero.totalVentas]);

  // 7. Consolidado de Medios de Pago en Compras
  const mediosPagoCompras = useMemo(() => {
    const mapa = new Map<string, { label: string; cantidad: number; total: number; porcentaje: number }>();
    todosDocsPeriodo.forEach((d) => {
      const info = getMedioPagoInfo(d.medioPago);
      const item = mapa.get(info.label) || { label: info.label, cantidad: 0, total: 0, porcentaje: 0 };
      item.cantidad += 1;
      item.total += d.total;
      mapa.set(info.label, item);
    });
    const total = resumenFinanciero.totalEgresos;
    return Array.from(mapa.values()).map((m) => ({
      ...m,
      total: Math.round(m.total),
      porcentaje: total > 0 ? (m.total / total) * 100 : 0,
    })).sort((a, b) => b.total - a.total);
  }, [todosDocsPeriodo, resumenFinanciero.totalEgresos]);

  // 8. Cuentas por Cobrar (Ventas pendientes a crédito)
  const cuentasPorCobrar = useMemo(() => {
    return ventas
      .filter((v) => saldoDeVenta(v) > 0)
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [ventas]);

  // 9. Cuentas por Pagar (Compras pendientes a proveedores)
  const cuentasPorPagar = useMemo(() => {
    return documentos
      .filter((d) => d.saldoPendiente > 0)
      .map((d) => {
        const dias = diasParaVencimiento(d.fechaVencimiento);
        let estadoCartera: 'vencida' | 'por_vencer' | 'vigente' = 'vigente';
        if (dias !== null) {
          if (dias < 0) estadoCartera = 'vencida';
          else if (dias <= 5) estadoCartera = 'por_vencer';
        }
        return { ...d, diasFaltantes: dias, estadoCartera };
      })
      .sort((a, b) => (a.diasFaltantes || 0) - (b.diasFaltantes || 0));
  }, [documentos]);

  // 10. Compras Acumuladas por Proveedor
  const reporteProveedores = useMemo(() => {
    const mapa = new Map<
      string,
      {
        nit: string;
        razonSocial: string;
        cantidadDocumentos: number;
        total: number;
        saldoPendiente: number;
      }
    >();

    todosDocsPeriodo.forEach((d) => {
      const nit = d.proveedor?.nit || 'SIN-NIT';
      const item = mapa.get(nit) || {
        nit,
        razonSocial: d.proveedor?.razonSocial || 'Proveedor',
        cantidadDocumentos: 0,
        total: 0,
        saldoPendiente: 0,
      };
      item.cantidadDocumentos += 1;
      item.total += d.total;
      item.saldoPendiente += d.saldoPendiente;
      mapa.set(nit, item);
    });

    return Array.from(mapa.values())
      .map((p) => ({
        ...p,
        total: Math.round(p.total),
        saldoPendiente: Math.round(p.saldoPendiente),
      }))
      .sort((a, b) => b.total - a.total);
  }, [todosDocsPeriodo]);

  // Manejo de exportación a Excel
  const handleExportarExcelPrincipal = () => {
    exportarReporteUtilidadYCategoriasExcel(
      periodoTexto,
      {
        ventasTotales: resumenFinanciero.totalVentas,
        comprasInventario: resumenFinanciero.totalCompras,
        gastosOperativos: resumenFinanciero.totalGastos,
        egresosTotales: resumenFinanciero.totalEgresos,
        utilidadNeta: resumenFinanciero.utilidadNeta,
        margenOperativo: resumenFinanciero.margenOperativo,
      },
      reporte7CategoriasVenta,
      reporteCategoriasCompra,
      ventasEnPeriodo,
      docsEnPeriodo,
      categorias,
      `VetCompras_Informe_${periodoTexto.replace(/[\s\(\)\:\/]+/g, '_')}.xlsx`
    );
    mostrarToast('success', 'Reporte Excel generado', 'Archivo descargado con Utilidad, Ventas por Categoría y Compras.');
  };

  const handleExportarTodaLaBase = () => {
    exportarTodaLaBaseAExcel(
      documentos,
      proveedores,
      categorias,
      centrosCosto,
      `VetCompras_Base_Completa_${fechaLocal()}.xlsx`
    );
    mostrarToast('success', 'Base de datos exportada', 'Excel completo generado con todas las compras y proveedores.');
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* Barra Superior: Selector de Período (Días, Meses, Años) y Empresa */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Reportes Financieros y Rendimiento Operativo
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>Período: <strong className="text-emerald-700 dark:text-emerald-400">{periodoTexto}</strong></span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                {empresaInfo.razonSocial} (NIT: {empresaInfo.nit}{empresaInfo.dv ? `-${empresaInfo.dv}` : ''})
              </span>
              <button
                type="button"
                onClick={() => setModalEmpresaAbierto(true)}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:hover:bg-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-colors"
              >
                <Pencil className="w-3 h-3" />
                <span>Editar empresa</span>
              </button>
            </div>
          </div>

          {/* Botones de Exportación */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportarExcelPrincipal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Informe a Excel</span>
            </button>
            <button
              onClick={handleExportarTodaLaBase}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs border border-slate-300 dark:border-slate-700 transition-all"
              title="Descarga todas las compras registradas en el sistema"
            >
              <Database className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">Base Completa</span>
            </button>
          </div>
        </div>

        {/* Controles de Selección de Período: DÍAS, MESES O AÑOS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-3 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Filtrar Período por:
            </label>
            <select
              value={periodoTipo}
              onChange={(e) => setPeriodoTipo(e.target.value as TipoPeriodoReporte)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-900 dark:text-white"
            >
              <option value="dia_especifico">Por Día (Día específico)</option>
              <option value="mes_actual">Mes Actual</option>
              <option value="mes_anterior">Mes Anterior</option>
              <option value="mes_especifico">Mes Específico (Mes y Año)</option>
              <option value="anio_actual">Año Completo (2025, 2026...)</option>
              <option value="personalizado">Rango de Días (Personalizado)</option>
            </select>
          </div>

          {/* Si eligió Día Específico */}
          {periodoTipo === 'dia_especifico' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Seleccione el Día
              </label>
              <input
                type="date"
                value={diaEspecifico}
                onChange={(e) => setDiaEspecifico(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-900 dark:text-white"
              />
            </div>
          )}

          {/* Si eligió Mes Específico */}
          {periodoTipo === 'mes_especifico' && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Mes
                </label>
                <select
                  value={mesSeleccionado}
                  onChange={(e) => setMesSeleccionado(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                >
                  <option value={1}>Enero</option>
                  <option value={2}>Febrero</option>
                  <option value={3}>Marzo</option>
                  <option value={4}>Abril</option>
                  <option value={5}>Mayo</option>
                  <option value={6}>Junio</option>
                  <option value={7}>Julio</option>
                  <option value={8}>Agosto</option>
                  <option value={9}>Septiembre</option>
                  <option value={10}>Octubre</option>
                  <option value={11}>Noviembre</option>
                  <option value={12}>Diciembre</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Año
                </label>
                <select
                  value={anioSeleccionado}
                  onChange={(e) => setAnioSeleccionado(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-emerald-700 dark:text-emerald-400"
                >
                  {aniosDisponibles.map((y) => (
                    <option key={y} value={y}>
                      Año {y}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Si eligió Año Completo */}
          {periodoTipo === 'anio_actual' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Año a Consultar
              </label>
              <select
                value={anioSeleccionado}
                onChange={(e) => setAnioSeleccionado(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-emerald-700 dark:text-emerald-400"
              >
                {aniosDisponibles.map((y) => (
                  <option key={y} value={y}>
                    Año {y} {y === 2025 ? '(Año 2025)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Si eligió Rango de Días Personalizado */}
          {periodoTipo === 'personalizado' && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Fecha Inicial
                </label>
                <input
                  type="date"
                  value={fechaInicioPersonalizada}
                  onChange={(e) => setFechaInicioPersonalizada(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Fecha Final
                </label>
                <input
                  type="date"
                  value={fechaFinPersonalizada}
                  onChange={(e) => setFechaFinPersonalizada(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                />
              </div>
            </>
          )}

          {/* Resumen rápido de registros encontrados */}
          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-400">
            <div className="text-xs">
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{todasVentasPeriodo.length}</span> ventas
              {' • '}
              <span className="font-bold text-amber-600 dark:text-amber-400">{todosDocsPeriodo.length}</span> compras/gastos
            </div>
          </div>
        </div>
      </div>

      {/* Tabs de Navegación de Reportes */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto text-xs font-semibold whitespace-nowrap scrollbar-none">
        {[
          { id: 1, label: '1. Estado de Utilidad y Rendimiento', icon: TrendingUp },
          { id: 2, label: '2. Ventas por Categoría (7 Categorías)', icon: Tag },
          { id: 3, label: '3. Compras y Gastos por Categoría', icon: Package },
          { id: 4, label: '4. Medios de Pago (Efectivo / Bancos)', icon: CreditCard },
          { id: 5, label: '5. Cartera (Por Cobrar y Por Pagar)', icon: Clock },
          { id: 6, label: '6. Compras por Proveedor', icon: Building },
        ].map((tab) => {
          const Icon = tab.icon;
          const activo = tabActivo === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => {
                setTabActivo(tab.id);
                setBusquedaTexto('');
              }}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
                activo
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50/50 dark:bg-emerald-950/20'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ============================================================ */}
      {/* TAB 1: ESTADO DE UTILIDAD Y RENDIMIENTO (VENTAS - EGRESOS) */}
      {/* ============================================================ */}
      {tabActivo === 1 && (
        <div className="space-y-6">
          {/* Tarjeta Principal de Utilidad */}
          <div className={`p-6 rounded-3xl border shadow-sm ${
            resumenFinanciero.utilidadNeta >= 0
              ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-teal-500/10 border-emerald-200 dark:border-emerald-800/80'
              : 'bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-amber-500/10 border-rose-200 dark:border-rose-800/80'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/80 dark:bg-slate-900/80 shadow-xs mb-2 text-slate-700 dark:text-slate-200">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Resultado Operativo del Período: {periodoTexto}</span>
                </div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Utilidad Neta Operativa (Ventas - Egresos)
                </p>
                <h2 className={`text-3xl sm:text-4xl font-black mt-1 ${
                  resumenFinanciero.utilidadNeta >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {formatCOP(resumenFinanciero.utilidadNeta)}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Margen Operativo sobre Ventas:{' '}
                  <strong className={resumenFinanciero.margenOperativo >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                    {resumenFinanciero.margenOperativo.toFixed(1)}%
                  </strong>
                </p>
              </div>

              {/* Comparativo de 3 Columnas: Ventas vs Compras vs Gastos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto">
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 block">
                    (+) Total Ventas
                  </span>
                  <span className="text-lg font-black text-slate-900 dark:text-white">
                    {formatCOP(resumenFinanciero.totalVentas)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {todasVentasPeriodo.length} operaciones
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 block">
                    (-) Compras Mercancía
                  </span>
                  <span className="text-lg font-black text-slate-900 dark:text-white">
                    {formatCOP(resumenFinanciero.totalCompras)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Insumos e inventario
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 block">
                    (-) Gastos Operativos
                  </span>
                  <span className="text-lg font-black text-slate-900 dark:text-white">
                    {formatCOP(resumenFinanciero.totalGastos)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Servicios, arriendo, otros
                  </span>
                </div>
              </div>
            </div>

            {/* Barra de Distribución Financiera */}
            {resumenFinanciero.totalVentas > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-200/60 dark:border-slate-800/80 space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <span>Distribución del Flujo de Caja en el Período</span>
                  <span>Egresos Totales: {formatCOP(resumenFinanciero.totalEgresos)}</span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
                  <div
                    className="h-full bg-amber-500"
                    style={{ width: `${Math.min(100, (resumenFinanciero.totalCompras / (resumenFinanciero.totalVentas || 1)) * 100)}%` }}
                    title={`Compras de Mercancía: ${formatCOP(resumenFinanciero.totalCompras)}`}
                  />
                  <div
                    className="h-full bg-rose-500"
                    style={{ width: `${Math.min(100, (resumenFinanciero.totalGastos / (resumenFinanciero.totalVentas || 1)) * 100)}%` }}
                    title={`Gastos Operativos: ${formatCOP(resumenFinanciero.totalGastos)}`}
                  />
                  {resumenFinanciero.utilidadNeta > 0 && (
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${Math.min(100, (resumenFinanciero.utilidadNeta / resumenFinanciero.totalVentas) * 100)}%` }}
                      title={`Utilidad Neta: ${formatCOP(resumenFinanciero.utilidadNeta)}`}
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    Compras Mercancía ({((resumenFinanciero.totalCompras / (resumenFinanciero.totalVentas || 1)) * 100).toFixed(1)}%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    Gastos Operativos ({((resumenFinanciero.totalGastos / (resumenFinanciero.totalVentas || 1)) * 100).toFixed(1)}%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    Utilidad Libre ({resumenFinanciero.margenOperativo.toFixed(1)}%)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Tabla de Desglose de Estado de Resultados Simple */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  Estado de Resultados Operativo (Sin Enredos Tributarios)
                </h4>
                <p className="text-xs text-slate-500">
                  Cifras reales en COP de ventas facturadas, compras de insumos y gastos operativos
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              <div className="p-4 flex items-center justify-between bg-emerald-50/30 dark:bg-emerald-950/20">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span className="font-bold text-slate-900 dark:text-white">Ventas Totales Facturadas</span>
                </div>
                <span className="font-black text-emerald-700 dark:text-emerald-400">
                  +{formatCOP(resumenFinanciero.totalVentas)}
                </span>
              </div>

              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 pl-4">
                  <span className="text-slate-600 dark:text-slate-300">(-) Compras de Mercancía e Insumos</span>
                </div>
                <span className="font-semibold text-amber-700 dark:text-amber-400">
                  -{formatCOP(resumenFinanciero.totalCompras)}
                </span>
              </div>

              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 pl-4">
                  <span className="text-slate-600 dark:text-slate-300">(-) Gastos de Servicios Públicos, Arriendos, Personal y Varios</span>
                </div>
                <span className="font-semibold text-rose-700 dark:text-rose-400">
                  -{formatCOP(resumenFinanciero.totalGastos)}
                </span>
              </div>

              <div className="p-4 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700 dark:text-slate-200">(=) Total Egresos del Período</span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatCOP(resumenFinanciero.totalEgresos)}
                </span>
              </div>

              <div className={`p-4 flex items-center justify-between ${
                resumenFinanciero.utilidadNeta >= 0 ? 'bg-emerald-100/60 dark:bg-emerald-950/60' : 'bg-rose-100/60 dark:bg-rose-950/60'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="font-black text-base text-slate-900 dark:text-white">
                    UTILIDAD NETA OPERATIVA
                  </span>
                </div>
                <span className={`text-xl font-black ${
                  resumenFinanciero.utilidadNeta >= 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
                }`}>
                  {formatCOP(resumenFinanciero.utilidadNeta)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: VENTAS POR CATEGORÍA (LAS 7 CATEGORÍAS OFICIALES) */}
      {/* ============================================================ */}
      {tabActivo === 2 && (
        <div className="space-y-6">
          {/* Header con Filtro rápido por las 7 categorías */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-emerald-600" />
                <span>Ventas Discriminadas por las 7 Categorías</span>
              </h4>
              <p className="text-xs text-slate-500">
                Baños, Vacunas, Consultas clinica, Tratamientos clinica, Purinas (bultos y paquetes), Purinas a granel, Vitrina
              </p>
            </div>

            {/* Selector de Categoría específico */}
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                Categoría:
              </label>
              <select
                value={filtroCategoriaVenta}
                onChange={(e) => {
                  setFiltroCategoriaVenta(e.target.value);
                  setFiltroSubcategoriaVenta('todas');
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
              >
                <option value="todas">Todas las 7 Categorías</option>
                {CATEGORIAS_VENTA_DEF.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>

              {/* Subcategoría dinámica para cualquier categoría seleccionada */}
              {filtroCategoriaVenta !== 'todas' && SUBCATEGORIAS_POR_CATEGORIA[filtroCategoriaVenta] && (
                <select
                  value={filtroSubcategoriaVenta}
                  onChange={(e) => setFiltroSubcategoriaVenta(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 font-bold text-emerald-900 dark:text-emerald-200 text-xs"
                >
                  <option value="todas">Todas las subcategorías (incluye Varios)</option>
                  {SUBCATEGORIAS_POR_CATEGORIA[filtroCategoriaVenta].map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Tarjetas Visuales de las 7 Categorías de Venta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {reporte7CategoriasVenta.map((cat) => {
              const def = CATEGORIAS_VENTA_DEF.find((c) => c.key === cat.categoriaKey) || CATEGORIAS_VENTA_DEF[0];
              const Icon = def.icon;
              const isSelected = filtroCategoriaVenta === cat.categoriaKey;

              return (
                <div
                  key={cat.categoriaKey}
                  onClick={() => {
                    setFiltroCategoriaVenta(filtroCategoriaVenta === cat.categoriaKey ? 'todas' : cat.categoriaKey);
                    setFiltroSubcategoriaVenta('todas');
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 border-emerald-300'
                      : `${def.bgLight} ${def.borderLight} hover:shadow-sm`
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-xl bg-white dark:bg-slate-900 shadow-xs ${def.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
                        {cat.nombre}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-500">
                      {cat.porcentaje.toFixed(1)}%
                    </span>
                  </div>

                  <div className="mt-1">
                    <div className="text-xl font-black text-slate-900 dark:text-white">
                      {formatCOP(cat.total)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                      <span>{cat.cantidad} venta{cat.cantidad !== 1 ? 's' : ''}</span>
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                        {isSelected ? 'Filtro Activo' : 'Clic para filtrar'}
                      </span>
                    </div>
                  </div>

                  {/* Barra de progreso */}
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-2.5 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.min(100, cat.porcentaje)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Subdivisión Visual cuando se selecciona TRATAMIENTOS CLÍNICA */}
          {filtroCategoriaVenta === 'tratamientos_clinica' && (
            <div className="p-4 sm:p-5 rounded-3xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-3 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h5 className="font-bold text-xs sm:text-sm text-indigo-950 dark:text-indigo-200">
                    Subdivisión de Tratamientos Clínicos (7 Tipos)
                  </h5>
                </div>
                <div className="text-[11px] text-indigo-700 dark:text-indigo-400 font-medium">
                  {filtroSubcategoriaVenta !== 'todas' ? (
                    <button
                      onClick={() => setFiltroSubcategoriaVenta('todas')}
                      className="underline font-bold"
                    >
                      Restablecer (Ver todos los tratamientos)
                    </button>
                  ) : (
                    'Haga clic en un tipo para filtrar'
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
                {reporteSubcategoriasTratamientos.map((sub) => {
                  const activo = filtroSubcategoriaVenta === sub.key;
                  return (
                    <button
                      key={sub.key}
                      onClick={() => setFiltroSubcategoriaVenta(activo ? 'todas' : sub.key)}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        activo
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-400'
                          : 'bg-white dark:bg-slate-900 border-indigo-100 dark:border-indigo-900/60 hover:border-indigo-300'
                      }`}
                    >
                      <div className="text-[11px] font-bold line-clamp-1 mb-1">
                        {sub.label}
                      </div>
                      <div className={`text-xs font-black truncate ${activo ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                        {formatCOP(sub.total)}
                      </div>
                      <div className={`text-[10px] mt-0.5 flex justify-between ${activo ? 'text-indigo-200' : 'text-slate-400'}`}>
                        <span>{sub.cantidad} venta{sub.cantidad !== 1 ? 's' : ''}</span>
                        <span>{sub.porcentaje.toFixed(0)}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Subdivisión Visual cuando se selecciona VITRINA */}
          {filtroCategoriaVenta === 'vitrina' && (
            <div className="p-4 sm:p-5 rounded-3xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 space-y-3 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <h5 className="font-bold text-xs sm:text-sm text-rose-950 dark:text-rose-200">
                    Subdivisión de Productos Vitrina (7 Tipos)
                  </h5>
                </div>
                <div className="text-[11px] text-rose-700 dark:text-rose-400 font-medium">
                  {filtroSubcategoriaVenta !== 'todas' ? (
                    <button
                      onClick={() => setFiltroSubcategoriaVenta('todas')}
                      className="underline font-bold"
                    >
                      Restablecer (Ver todos los productos de vitrina)
                    </button>
                  ) : (
                    'Haga clic en un tipo para filtrar'
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
                {reporteSubcategoriasVitrina.map((sub) => {
                  const activo = filtroSubcategoriaVenta === sub.key;
                  return (
                    <button
                      key={sub.key}
                      onClick={() => setFiltroSubcategoriaVenta(activo ? 'todas' : sub.key)}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        activo
                          ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-400'
                          : 'bg-white dark:bg-slate-900 border-rose-100 dark:border-rose-900/60 hover:border-rose-300'
                      }`}
                    >
                      <div className="text-[11px] font-bold line-clamp-1 mb-1">
                        {sub.label}
                      </div>
                      <div className={`text-xs font-black truncate ${activo ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                        {formatCOP(sub.total)}
                      </div>
                      <div className={`text-[10px] mt-0.5 flex justify-between ${activo ? 'text-rose-200' : 'text-slate-400'}`}>
                        <span>{sub.cantidad} venta{sub.cantidad !== 1 ? 's' : ''}</span>
                        <span>{sub.porcentaje.toFixed(0)}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Listado de Ventas Filtradas con Buscador */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  Detalle de Ventas ({ventasEnPeriodo.length} registros en {periodoTexto})
                </h4>
                <p className="text-xs text-slate-500">
                  Total filtrado: <strong className="text-emerald-600">{formatCOP(ventasEnPeriodo.reduce((acc, v) => acc + v.monto, 0))}</strong>
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar venta, cliente, mascota..."
                  value={busquedaTexto}
                  onChange={(e) => setBusquedaTexto(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Consecutivo</th>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4">Concepto / Producto</th>
                    <th className="py-3 px-4">Cliente / Mascota</th>
                    <th className="py-3 px-4">Medio Pago</th>
                    <th className="py-3 px-4 text-right">Monto (COP)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ventasEnPeriodo.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No se encontraron ventas para este período o categoría.
                      </td>
                    </tr>
                  ) : (
                    ventasEnPeriodo.map((v) => {
                      const catInfo = getCategoriaVentaInfo(v.categoria);
                      const subInfo = getSubcategoriaVentaInfo(v.categoria, v.subcategoria);
                      const medioInfo = getMedioPagoVentaInfo(v.medioPago);
                      return (
                        <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                            {v.consecutivo}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            {formatFecha(v.fecha)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1 items-start">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-semibold ${catInfo.badgeColor}`}>
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
                          <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200 max-w-xs truncate">
                            {v.concepto}
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {v.clienteNombre ? (
                              <span>
                                <strong className="text-slate-700 dark:text-slate-300">{v.clienteNombre}</strong>
                                {v.mascotaNombre && ` (${v.mascotaNombre})`}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                              {medioInfo.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">
                            {formatCOP(v.monto)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: COMPRAS Y GASTOS POR CATEGORÍA */}
      {/* ============================================================ */}
      {tabActivo === 3 && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-600" />
                <span>Compras y Gastos Discriminados por Categoría</span>
              </h4>
              <p className="text-xs text-slate-500">
                Compra de mercancía, Gasto servicios públicos, Gastos arrendamientos, Gastos de personal, Gastos varios
              </p>
            </div>

            {/* Selector de Categoría de compra */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                Categoría:
              </label>
              <select
                value={filtroCategoriaCompra}
                onChange={(e) => setFiltroCategoriaCompra(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
              >
                <option value="todas">Todas las Categorías de Compra/Gasto</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tarjetas de Categorías de Compra y Gasto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {reporteCategoriasCompra.map((cat) => (
              <div
                key={cat.id}
                onClick={() => setFiltroCategoriaCompra(filtroCategoriaCompra === cat.id ? 'todas' : cat.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  filtroCategoriaCompra === cat.id
                    ? 'ring-2 ring-amber-500 bg-amber-50/50 dark:bg-amber-950/40 border-amber-300'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                    cat.esGasto
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                  }`}>
                    {cat.esGasto ? 'Gasto Operativo' : 'Compra Mercancía'}
                  </span>
                  <span className="text-xs font-bold text-slate-500">{cat.porcentaje.toFixed(1)}%</span>
                </div>
                <h5 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">{cat.nombre}</h5>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  {formatCOP(cat.total)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                  <span>{cat.cantidad} factura{cat.cantidad !== 1 ? 's' : ''}</span>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                    {filtroCategoriaCompra === cat.id ? 'Filtro Activo' : 'Clic para filtrar'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Listado de Documentos de Compra */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  Documentos de Compras y Gastos ({docsEnPeriodo.length} registros)
                </h4>
                <p className="text-xs text-slate-500">
                  Total: <strong className="text-amber-600">{formatCOP(docsEnPeriodo.reduce((acc, d) => acc + d.total, 0))}</strong>
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar proveedor o factura..."
                  value={busquedaTexto}
                  onChange={(e) => setBusquedaTexto(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Factura</th>
                    <th className="py-3 px-4">Proveedor</th>
                    <th className="py-3 px-4">NIT</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4 text-right">Total (COP)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {docsEnPeriodo.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No se encontraron compras ni gastos para los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    docsEnPeriodo.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {formatFecha(d.fechaEmision)}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          {d.folio}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                          {d.proveedor?.razonSocial || 'Proveedor'}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                          {d.proveedor?.nit || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                            {catMap.get(d.categoriaId) || 'General'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            d.esGasto
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                          }`}>
                            {d.esGasto ? 'Gasto' : 'Compra'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">
                          {formatCOP(d.total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: MEDIOS DE PAGO (EFECTIVO VS ELECTRÓNICO VS CRÉDITO) */}
      {/* ============================================================ */}
      {tabActivo === 4 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Medios de Pago en Ventas */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    Medios de Pago en Ventas
                  </h4>
                  <p className="text-xs text-slate-500">
                    Total recaudado: <strong className="text-emerald-600">{formatCOP(resumenFinanciero.totalVentas)}</strong>
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {mediosPagoVentas.map((m) => (
                  <div key={m.label} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{m.label}</span>
                      <span className="font-black text-slate-900 dark:text-white">{formatCOP(m.total)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                      <span>{m.cantidad} transacciones</span>
                      <span className="font-bold">{m.porcentaje.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, m.porcentaje)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Medios de Pago en Compras */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    Medios de Pago en Compras y Gastos
                  </h4>
                  <p className="text-xs text-slate-500">
                    Total pagado: <strong className="text-amber-600">{formatCOP(resumenFinanciero.totalEgresos)}</strong>
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {mediosPagoCompras.map((m) => (
                  <div key={m.label} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{m.label}</span>
                      <span className="font-black text-slate-900 dark:text-white">{formatCOP(m.total)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                      <span>{m.cantidad} facturas</span>
                      <span className="font-bold">{m.porcentaje.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: `${Math.min(100, m.porcentaje)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 5: CARTERA (POR COBRAR Y POR PAGAR) */}
      {/* ============================================================ */}
      {tabActivo === 5 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-3xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60">
              <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                Cartera por Cobrar (Clientes a Crédito)
              </span>
              <h3 className="text-2xl font-black text-blue-950 dark:text-white mt-1">
                {formatCOP(resumenFinanciero.carteraPorCobrar)}
              </h3>
              <p className="text-xs text-blue-700/80 dark:text-blue-400 mt-1">
                {cuentasPorCobrar.length} ventas pendientes de cobro
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                Cartera por Pagar (Cuentas a Proveedores)
              </span>
              <h3 className="text-2xl font-black text-amber-950 dark:text-white mt-1">
                {formatCOP(resumenFinanciero.carteraPorPagar)}
              </h3>
              <p className="text-xs text-amber-700/80 dark:text-amber-400 mt-1">
                {cuentasPorPagar.length} facturas de compras con saldo pendiente
              </p>
            </div>
          </div>

          {/* Subpanel 1: Clientes a Crédito */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Ventas a Crédito Pendientes de Cobro
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Consecutivo</th>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Teléfono</th>
                    <th className="py-3 px-4">Concepto</th>
                    <th className="py-3 px-4 text-right">Saldo por Cobrar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {cuentasPorCobrar.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        No hay ventas pendientes por cobrar a clientes.
                      </td>
                    </tr>
                  ) : (
                    cuentasPorCobrar.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{v.consecutivo}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{formatFecha(v.fecha)}</td>
                        <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">{v.clienteNombre || 'Cliente'}</td>
                        <td className="py-3 px-4 text-slate-500">{v.clienteTelefono || '-'}</td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{v.concepto}</td>
                        <td className="py-3 px-4 text-right font-black text-blue-600 dark:text-blue-400">
                          {formatCOP(saldoDeVenta(v))}
                          {saldoDeVenta(v) < v.monto && (
                            <div className="text-[10px] font-normal text-slate-400">de {formatCOP(v.monto)}</div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Subpanel 2: Cuentas por Pagar a Proveedores */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Facturas de Compra Pendientes de Pago (Proveedores)
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Factura</th>
                    <th className="py-3 px-4">Proveedor</th>
                    <th className="py-3 px-4">NIT</th>
                    <th className="py-3 px-4">Vencimiento</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Saldo Pendiente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {cuentasPorPagar.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        No hay facturas pendientes de pago a proveedores.
                      </td>
                    </tr>
                  ) : (
                    cuentasPorPagar.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{d.folio}</td>
                        <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">{d.proveedor?.razonSocial}</td>
                        <td className="py-3 px-4 font-mono text-slate-500">{d.proveedor?.nit}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{formatFecha(d.fechaVencimiento)}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            d.estadoCartera === 'vencida'
                              ? 'bg-rose-100 text-rose-800'
                              : d.estadoCartera === 'por_vencer'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {d.estadoCartera === 'vencida' ? 'Vencida' : d.estadoCartera === 'por_vencer' ? 'Por Vencer' : 'Vigente'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-rose-600 dark:text-rose-400">
                          {formatCOP(d.saldoPendiente)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 6: COMPRAS POR PROVEEDOR */}
      {/* ============================================================ */}
      {tabActivo === 6 && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Compras Acumuladas por Proveedor en {periodoTexto}
              </h4>
              <p className="text-xs text-slate-500">
                Total acumulado con {reporteProveedores.length} proveedores registrados
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">NIT / Cédula</th>
                    <th className="py-3 px-4">Razón Social Proveedor</th>
                    <th className="py-3 px-4 text-center">Facturas</th>
                    <th className="py-3 px-4 text-right">Saldo Pendiente</th>
                    <th className="py-3 px-4 text-right">Total Acumulado (COP)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {reporteProveedores.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No hay compras registradas en este período.
                      </td>
                    </tr>
                  ) : (
                    reporteProveedores.map((p) => (
                      <tr key={p.nit} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          {p.nit}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                          {p.razonSocial}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-400">
                          {p.cantidadDocumentos}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-amber-600">
                          {formatCOP(p.saldoPendiente)}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">
                          {formatCOP(p.total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal para editar los datos de la empresa veterinaria */}
      {modalEmpresaAbierto && (
        <ModalDatosEmpresa
          abierto={modalEmpresaAbierto}
          onCerrar={() => setModalEmpresaAbierto(false)}
          onGuardado={(actualizado) => {
            setEmpresaInfo(actualizado);
            mostrarToast('success', 'Datos de la empresa actualizados', 'La información de la clínica veterinaria fue guardada.');
          }}
        />
      )}
    </div>
  );
};
