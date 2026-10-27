import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ReceiptText,
  UploadCloud,
  FileSpreadsheet,
  FilePenLine,
  BarChart3,
  FolderTree,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  Sparkles,
  X,
  Menu,
  CircleDollarSign,
  Settings,
  ShieldCheck,
  HandCoins,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { EmpresaInfo } from '../../types';

export type NavItem =
  | 'dashboard'
  | 'ventas'
  | 'compras'
  | 'cuentas_pagar'
  | 'cargar_factura'
  | 'cargar_excel'
  | 'registro_manual'
  | 'reportes'
  | 'catalogos'
  | 'configuracion'
  | 'seguridad';

interface SidebarProps {
  currentTab: NavItem;
  setCurrentTab: (tab: NavItem) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  totalPendientes: number;
  /** Facturas vencidas, que vencen hoy o mañana */
  alertasPago?: number;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  collapsed,
  setCollapsed,
  totalPendientes,
  alertasPago = 0,
  mobileOpen,
  setMobileOpen,
}) => {
  const [empresa, setEmpresa] = useState<EmpresaInfo>(() => dataService.obtenerDatosEmpresa());

  useEffect(() => {
    const unsub = dataService.suscribirCambiosEnVivo(() => {
      setEmpresa(dataService.obtenerDatosEmpresa());
    });
    return () => unsub();
  }, []);

  const menuItems = [
    {
      id: 'dashboard' as NavItem,
      label: 'Dashboard (Año Actual)',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'ventas' as NavItem,
      label: 'Módulo de Ventas',
      icon: CircleDollarSign,
      badge: 'Local',
      badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    },
    {
      id: 'compras' as NavItem,
      label: 'Compras y Gastos',
      icon: ReceiptText,
      badge: totalPendientes > 0 ? `${totalPendientes} por pagar` : null,
      badgeColor: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
    },
    {
      id: 'cuentas_pagar' as NavItem,
      label: 'Cuentas por Pagar',
      icon: HandCoins,
      badge: alertasPago > 0 ? `${alertasPago} por vencer` : null,
      badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    },
    {
      id: 'cargar_factura' as NavItem,
      label: 'Subir Facturas (DIAN)',
      icon: UploadCloud,
      badge: 'XML/PDF',
      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    },
    {
      id: 'cargar_excel' as NavItem,
      label: 'Importar desde Excel',
      icon: FileSpreadsheet,
      badge: '.XLSX',
      badgeColor: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
    },
    {
      id: 'registro_manual' as NavItem,
      label: 'Registro Manual',
      icon: FilePenLine,
      badge: null,
    },
    {
      id: 'reportes' as NavItem,
      label: 'Reportes y DIAN',
      icon: BarChart3,
      badge: 'Form 300/350',
      badgeColor: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
    },
    {
      id: 'catalogos' as NavItem,
      label: 'Catálogos',
      icon: FolderTree,
      badge: null,
    },
    {
      id: 'configuracion' as NavItem,
      label: 'Configuración y Marca',
      icon: Settings,
      badge: 'Logo y Colores',
      badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
    },
    {
      id: 'seguridad' as NavItem,
      label: 'Seguridad y Respaldos',
      icon: ShieldCheck,
      badge: 'Admin',
      badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    },
  ].filter((item) => {
    // Configuración, catálogos y seguridad solo para administradores
    if (dataService.esAdministrador()) return true;
    return !(['configuracion', 'seguridad', 'catalogos'] as NavItem[]).includes(item.id);
  });

  const handleItemClick = (id: NavItem) => {
    setCurrentTab(id);
    setMobileOpen(false);
  };

  return (
    <>
      {/* 1. BARRA LATERAL DESKTOP (Visible en pantallas medianas y grandes) */}
      <aside
        className={`hidden md:flex relative z-20 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-200 select-none ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 overflow-hidden">
            {empresa.logoUrl ? (
              <img
                src={empresa.logoUrl}
                alt="Logo"
                className="w-10 h-10 rounded-xl object-contain bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-0.5 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
                <Stethoscope className="w-5 h-5" />
              </div>
            )}
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                  <span className="truncate">{empresa.nombreComercial || 'VetCompras'}</span>
                  <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shrink-0">
                    CO
                  </span>
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {empresa.slogan || 'Gestión Veterinaria'}
                </span>
              </div>
            )}
          </div>

          {/* Toggle Collapse Button */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all text-left group ${
                  isActive
                    ? 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-colors ${
                    isActive
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'
                  }`}
                />
                {!collapsed && (
                  <div className="flex-1 flex items-center justify-between min-w-0">
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                          item.badgeColor || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Info Box */}
        {!collapsed && (
          <div className="p-3 m-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Extracción DIAN &amp; datos locales</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
              La información se guarda en este PC, con respaldos automáticos diarios.
            </p>
          </div>
        )}
      </aside>

      {/* 2. MENÚ DESPLEGABLE MÓVIL (Para celulares y pantallas pequeñas) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-150">
          {/* Telón oscuro de fondo */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />

          {/* Cajón lateral móvil */}
          <aside className="relative z-10 w-72 max-w-[85vw] h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            {/* Header móvil */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                {empresa.logoUrl ? (
                  <img
                    src={empresa.logoUrl}
                    alt="Logo"
                    className="w-10 h-10 rounded-xl object-contain bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-0.5 shadow-sm shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white flex items-center gap-1 truncate max-w-[170px]">
                    <span className="truncate">{empresa.nombreComercial || 'VetCompras'}</span>
                    <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0">CO</span>
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate max-w-[170px]">{empresa.slogan || 'Menú Principal'}</span>
                </div>
              </div>

              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lista de enlaces móvil */}
            <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl font-semibold text-sm transition-all text-left ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : item.badgeColor || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* 3. BARRA INFERIOR MÓVIL (Bottom Navigation Bar para celulares) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-around py-1.5 px-2 safe-area-pb shadow-lg">
        <button
          onClick={() => handleItemClick('dashboard')}
          className={`flex flex-col items-center gap-0.5 p-1 rounded-xl text-[10px] font-medium transition-colors ${
            currentTab === 'dashboard'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => handleItemClick('compras')}
          className={`flex flex-col items-center gap-0.5 p-1 rounded-xl text-[10px] font-medium transition-colors relative ${
            currentTab === 'compras'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <ReceiptText className="w-5 h-5" />
          <span>Compras</span>
          {totalPendientes > 0 && (
            <span className="absolute -top-1 right-1 w-2 h-2 rounded-full bg-rose-500" />
          )}
        </button>

        <button
          onClick={() => handleItemClick('cargar_factura')}
          className="flex flex-col items-center gap-0.5 -mt-4 bg-emerald-600 hover:bg-emerald-500 text-white p-2.5 rounded-2xl shadow-lg shadow-emerald-600/30 text-[10px] font-bold active:scale-95 transition-transform"
        >
          <UploadCloud className="w-5 h-5" />
          <span>Subir</span>
        </button>

        <button
          onClick={() => handleItemClick('reportes')}
          className={`flex flex-col items-center gap-0.5 p-1 rounded-xl text-[10px] font-medium transition-colors ${
            currentTab === 'reportes'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span>Reportes</span>
        </button>

        <button
          onClick={() => setMobileOpen(true)}
          className="flex flex-col items-center gap-0.5 p-1 rounded-xl text-[10px] font-medium text-slate-500 dark:text-slate-400"
        >
          <Menu className="w-5 h-5" />
          <span>Más</span>
        </button>
      </div>
    </>
  );
};
