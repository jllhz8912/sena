import React, { useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Boxes,
  Calculator,
  Camera,
  CircleUser,
  Briefcase,
  Landmark,
  FlaskConical,
  DatabaseBackup,
  FolderTree,
  Images,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users,
  WalletCards,
} from 'lucide-react';
import type { CompraDocumento, Venta } from '../../types';
import { formatCOP } from '../../utils/formatters';
import { dataService } from '../../services/dataService';

export type PantallaMovil =
  | 'inicio'
  | 'caja'
  | 'productos'
  | 'compras_movil'
  | 'ventas'
  | 'compras'
  | 'inventario'
  | 'cuentas_pagar'
  | 'reportes_ventas'
  | 'reportes_compras'
  | 'reportes'
  | 'dashboard'
  | 'precios'
  | 'catalogos'
  | 'copias'
  | 'configuracion'
  | 'seguridad'
  | 'nomina'
  | 'ica';

interface Mosaico {
  id: PantallaMovil;
  titulo: string;
  color: string;
  icono: React.ReactNode;
  modulo: string | string[];
  aviso?: string;
}

/** Colores fijos por módulo: se reconocen de un vistazo (no cambian con el color de la empresa). */
export const COLOR_PANTALLA: Partial<Record<PantallaMovil, string>> = {
  caja: '#16a34a',
  compras_movil: '#ea580c',
  productos: '#7c3aed',
  inventario: '#dc2626',
  cuentas_pagar: '#d97706',
  reportes_ventas: '#2563eb',
  reportes_compras: '#2563eb',
  reportes: '#1d4ed8',
  ventas: '#0d9488',
  compras: '#c2410c',
  dashboard: '#4f46e5',
  precios: '#0e7490',
  catalogos: '#db2777',
  copias: '#0891b2',
  configuracion: '#475569',
  seguridad: '#334155',
  nomina: '#0369a1',
  ica: '#c2410c',
};

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const InicioMovil: React.FC<{
  empresa: { nombre: string; logo?: string };
  perfil: string;
  puede: (m: string) => boolean;
  ventas: Venta[];
  documentos: CompraDocumento[];
  copiaPendiente: boolean;
  onIr: (p: PantallaMovil) => void;
  onCambiarPerfil: () => void;
  onSalir: () => void;
}> = ({ empresa, perfil, puede, ventas, documentos, copiaPendiente, onIr, onCambiarPerfil, onSalir }) => {
  const [menu, setMenu] = useState(false);
  const esPrueba = /prueba/.test(dataService.version() || '');
  const deHoy = ventas.filter((v) => v.fecha === hoy());
  const vendidoHoy = deHoy.reduce((s, v) => s + (v.monto || 0), 0);
  const porPagar = documentos.reduce((s, d) => s + (d.saldoPendiente > 0 ? d.saldoPendiente : 0), 0);
  const facturasPorPagar = documentos.filter((d) => d.saldoPendiente > 0).length;
  const alguno = (m: string | string[]) => (Array.isArray(m) ? m.some(puede) : puede(m));

  const todos: Mosaico[] = [
    { id: 'caja', titulo: 'Vender', color: COLOR_PANTALLA.caja!, icono: <ShoppingCart />, modulo: 'ventas' },
    { id: 'compras_movil', titulo: 'Compras', color: COLOR_PANTALLA.compras_movil!, icono: <Camera />, modulo: ['compras', 'cargar_factura'] },
    { id: 'productos', titulo: 'Productos', color: COLOR_PANTALLA.productos!, icono: <Images />, modulo: ['catalogos', 'inventario'] },
    { id: 'inventario', titulo: 'Inventario', color: COLOR_PANTALLA.inventario!, icono: <Boxes />, modulo: 'inventario' },
    { id: 'cuentas_pagar', titulo: 'Por pagar', color: COLOR_PANTALLA.cuentas_pagar!, icono: <WalletCards />, modulo: 'cuentas_pagar', aviso: facturasPorPagar ? String(facturasPorPagar) : undefined },
    { id: 'reportes_ventas', titulo: 'Reportes', color: COLOR_PANTALLA.reportes_ventas!, icono: <BarChart3 />, modulo: 'reportes_ventas' },
    { id: 'ventas', titulo: 'Ventas y clientes', color: COLOR_PANTALLA.ventas!, icono: <Users />, modulo: 'ventas' },
    { id: 'compras', titulo: 'Lista compras', color: COLOR_PANTALLA.compras!, icono: <ListOrdered />, modulo: 'compras' },
    { id: 'nomina', titulo: 'Nómina', color: COLOR_PANTALLA.nomina!, icono: <Briefcase />, modulo: 'nomina' },
    { id: 'ica', titulo: 'ICA', color: COLOR_PANTALLA.ica!, icono: <Landmark />, modulo: 'ica' },
    { id: 'dashboard', titulo: 'Panel', color: COLOR_PANTALLA.dashboard!, icono: <LayoutDashboard />, modulo: 'dashboard' },
    { id: 'reportes_compras', titulo: 'Reportes compras', color: '#1e40af', icono: <BarChart3 />, modulo: 'reportes_compras' },
    { id: 'precios', titulo: 'Precios', color: COLOR_PANTALLA.precios!, icono: <Calculator />, modulo: 'precios' },
    { id: 'catalogos', titulo: 'Catálogos', color: COLOR_PANTALLA.catalogos!, icono: <FolderTree />, modulo: 'catalogos' },
    { id: 'copias', titulo: 'Copias', color: COLOR_PANTALLA.copias!, icono: <DatabaseBackup />, modulo: 'copias', aviso: copiaPendiente ? '!' : undefined },
    { id: 'configuracion', titulo: 'Ajustes', color: COLOR_PANTALLA.configuracion!, icono: <Settings />, modulo: 'configuracion' },
    { id: 'seguridad', titulo: 'Perfiles', color: COLOR_PANTALLA.seguridad!, icono: <ShieldCheck />, modulo: 'seguridad' },
  ];
  const mosaicos = todos.filter((m) => alguno(m.modulo));

  return (
    <div className="min-h-full bg-slate-100 dark:bg-slate-950">
      {/* Encabezado con la marca */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        {empresa.logo ? (
          <img src={empresa.logo} alt="" className="w-11 h-11 rounded-xl object-contain bg-white" />
        ) : (
          <span className="w-11 h-11 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-black">
            {empresa.nombre.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Bienvenido · {perfil}</p>
          <h1 className="text-lg font-black text-slate-900 dark:text-white truncate">{empresa.nombre}</h1>
        </div>
        <button id="inicio-menu" onClick={() => setMenu(!menu)} className="p-2 rounded-full bg-white dark:bg-slate-800 shadow-sm" title="Perfil y salida">
          <CircleUser className="w-6 h-6 text-slate-700 dark:text-slate-200" />
        </button>
      </div>
      {menu && (
        <div className="mx-4 mb-3 rounded-2xl bg-white dark:bg-slate-800 shadow-md overflow-hidden">
          <button onClick={onCambiarPerfil} className="w-full px-4 py-3 text-left text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4" /> Cambiar de perfil
          </button>
          <button onClick={onSalir} className="w-full px-4 py-3 text-left text-sm font-semibold flex items-center gap-2 text-rose-600 border-t border-slate-100 dark:border-slate-700">
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
      )}

      {esPrueba && (
        <div className="mx-4 mb-3 rounded-2xl border border-amber-300 bg-amber-50 text-amber-950 px-3 py-2 text-[12px] font-semibold flex items-center gap-2">
          <FlaskConical className="w-4 h-4 shrink-0" /> Versión de prueba: sin licencia, con datos de ejemplo y hasta 60 ventas y 60 compras.
        </div>
      )}

      {/* Resumen del día */}
      {(puede('ventas') || puede('cuentas_pagar')) && (
        <div className="mx-4 mb-3 grid grid-cols-2 gap-2">
          {puede('ventas') && (
            <div className="rounded-2xl bg-white dark:bg-slate-800 p-3 shadow-sm">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Vendido hoy</p>
              <p className="text-lg font-black text-green-700 dark:text-green-400 tabular-nums">{formatCOP(vendidoHoy)}</p>
              <p className="text-[11px] text-slate-500">{deHoy.length} venta(s)</p>
            </div>
          )}
          {puede('cuentas_pagar') && (
            <div className="rounded-2xl bg-white dark:bg-slate-800 p-3 shadow-sm">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Por pagar</p>
              <p className="text-lg font-black text-amber-700 dark:text-amber-400 tabular-nums">{formatCOP(porPagar)}</p>
              <p className="text-[11px] text-slate-500">{facturasPorPagar} factura(s)</p>
            </div>
          )}
        </div>
      )}

      {/* Accesos principales: barras de color; el resto, mosaicos pequeños en cuatro columnas */}
      <div className="px-4 grid grid-cols-2 gap-2.5 mb-3">
        {mosaicos.slice(0, 2).map((m) => (
          <BotonMosaico key={m.id} m={m} grande onIr={onIr} />
        ))}
      </div>
      <div className="px-4 grid grid-cols-4 gap-2" style={{ paddingBottom: 'calc(1.5rem + var(--sa-bottom, 0px))' }}>
        {mosaicos.slice(2).map((m) => (
          <BotonMosaico key={m.id} m={m} onIr={onIr} />
        ))}
      </div>
    </div>
  );
};

const BotonMosaico: React.FC<{ m: Mosaico; grande?: boolean; onIr: (p: PantallaMovil) => void }> = ({ m, grande, onIr }) =>
  grande ? (
    <button
      id={`mosaico-${m.id}`}
      onClick={() => onIr(m.id)}
      className="relative h-[68px] rounded-2xl text-white shadow-sm active:scale-[0.97] transition-transform flex items-center gap-2.5 px-3.5"
      style={{ background: m.color }}
    >
      <span className="[&>svg]:w-7 [&>svg]:h-7 [&>svg]:stroke-[1.8]">{m.icono}</span>
      <span className="text-[17px] font-black">{m.titulo}</span>
    </button>
  ) : (
    <button
      id={`mosaico-${m.id}`}
      onClick={() => onIr(m.id)}
      className="relative aspect-square rounded-2xl text-white shadow-sm active:scale-[0.95] transition-transform flex flex-col items-center justify-center gap-1"
      style={{ background: m.color }}
    >
      <span className="[&>svg]:w-6 [&>svg]:h-6 [&>svg]:stroke-[1.8]">{m.icono}</span>
      <span className="text-[10.5px] font-bold text-center px-1 leading-[1.1]">{m.titulo}</span>
      {m.aviso && (
        <span className="absolute top-1 right-1 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-white text-rose-600 text-[10px] font-black flex items-center justify-center">{m.aviso}</span>
      )}
    </button>
  );

/** Barra superior de color de cada módulo, con el botón para volver al inicio. */
export const BarraMovil: React.FC<{ titulo: string; color: string; onVolver: () => void; derecha?: React.ReactNode }> = ({ titulo, color, onVolver, derecha }) => (
  <div className="shrink-0 flex items-center gap-1 px-1.5 h-14 text-white" style={{ background: color }}>
    <button id="movil-volver" onClick={onVolver} className="p-2.5 rounded-full active:bg-white/20" title="Volver al inicio">
      <ArrowLeft className="w-6 h-6" />
    </button>
    <h1 className="flex-1 text-lg font-bold truncate">{titulo}</h1>
    {derecha}
  </div>
);
