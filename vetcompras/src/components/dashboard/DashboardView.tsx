import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  DollarSign,
  Calendar,
  ArrowUpRight,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import { CompraDocumento, Categoria, CentroCosto, Venta } from '../../types';
import { formatCOP, diasParaVencimiento, getCategoriaVentaInfo } from '../../utils/formatters';
import { comprasPorCategoria, resumenMensual, ventasPorCategoria } from '../../utils/resumenes';
import { ESTILO_COMPRA, ESTILO_GASTO, ESTILO_GENERICO, TarjetaResumen, definicionesCategoriasVenta } from '../common/TarjetaResumen';
import { resumenAlertas, sumaSaldos } from '../../utils/cartera';
import { saldoDeVenta } from '../../utils/ventas';

interface DashboardViewProps {
  documentos: CompraDocumento[];
  categorias: Categoria[];
  centrosCosto: CentroCosto[];
  ventas?: Venta[];
  onIrACompras: () => void;
  onIrACuentasPorPagar?: () => void;
  onIrAVentas?: () => void;
  onIrACargarFactura: () => void;
  onIrACargarExcel?: () => void;
  onIrAReportes?: () => void;
}


export const DashboardView: React.FC<DashboardViewProps> = ({
  documentos,
  categorias,
  centrosCosto,
  ventas = [],
  onIrACompras,
  onIrACuentasPorPagar,
  onIrAVentas,
  onIrACargarFactura,
  onIrACargarExcel,
  onIrAReportes,
}) => {
  const anioActualSistema = new Date().getFullYear();
  // Por defecto: Año en curso
  const [anioSeleccionado, setAnioSeleccionado] = useState<number>(anioActualSistema);

  const alertasPago = useMemo(() => resumenAlertas(documentos), [documentos]);
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

  // Ventas por categoría (mismas tarjetas que en Reportes)
  const categoriasVenta = useMemo(
    () => ventasPorCategoria(ventasDelAnio, definicionesCategoriasVenta(), (k) => getCategoriaVentaInfo(k).label),
    [ventasDelAnio]
  );
  const estiloVenta = (key: string) => definicionesCategoriasVenta().find((d) => d.key === key) || ESTILO_GENERICO;

  // Compras y gastos por categoría
  const categoriasCompra = useMemo(() => comprasPorCategoria(docsDelAnio, categorias), [docsDelAnio, categorias]);

  // Mes a mes
  const meses = useMemo(() => resumenMensual(ventasDelAnio, docsDelAnio, anioSeleccionado), [ventasDelAnio, docsDelAnio, anioSeleccionado]);
  const mesActual = anioSeleccionado === anioActualSistema ? new Date().getMonth() + 1 : 13;

  // Proveedores con más compras del año
  const topProveedores = useMemo(() => {
    const mapa = new Map<string, { nombre: string; total: number; cantidad: number }>();
    docsDelAnio.forEach((doc) => {
      const nombre = doc.proveedor?.razonSocial || 'Desconocido';
      const e = mapa.get(nombre) || { nombre, total: 0, cantidad: 0 };
      e.total += doc.total;
      e.cantidad += 1;
      mapa.set(nombre, e);
    });
    const lista = Array.from(mapa.values()).sort((a, b) => b.total - a.total);
    const gran = lista.reduce((acc, x) => acc + x.total, 0);
    return lista.slice(0, 8).map((x) => ({ ...x, porcentaje: gran > 0 ? (x.total / gran) * 100 : 0 }));
  }, [docsDelAnio]);

  // Compras y gastos por centro de costo
  const centrosDelAnio = useMemo(() => {
    const mapa = new Map<string, { nombre: string; total: number; cantidad: number }>();
    docsDelAnio.forEach((doc) => {
      const nombre = ccMap.get(doc.centroCostoId)?.nombre || 'General';
      const e = mapa.get(nombre) || { nombre, total: 0, cantidad: 0 };
      e.total += doc.total;
      e.cantidad += 1;
      mapa.set(nombre, e);
    });
    const lista = Array.from(mapa.values()).sort((a, b) => b.total - a.total);
    const gran = lista.reduce((acc, x) => acc + x.total, 0);
    return lista.map((x) => ({ ...x, porcentaje: gran > 0 ? (x.total / gran) * 100 : 0 }));
  }, [docsDelAnio, ccMap]);

  const encabezado = (titulo: string, ayuda: string, accion?: { texto: string; onClick?: () => void }) => (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{titulo}</h3>
        <p className="text-xs text-slate-400">{ayuda}</p>
      </div>
      {accion?.onClick && (
        <button onClick={accion.onClick} className="self-start sm:self-auto flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
          {accion.texto} <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );

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
            Consolidado anual de compras, insumos, gastos operativos y declaraciones DIAN del año {anioSeleccionado}.
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

      {/* Alerta de facturas vencidas o que vencen hoy/mañana */}
      {alertasPago.urgentes > 0 && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                {[
                  alertasPago.vencidas.length && `${alertasPago.vencidas.length} factura(s) vencida(s)`,
                  alertasPago.hoy.length && `${alertasPago.hoy.length} vence(n) hoy`,
                  alertasPago.manana.length && `${alertasPago.manana.length} vence(n) mañana`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </h4>
              <p className="text-xs text-rose-700 dark:text-rose-300">
                Saldo comprometido: {formatCOP(sumaSaldos([...alertasPago.vencidas, ...alertasPago.hoy, ...alertasPago.manana]))}. Programe
                los pagos para evitar intereses o suspensión de despachos.
              </p>
            </div>
          </div>
          <button
            onClick={onIrACuentasPorPagar || onIrACompras}
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
              Balance General de la Empresa • Año {anioSeleccionado}
            </span>
            <h3 className="text-xl sm:text-2xl font-black">
              Ingresos por Ventas vs. Compras y Gastos
            </h3>
            <p className="text-xs text-slate-300 max-w-xl">
              Consolida las ventas de productos y servicios frente a todas las facturas y compras operativas.
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

      {/* Ventas por categoría */}
      <section className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4" aria-label="Ventas por categoría">
        {encabezado(
          `Ventas por categoría (${anioSeleccionado})`,
          `${formatCOP(totalVentasAnio)} en ${ventasDelAnio.length} venta(s). Participación de cada categoría en lo vendido.`,
          { texto: 'Ver reporte', onClick: onIrAReportes }
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {categoriasVenta.map((c) => (
            <TarjetaResumen
              key={c.key}
              titulo={c.nombre}
              estilo={estiloVenta(c.key)}
              total={c.total}
              porcentaje={c.porcentaje}
              detalle={`${c.cantidad} venta${c.cantidad !== 1 ? 's' : ''}`}
              accion={onIrAVentas ? 'Ver ventas' : undefined}
              onClick={onIrAVentas}
            />
          ))}
        </div>
      </section>

      {/* Compras y gastos por categoría */}
      <section className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4" aria-label="Compras y gastos por categoría">
        {encabezado(
          `Compras y gastos por categoría (${anioSeleccionado})`,
          `${formatCOP(metricas.totalEgresos)} en ${docsDelAnio.length} documento(s): compras ${formatCOP(metricas.comprasAnio)} · gastos ${formatCOP(metricas.gastosAnio)}.`,
          { texto: 'Ver compras y gastos', onClick: onIrACompras }
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {categoriasCompra.map((c) => (
            <TarjetaResumen
              key={c.id}
              titulo={c.nombre}
              estilo={c.esGasto ? ESTILO_GASTO : ESTILO_COMPRA}
              colorPunto={c.color}
              total={c.total}
              porcentaje={c.porcentaje}
              detalle={`${c.cantidad} documento${c.cantidad !== 1 ? 's' : ''} · ${c.esGasto ? 'Gasto' : 'Compra'}`}
              accion="Ver documentos"
              onClick={onIrACompras}
            />
          ))}
        </div>
      </section>

      {/* Mes a mes: ventas, compras y gastos */}
      <section className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4" aria-label="Ventas y compras mes a mes">
        {encabezado(
          `Ventas y compras mes a mes (${anioSeleccionado})`,
          'Resultado = ventas − compras − gastos de cada mes (informativo, sin causación contable).'
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {meses.map((m) => {
            const futuro = m.mes > mesActual;
            const actual = m.mes === mesActual;
            return (
              <div
                key={m.mes}
                className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                  actual ? 'ring-2 ring-emerald-500 border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30' : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30'
                } ${futuro ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">{m.nombre}</span>
                  {actual && <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">Mes actual</span>}
                </div>
                <div className="flex justify-between gap-2"><span className="text-slate-500">Ventas</span><span className="font-semibold tabular-nums text-slate-900 dark:text-white">{formatCOP(m.ventas)}</span></div>
                <div className="flex justify-between gap-2"><span className="text-slate-500">Compras</span><span className="font-semibold tabular-nums text-slate-700 dark:text-slate-300">{formatCOP(m.compras)}</span></div>
                <div className="flex justify-between gap-2"><span className="text-slate-500">Gastos</span><span className="font-semibold tabular-nums text-slate-700 dark:text-slate-300">{formatCOP(m.gastos)}</span></div>
                <div className="flex justify-between gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-700">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Resultado</span>
                  <span className={`font-black tabular-nums ${m.resultado < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{formatCOP(m.resultado)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Proveedores y centros de costo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4" aria-label="Proveedores">
          {encabezado(`Proveedores con más compras (${anioSeleccionado})`, 'Total facturado por cada proveedor en el año.')}
          {topProveedores.length ? (
            <ul className="space-y-3">
              {topProveedores.map((p) => (
                <li key={p.nombre} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{p.nombre}</span>
                    <span className="font-bold tabular-nums text-slate-900 dark:text-white shrink-0">{formatCOP(p.total)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, p.porcentaje)}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-500 w-24 text-right shrink-0">{p.porcentaje.toFixed(1)}% · {p.cantidad} doc.</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">Sin compras registradas en {anioSeleccionado}.</p>
          )}
        </section>

        <section className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4" aria-label="Centros de costo">
          {encabezado(`Compras y gastos por centro de costo (${anioSeleccionado})`, 'Áreas, sedes, líneas de negocio, administración…')}
          {centrosDelAnio.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {centrosDelAnio.map((c) => (
                <TarjetaResumen
                  key={c.nombre}
                  titulo={c.nombre}
                  estilo={ESTILO_GENERICO}
                  total={c.total}
                  porcentaje={c.porcentaje}
                  detalle={`${c.cantidad} documento${c.cantidad !== 1 ? 's' : ''}`}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Sin compras ni gastos registrados en {anioSeleccionado}.</p>
          )}
        </section>
      </div>
    </div>
  );
};
