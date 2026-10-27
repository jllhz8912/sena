import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  DollarSign,
  AlertCircle,
  FileCheck,
  Calendar,
  ArrowUpRight,
  Clock,
  Sparkles,
  PieChart as PieIcon,
  BarChart2,
  AlertTriangle,
  Receipt,
  Users,
  ChevronDown,
  FileSpreadsheet,
  UploadCloud,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import { CompraDocumento, Categoria, CentroCosto, Venta } from '../../types';
import { formatCOP, formatFecha, diasParaVencimiento } from '../../utils/formatters';
import { saldoDeVenta } from '../../utils/ventas';

interface DashboardViewProps {
  documentos: CompraDocumento[];
  categorias: Categoria[];
  centrosCosto: CentroCosto[];
  ventas?: Venta[];
  onIrACompras: () => void;
  onIrAVentas?: () => void;
  onIrACargarFactura: () => void;
  onIrACargarExcel?: () => void;
  onIrAReportes?: () => void;
}

const PALETA_COLORES = [
  '#0d9488', // teal-600
  '#16a34a', // green-600
  '#0284c7', // sky-600
  '#6366f1', // indigo-500
  '#eab308', // yellow-500
  '#ec4899', // pink-500
  '#f97316', // orange-500
  '#8b5cf6', // violet-500
  '#14b8a6', // teal-500
  '#64748b', // slate-500
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  documentos,
  categorias,
  centrosCosto,
  ventas = [],
  onIrACompras,
  onIrAVentas,
  onIrACargarFactura,
  onIrACargarExcel,
  onIrAReportes,
}) => {
  const anioActualSistema = new Date().getFullYear();
  // Por defecto: Año en curso
  const [anioSeleccionado, setAnioSeleccionado] = useState<number>(anioActualSistema);

  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);
  const ccMap = useMemo(() => new Map(centrosCosto.map((cc) => [cc.id, cc])), [centrosCosto]);

  // Ventas del año seleccionado
  const ventasDelAnio = useMemo(() => {
    return (ventas || []).filter((v) => {
      const y = parseInt((v.fecha || '').split('-')[0], 10);
      return y === anioSeleccionado;
    });
  }, [ventas, anioSeleccionado]);

  const totalVentasAnio = useMemo(() => {
    return ventasDelAnio.reduce((acc, v) => acc + v.monto, 0);
  }, [ventasDelAnio]);

  // Lista de años disponibles basados en las facturas registradas
  const aniosDisponibles = useMemo(() => {
    const aniosSet = new Set<number>([anioActualSistema, anioActualSistema - 1]);
    documentos.forEach((d) => {
      const y = parseInt(d.fechaEmision.split('-')[0], 10);
      if (!isNaN(y)) aniosSet.add(y);
    });
    return Array.from(aniosSet).sort((a, b) => b - a);
  }, [documentos, anioActualSistema]);

  // Documentos del Año Seleccionado
  const docsDelAnio = useMemo(() => {
    return documentos.filter((d) => {
      const y = parseInt(d.fechaEmision.split('-')[0], 10);
      return y === anioSeleccionado;
    });
  }, [documentos, anioSeleccionado]);

  // Documentos del Año Anterior para comparativos
  const docsDelAnioAnterior = useMemo(() => {
    return documentos.filter((d) => {
      const y = parseInt(d.fechaEmision.split('-')[0], 10);
      return y === anioSeleccionado - 1;
    });
  }, [documentos, anioSeleccionado]);

  // Métricas Anuales Clave
  const metricas = useMemo(() => {
    let comprasAnio = 0;
    let gastosAnio = 0;
    let ivaAnio = 0;
    let retencionesAnio = 0;

    docsDelAnio.forEach((d) => {
      if (d.esGasto) {
        gastosAnio += d.total;
      } else {
        comprasAnio += d.total;
      }
      ivaAnio += d.totalIva;
      retencionesAnio += d.totalRetenciones;
    });

    let comprasAnioAnt = 0;
    let gastosAnioAnt = 0;
    docsDelAnioAnterior.forEach((d) => {
      if (d.esGasto) {
        gastosAnioAnt += d.total;
      } else {
        comprasAnioAnt += d.total;
      }
    });

    // Cuentas por pagar actuales activas (cartera)
    let totalCuentasPorPagar = 0;
    let facturasVencidasCount = 0;
    let facturasPorVencerCount = 0;

    documentos.forEach((d) => {
      if (d.saldoPendiente > 0) {
        totalCuentasPorPagar += d.saldoPendiente;
        const dias = diasParaVencimiento(d.fechaVencimiento);
        if (dias !== null) {
          if (dias < 0) facturasVencidasCount++;
          else if (dias <= 5) facturasPorVencerCount++;
        }
      }
    });

    const totalCarteraCobrar = ventasDelAnio.reduce((acc, v) => acc + saldoDeVenta(v), 0);
    const ventasPendientesCount = ventasDelAnio.filter((v) => saldoDeVenta(v) > 0).length;

    const diffComprasPct =
      comprasAnioAnt > 0
        ? Math.round(((comprasAnio - comprasAnioAnt) / comprasAnioAnt) * 100)
        : null;

    const diffGastosPct =
      gastosAnioAnt > 0
        ? Math.round(((gastosAnio - gastosAnioAnt) / gastosAnioAnt) * 100)
        : null;

    return {
      comprasAnio,
      gastosAnio,
      ivaAnio,
      retencionesAnio,
      totalEgresos: comprasAnio + gastosAnio,
      totalCuentasPorPagar,
      totalCarteraCobrar,
      facturasVencidasCount,
      facturasPorVencerCount,
      ventasPendientesCount,
      diffComprasPct,
      diffGastosPct,
    };
  }, [docsDelAnio, docsDelAnioAnterior, documentos, ventasDelAnio]);

  // Datos para Gráfico de Evolución Mensual del Año (Ene a Dic)
  const datosEvolucionMeses = useMemo(() => {
    const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const meses = mesesNombres.map((nombre, idx) => ({
      mesNum: idx + 1,
      nombre,
      ventas: 0,
      compras: 0,
      gastos: 0,
    }));

    docsDelAnio.forEach((d) => {
      const [, mStr] = d.fechaEmision.split('-');
      const m = parseInt(mStr, 10);
      if (m >= 1 && m <= 12) {
        const item = meses[m - 1];
        if (d.esGasto) {
          item.gastos += d.total;
        } else {
          item.compras += d.total;
        }
      }
    });

    ventasDelAnio.forEach((v) => {
      const [, mStr] = (v.fecha || '').split('-');
      const m = parseInt(mStr, 10);
      if (m >= 1 && m <= 12) {
        meses[m - 1].ventas += v.monto;
      }
    });

    return meses;
  }, [docsDelAnio, ventasDelAnio]);

  // Datos para Gráfico de Distribución por Categoría (Año en curso)
  const datosCategorias = useMemo(() => {
    const mapa = new Map<string, number>();

    docsDelAnio.forEach((doc) => {
      const cat = catMap.get(doc.categoriaId);
      const nombre = cat?.nombre || 'Otras';
      mapa.set(nombre, (mapa.get(nombre) || 0) + doc.total);
    });

    return Array.from(mapa.entries())
      .map(([nombre, valor]) => ({ nombre, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 6);
  }, [docsDelAnio, catMap]);

  // Datos para Top 10 Proveedores del Año
  const datosTopProveedores = useMemo(() => {
    const mapa = new Map<string, number>();

    docsDelAnio.forEach((doc) => {
      const nombre = doc.proveedor?.razonSocial || 'Desconocido';
      mapa.set(nombre, (mapa.get(nombre) || 0) + doc.total);
    });

    return Array.from(mapa.entries())
      .map(([nombre, total]) => ({
        nombre: nombre.length > 22 ? nombre.substring(0, 22) + '...' : nombre,
        total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [docsDelAnio]);

  // Datos por Centro de Costo del Año
  const datosCentrosCosto = useMemo(() => {
    const mapa = new Map<string, number>();

    docsDelAnio.forEach((doc) => {
      const cc = ccMap.get(doc.centroCostoId);
      const nombre = cc?.nombre || 'General';
      mapa.set(nombre, (mapa.get(nombre) || 0) + doc.total);
    });

    return Array.from(mapa.entries()).map(([nombre, valor]) => ({
      nombre,
      valor,
    }));
  }, [docsDelAnio, ccMap]);

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Selector Principal del Año en Curso en el Panel Central */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Panel Central • {anioSeleccionado === anioActualSistema ? `Año en Curso (${anioSeleccionado})` : `Año Gravable ${anioSeleccionado}`}
            </h2>
            {anioSeleccionado === anioActualSistema ? (
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                Año en Curso
              </span>
            ) : (
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                Histórico
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Consolidado anual de compras, insumos veterinarios, gastos operativos y declaraciones DIAN del año {anioSeleccionado}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Selector de Año */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Año:
            </label>
            <select
              value={anioSeleccionado}
              onChange={(e) => setAnioSeleccionado(Number(e.target.value))}
              className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-emerald-500"
            >
              {aniosDisponibles.map((y) => (
                <option key={y} value={y}>
                  Año {y} {y === anioActualSistema ? '(Año en Curso)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Acceso rápido a Cargar Excel */}
          {onIrACargarExcel && (
            <button
              onClick={onIrACargarExcel}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900/60 text-teal-800 dark:text-teal-200 text-xs font-semibold border border-teal-200 dark:border-teal-800 transition-colors"
              title="Importar facturas masivamente desde Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Importar Excel</span>
            </button>
          )}

          {/* Acceso a Reportes por Períodos */}
          {onIrAReportes && (
            <button
              onClick={onIrAReportes}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors"
              title="Consultar por Bimestres, Cuatrimestres o Meses"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Reportes por Períodos</span>
            </button>
          )}
        </div>
      </div>

      {/* Alerta de Cuentas por Pagar Vencidas si existen */}
      {metricas.facturasVencidasCount > 0 && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                ¡Tienes {metricas.facturasVencidasCount} factura(s) de proveedores vencidas!
              </h4>
              <p className="text-xs text-rose-700 dark:text-rose-300">
                Revisa los plazos de crédito para evitar intereses o suspensión de despachos médicos.
              </p>
            </div>
          </div>
          <button
            onClick={onIrACompras}
            className="text-xs font-bold px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-sm"
          >
            Ver Cartera
          </button>
        </div>
      )}

      {/* Resumen Ejecutivo: Ventas vs Egresos de la Veterinaria */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1">
            <span className="text-xs font-bold text-emerald-400 tracking-wider uppercase">
              Balance General de la Veterinaria • Año {anioSeleccionado}
            </span>
            <h3 className="text-xl sm:text-2xl font-black">
              Ingresos por Ventas vs. Compras y Gastos
            </h3>
            <p className="text-xs text-slate-300 max-w-xl">
              Consolida las ventas de Pet Shop, Clínica, Baños, Purinas y Medicamentos frente a todas las facturas y compras operativas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10">
              <span className="text-[11px] font-bold text-emerald-300 block">Ventas Registradas</span>
              <span className="text-lg sm:text-xl font-black text-white">{formatCOP(totalVentasAnio)}</span>
              <span className="text-[10px] text-slate-300 block">{ventasDelAnio.length} ventas</span>
            </div>

            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10">
              <span className="text-[11px] font-bold text-rose-300 block">Egresos Totales</span>
              <span className="text-lg sm:text-xl font-black text-white">{formatCOP(metricas.totalEgresos)}</span>
              <span className="text-[10px] text-slate-300 block">Compras + Gastos</span>
            </div>

            <div className={`px-4 py-3 rounded-2xl border ${
              totalVentasAnio - metricas.totalEgresos >= 0
                ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                : 'bg-rose-500/20 border-rose-400/40 text-rose-200'
            }`}>
              <span className="text-[11px] font-bold block">Flujo Neto Estimado</span>
              <span className="text-lg sm:text-xl font-black text-white">
                {formatCOP(totalVentasAnio - metricas.totalEgresos)}
              </span>
              <span className="text-[10px] block opacity-80">
                {totalVentasAnio - metricas.totalEgresos >= 0 ? 'Margen positivo' : 'Déficit operativo'}
              </span>
            </div>

            {onIrAVentas && (
              <button
                onClick={onIrAVentas}
                className="px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                Abrir Módulo de Ventas →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tarjetas de Métricas Clave del Año (Datos Enteros: Compras, Gastos, Cartera por Pagar, Cartera por Cobrar) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Compras del Año */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Compras {anioSeleccionado}</span>
            <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xl font-black text-slate-900 dark:text-white">
              {formatCOP(metricas.comprasAnio)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              {metricas.diffComprasPct !== null ? (
                metricas.diffComprasPct >= 0 ? (
                  <span className="text-emerald-600 font-bold flex items-center">
                    <TrendingUp className="w-3 h-3" /> +{metricas.diffComprasPct}%
                  </span>
                ) : (
                  <span className="text-rose-600 font-bold flex items-center">
                    <TrendingDown className="w-3 h-3" /> {metricas.diffComprasPct}%
                  </span>
                )
              ) : (
                <span>Mercancía e insumos</span>
              )}
              <span className="text-slate-400">vs {anioSeleccionado - 1}</span>
            </p>
          </div>
        </div>

        {/* Gastos Operativos del Año */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Gastos {anioSeleccionado}</span>
            <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xl font-black text-slate-900 dark:text-white">
              {formatCOP(metricas.gastosAnio)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              {metricas.diffGastosPct !== null ? (
                metricas.diffGastosPct >= 0 ? (
                  <span className="text-emerald-600 font-bold flex items-center">
                    <TrendingUp className="w-3 h-3" /> +{metricas.diffGastosPct}%
                  </span>
                ) : (
                  <span className="text-rose-600 font-bold flex items-center">
                    <TrendingDown className="w-3 h-3" /> {metricas.diffGastosPct}%
                  </span>
                )
              ) : (
                <span>Servicios, arriendo, personal</span>
              )}
              <span className="text-slate-400">vs {anioSeleccionado - 1}</span>
            </p>
          </div>
        </div>

        {/* Total Egresos (Compras + Gastos) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Egresos {anioSeleccionado}</span>
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xl font-black text-slate-900 dark:text-white">
              {formatCOP(metricas.totalEgresos)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Compras + Gastos Operativos
            </p>
          </div>
        </div>

        {/* Cartera Proveedores (Cuentas por Pagar) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Cartera por Pagar</span>
            <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xl font-black text-rose-600 dark:text-rose-400">
              {formatCOP(metricas.totalCuentasPorPagar)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {metricas.facturasVencidasCount > 0 ? (
                <span className="text-rose-600 font-bold">
                  {metricas.facturasVencidasCount} factura(s) vencidas
                </span>
              ) : (
                'Facturas a crédito pendientes'
              )}
            </p>
          </div>
        </div>

        {/* Cartera Clientes (Cuentas por Cobrar) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Cartera por Cobrar</span>
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xl font-black text-amber-600 dark:text-amber-400">
              {formatCOP(metricas.totalCarteraCobrar)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {metricas.ventasPendientesCount > 0 ? (
                <span className="text-amber-600 font-bold">
                  {metricas.ventasPendientesCount} venta(s) a crédito
                </span>
              ) : (
                'Ventas a clientes al día'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Gráficos Principales: Evolución 12 Meses del Año y Categorías */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Gráfico de Evolución Mensual del Año (8 columnas) */}
        <div className="lg:col-span-8 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Evolución Mes a Mes ({anioSeleccionado}): Ventas vs Compras vs Gastos
              </h3>
              <p className="text-xs text-slate-400">
                Comparativo mensual consolidado de ventas, compras de mercancía y gastos de la veterinaria.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium shrink-0">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                Ventas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-sky-600 inline-block" />
                Compras
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" />
                Gastos
              </span>
            </div>
          </div>

          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datosEvolucionMeses} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="nombre" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `$ ${(val / 1000000).toFixed(1)}M`}
                />
                <Tooltip
                  formatter={(val: any) => [formatCOP(Number(val)), '']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '12px',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="ventas" name="Ventas" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="compras" name="Compras (Mercancía/Insumos)" fill="#0284c7" radius={[6, 6, 0, 0]} />
                <Bar dataKey="gastos" name="Gastos Operativos" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Dona: Distribución por Categoría (4 columnas) */}
        <div className="lg:col-span-4 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Distribución por Categoría ({anioSeleccionado})
            </h3>
            <p className="text-xs text-slate-400">
              Categorías con mayor participación en el año {anioSeleccionado}.
            </p>
          </div>

          <div className="h-56 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={datosCategorias}
                  dataKey="valor"
                  nameKey="nombre"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                >
                  {datosCategorias.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PALETA_COLORES[index % PALETA_COLORES.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [formatCOP(Number(val)), '']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '12px',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 text-xs">
            {datosCategorias.slice(0, 4).map((c, i) => (
              <div key={i} className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-2 truncate max-w-[170px]">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: PALETA_COLORES[i % PALETA_COLORES.length] }}
                  />
                  <span className="truncate">{c.nombre}</span>
                </span>
                <span className="font-bold">{formatCOP(c.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gráficos Secundarios: Top Proveedores y Centros de Costo del Año */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Proveedores (7 columnas) */}
        <div className="lg:col-span-7 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Top Proveedores Más Comprados en {anioSeleccionado}
            </h3>
            <span className="text-xs text-slate-400">Total en el año</span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={datosTopProveedores}
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
                <XAxis
                  type="number"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickFormatter={(v) => `$ ${(v / 1000000).toFixed(1)}M`}
                />
                <YAxis dataKey="nombre" type="category" stroke="#94a3b8" fontSize={10} width={105} />
                <Tooltip
                  formatter={(val: any) => [formatCOP(Number(val)), 'Total']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '12px',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="total" fill="#0d9488" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gasto por Centro de Costo (5 columnas) */}
        <div className="lg:col-span-5 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Presupuesto por Centro de Costo ({anioSeleccionado})
            </h3>
            <p className="text-xs text-slate-400">
              Distribución en Clínica, Tienda/Petshop, Peluquería y Administración durante {anioSeleccionado}.
            </p>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={datosCentrosCosto}
                  dataKey="valor"
                  nameKey="nombre"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                >
                  {datosCentrosCosto.map((_, i) => (
                    <Cell key={`cc-${i}`} fill={PALETA_COLORES[(i + 2) % PALETA_COLORES.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [formatCOP(Number(val)), '']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '12px',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 text-xs">
            {datosCentrosCosto.map((cc, i) => (
              <div key={i} className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: PALETA_COLORES[(i + 2) % PALETA_COLORES.length] }}
                  />
                  <span>{cc.nombre}</span>
                </span>
                <span className="font-bold">{formatCOP(cc.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
