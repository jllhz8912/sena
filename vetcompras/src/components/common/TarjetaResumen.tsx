import React from 'react';
import {
  Activity,
  Package,
  Receipt,
  Scissors,
  ShoppingBag,
  Stethoscope,
  Syringe,
  Tag,
  Wheat,
} from 'lucide-react';
import { CATEGORIAS_VENTA, formatCOP } from '../../utils/formatters';

export interface EstiloTarjeta {
  icon: React.ComponentType<{ className?: string }>;
  /** Color del icono */
  color: string;
  /** Fondo y borde de la tarjeta */
  bgLight: string;
  borderLight: string;
}

// Estilo de las categorías de venta de fábrica (las creadas en Catálogos usan el genérico)
export const ESTILOS_CATEGORIA_VENTA: Array<EstiloTarjeta & { key: string; label: string }> = [
  { key: 'banos', label: 'Baños', icon: Scissors, color: 'text-cyan-600 dark:text-cyan-400', bgLight: 'bg-cyan-50 dark:bg-cyan-950/40', borderLight: 'border-cyan-200 dark:border-cyan-800' },
  { key: 'vacunas', label: 'Vacunas', icon: Syringe, color: 'text-indigo-600 dark:text-indigo-400', bgLight: 'bg-indigo-50 dark:bg-indigo-950/40', borderLight: 'border-indigo-200 dark:border-indigo-800' },
  { key: 'consultas_clinica', label: 'Consultas clinica', icon: Stethoscope, color: 'text-emerald-600 dark:text-emerald-400', bgLight: 'bg-emerald-50 dark:bg-emerald-950/40', borderLight: 'border-emerald-200 dark:border-emerald-800' },
  { key: 'tratamientos_clinica', label: 'Tratamientos clinica', icon: Activity, color: 'text-rose-600 dark:text-rose-400', bgLight: 'bg-rose-50 dark:bg-rose-950/40', borderLight: 'border-rose-200 dark:border-rose-800' },
  { key: 'purinas_empaque', label: 'Purinas ( bultos y paquetes)', icon: Package, color: 'text-amber-600 dark:text-amber-400', bgLight: 'bg-amber-50 dark:bg-amber-950/40', borderLight: 'border-amber-200 dark:border-amber-800' },
  { key: 'purinas_granel', label: 'Purinas a granel', icon: Wheat, color: 'text-orange-600 dark:text-orange-400', bgLight: 'bg-orange-50 dark:bg-orange-950/40', borderLight: 'border-orange-200 dark:border-orange-800' },
  { key: 'vitrina', label: 'Vitrina', icon: ShoppingBag, color: 'text-purple-600 dark:text-purple-400', bgLight: 'bg-purple-50 dark:bg-purple-950/40', borderLight: 'border-purple-200 dark:border-purple-800' },
  { key: 'varios', label: 'Varios / Otros', icon: Tag, color: 'text-slate-600 dark:text-slate-400', bgLight: 'bg-slate-50 dark:bg-slate-900', borderLight: 'border-slate-200 dark:border-slate-800' },
];

export const ESTILO_GENERICO = ESTILOS_CATEGORIA_VENTA[ESTILOS_CATEGORIA_VENTA.length - 1];

export const ESTILO_COMPRA: EstiloTarjeta = { icon: Package, color: 'text-sky-600 dark:text-sky-400', bgLight: 'bg-sky-50 dark:bg-sky-950/40', borderLight: 'border-sky-200 dark:border-sky-800' };
export const ESTILO_GASTO: EstiloTarjeta = { icon: Receipt, color: 'text-orange-600 dark:text-orange-400', bgLight: 'bg-orange-50 dark:bg-orange-950/40', borderLight: 'border-orange-200 dark:border-orange-800' };

/** Categorías de venta vigentes (editables en Catálogos) con su icono y colores. */
export function definicionesCategoriasVenta(): Array<EstiloTarjeta & { key: string; label: string }> {
  return CATEGORIAS_VENTA.map((c) => ({ ...(ESTILOS_CATEGORIA_VENTA.find((e) => e.key === c.id) || ESTILO_GENERICO), key: c.id, label: c.label }));
}

interface TarjetaResumenProps {
  titulo: string;
  estilo: EstiloTarjeta;
  total: number;
  /** Participación sobre el total (0 a 100) */
  porcentaje: number;
  /** Texto bajo el valor: "3 ventas", "2 facturas"… */
  detalle: string;
  /** Texto de la acción al hacer clic ("Clic para filtrar", "Ver ventas") */
  accion?: string;
  seleccionada?: boolean;
  onClick?: () => void;
  /** Color propio (p. ej. el de una categoría de compra) para el punto junto al título */
  colorPunto?: string;
}

/** Tarjeta de resumen: nombre, participación, valor, cantidad y barra de avance. */
export const TarjetaResumen: React.FC<TarjetaResumenProps> = ({ titulo, estilo, total, porcentaje, detalle, accion, seleccionada, onClick, colorPunto }) => {
  const Icon = estilo.icon;
  const contenido = (
    <>
      <div className="flex items-center justify-between gap-2 mb-2 min-h-[2.5rem]">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-2 rounded-xl bg-white dark:bg-slate-900 shadow-xs shrink-0 ${estilo.color}`}>
            <Icon className="w-4 h-4" />
          </div>
          {colorPunto && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colorPunto }} />}
          <span className="font-bold text-xs leading-snug text-slate-900 dark:text-white line-clamp-2 text-left" title={titulo}>{titulo}</span>
        </div>
        <span className="text-[11px] font-bold text-slate-500 shrink-0">{porcentaje.toFixed(1)}%</span>
      </div>
      <div className="mt-1 text-left">
        <div className="text-xl font-black text-slate-900 dark:text-white tabular-nums">{formatCOP(total)}</div>
        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
          <span>{detalle}</span>
          {accion && <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">{seleccionada ? 'Filtro Activo' : accion}</span>}
        </div>
      </div>
      <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-2.5 overflow-hidden">
        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, Math.max(0, porcentaje))}%` }} />
      </div>
    </>
  );
  const clase = `block w-full p-4 rounded-2xl border transition-all ${
    seleccionada ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 border-emerald-300' : `${estilo.bgLight} ${estilo.borderLight}`
  } ${onClick ? 'cursor-pointer hover:shadow-sm' : ''}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={clase}>
      {contenido}
    </button>
  ) : (
    <div className={clase}>{contenido}</div>
  );
};
