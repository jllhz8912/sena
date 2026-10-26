import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, NavItem } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { DashboardView } from './components/dashboard/DashboardView';
import { VentasView } from './components/ventas/VentasView';
import { ListadoDocumentos } from './components/listado/ListadoDocumentos';
import { ReportesView } from './components/reportes/ReportesView';
import { CatalogosView } from './components/catalogos/CatalogosView';
import { ConfiguracionView } from './components/configuracion/ConfiguracionView';
import { CargaFacturaModal } from './components/facturas/CargaFacturaModal';
import { CargaExcelModal } from './components/facturas/CargaExcelModal';
import { RegistroManualModal } from './components/registro/RegistroManualModal';
import { ModalRegistroVenta } from './components/ventas/ModalRegistroVenta';
import { BotonFlotanteNuevo } from './components/common/BotonFlotanteNuevo';
import { CompraDocumento, Categoria, CentroCosto, Proveedor, Venta } from './types';
import { dataService } from './services/dataService';
import { ToastProvider, useToast } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { Loader2 } from 'lucide-react';

function VetComprasApp() {
  const [currentTab, setCurrentTab] = useState<NavItem>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuAbierto, setMobileMenuAbierto] = useState(false);

  // Datos en estado local (reactivos a IndexedDB y Firestore)
  const [documentos, setDocumentos] = useState<CompraDocumento[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([]);
  const [cargando, setCargando] = useState(true);

  // Modales
  const [modalCargaAbierto, setModalCargaAbierto] = useState(false);
  const [modalExcelAbierto, setModalExcelAbierto] = useState(false);
  const [modalManualAbierto, setModalManualAbierto] = useState(false);
  const [modalVentaAbierto, setModalVentaAbierto] = useState(false);
  const [documentoParaEditar, setDocumentoParaEditar] = useState<CompraDocumento | undefined>(undefined);

  // Cargar datos desde IndexedDB (Dexie)
  const recargarDatos = useCallback(async () => {
    try {
      const [docs, provs, cats, ccs, vts] = await Promise.all([
        dataService.obtenerDocumentos(),
        dataService.obtenerProveedores(),
        dataService.obtenerCategorias(),
        dataService.obtenerCentrosCosto(),
        dataService.obtenerVentas(),
      ]);
      setDocumentos(docs);
      setProveedores(provs);
      setCategorias(cats);
      setCentrosCosto(ccs);
      setVentas(vts);
    } catch (error) {
      console.error('Error cargando datos de VetCompras:', error);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    recargarDatos();
    const unsub = dataService.suscribirCambiosEnVivo(() => {
      recargarDatos();
    });
    return () => unsub();
  }, [recargarDatos]);

  // Si el usuario hace click en el menú lateral para subir factura, importar excel o registro manual:
  const handleCambioPestana = (tab: NavItem) => {
    if (tab === 'cargar_factura') {
      setModalCargaAbierto(true);
    } else if (tab === 'cargar_excel') {
      setModalExcelAbierto(true);
    } else if (tab === 'registro_manual') {
      setDocumentoParaEditar(undefined);
      setModalManualAbierto(true);
    } else {
      setCurrentTab(tab);
    }
  };

  const handleEditarDocumento = (doc: CompraDocumento) => {
    setDocumentoParaEditar(doc);
    setModalManualAbierto(true);
  };

  const totalPendientes = documentos.filter((d) => d.saldoPendiente > 0).length;

  const titulos: Record<NavItem, string> = {
    dashboard: 'Panel Central • Año en Curso',
    ventas: 'Módulo de Ventas de la Veterinaria',
    compras: 'Registro de Compras y Gastos',
    cargar_factura: 'Cargar Factura Electrónica (DIAN)',
    cargar_excel: 'Importar Facturas desde Excel',
    registro_manual: 'Registro Manual de Documento',
    reportes: 'Reportería e Informes Tributarios (DIAN)',
    catalogos: 'Catálogos de Proveedores y Centros de Costo',
    configuracion: 'Configuración de la Veterinaria y Marca',
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* Barra Lateral (Sidebar) */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={handleCambioPestana}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        totalPendientes={totalPendientes}
        mobileOpen={mobileMenuAbierto}
        setMobileOpen={setMobileMenuAbierto}
      />

      {/* Contenedor Principal */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Barra Superior (Navbar) */}
        <Navbar
          tituloModulo={titulos[currentTab]}
          onAbrirCargaFactura={() => setModalCargaAbierto(true)}
          onAbrirCargaExcel={() => setModalExcelAbierto(true)}
          onAbrirRegistroManual={() => {
            setDocumentoParaEditar(undefined);
            setModalManualAbierto(true);
          }}
          onDatosActualizados={recargarDatos}
          onAbrirMenuMovil={() => setMobileMenuAbierto(true)}
        />

        {/* Área de Contenido con Scroll */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 pb-20 md:pb-8">
          {cargando ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-xs font-semibold">Cargando base de datos IndexedDB...</p>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto space-y-6">
              {currentTab === 'dashboard' && (
                <DashboardView
                  documentos={documentos}
                  categorias={categorias}
                  centrosCosto={centrosCosto}
                  ventas={ventas}
                  onIrACompras={() => setCurrentTab('compras')}
                  onIrAVentas={() => setCurrentTab('ventas')}
                  onIrACargarFactura={() => setModalCargaAbierto(true)}
                  onIrACargarExcel={() => setModalExcelAbierto(true)}
                  onIrAReportes={() => setCurrentTab('reportes')}
                />
              )}

              {currentTab === 'ventas' && (
                <VentasView
                  ventas={ventas}
                  onDatosActualizados={recargarDatos}
                />
              )}

              {currentTab === 'compras' && (
                <ListadoDocumentos
                  documentos={documentos}
                  categorias={categorias}
                  centrosCosto={centrosCosto}
                  proveedores={proveedores}
                  onDatosActualizados={recargarDatos}
                  onEditarDocumento={handleEditarDocumento}
                  onAbrirCargaFactura={() => setModalCargaAbierto(true)}
                  onAbrirCargaExcel={() => setModalExcelAbierto(true)}
                  onAbrirRegistroManual={() => {
                    setDocumentoParaEditar(undefined);
                    setModalManualAbierto(true);
                  }}
                />
              )}

              {currentTab === 'reportes' && (
                <ReportesView
                  documentos={documentos}
                  categorias={categorias}
                  centrosCosto={centrosCosto}
                  proveedores={proveedores}
                  ventas={ventas}
                />
              )}

              {currentTab === 'catalogos' && (
                <CatalogosView
                  proveedores={proveedores}
                  categorias={categorias}
                  centrosCosto={centrosCosto}
                  onDatosActualizados={recargarDatos}
                />
              )}

              {currentTab === 'configuracion' && (
                <ConfiguracionView
                  onDatosActualizados={recargarDatos}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Botón Flotante de Acceso Rápido "+ Nuevo Registro" */}
      <BotonFlotanteNuevo
        onNuevaVenta={() => setModalVentaAbierto(true)}
        onSubirFactura={() => setModalCargaAbierto(true)}
        onCargarExcel={() => setModalExcelAbierto(true)}
        onRegistroManual={() => {
          setDocumentoParaEditar(undefined);
          setModalManualAbierto(true);
        }}
      />

      {/* Modal Carga Factura Electrónica (XML / PDF / ZIP) */}
      {modalCargaAbierto && (
        <CargaFacturaModal
          categorias={categorias}
          centrosCosto={centrosCosto}
          proveedores={proveedores}
          onFacturaGuardada={() => {
            recargarDatos();
            setCurrentTab('compras');
          }}
          onAbrirCargaExcel={() => setModalExcelAbierto(true)}
          onCerrar={() => setModalCargaAbierto(false)}
        />
      )}

      {/* Modal Importar Facturas desde Excel */}
      {modalExcelAbierto && (
        <CargaExcelModal
          categorias={categorias}
          centrosCosto={centrosCosto}
          proveedores={proveedores}
          onFacturasImportadas={() => {
            recargarDatos();
            setCurrentTab('compras');
          }}
          onCerrar={() => setModalExcelAbierto(false)}
        />
      )}

      {/* Modal Registro Manual (o edición de compras/gastos) */}
      {modalManualAbierto && (
        <RegistroManualModal
          categorias={categorias}
          centrosCosto={centrosCosto}
          proveedores={proveedores}
          documentoParaEditar={documentoParaEditar}
          onGuardado={() => {
            setModalManualAbierto(false);
            setDocumentoParaEditar(undefined);
            recargarDatos();
            setCurrentTab('compras');
          }}
          onCerrar={() => {
            setModalManualAbierto(false);
            setDocumentoParaEditar(undefined);
          }}
          onProveedorCreado={recargarDatos}
        />
      )}

      {/* Modal Registro Rápido de Venta */}
      {modalVentaAbierto && (
        <ModalRegistroVenta
          onGuardado={() => {
            setModalVentaAbierto(false);
            recargarDatos();
            setCurrentTab('ventas');
          }}
          onCerrar={() => setModalVentaAbierto(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <VetComprasApp />
      </ToastProvider>
    </ThemeProvider>
  );
}
