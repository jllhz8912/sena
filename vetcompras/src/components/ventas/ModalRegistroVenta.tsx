import React, { useState, useEffect } from 'react';
import {
  X,
  CircleDollarSign,
  ShoppingBag,
  Stethoscope,
  Scissors,
  Wheat,
  Pill,
  Calendar,
  User,
  Phone,
  Heart,
  CreditCard,
  Banknote,
  Smartphone,
  Clock,
  CheckCircle2,
  AlertCircle,
  Save,
  Syringe,
  Activity,
  Package,
  Sparkles,
  Tag,
} from 'lucide-react';
import { Venta, CategoriaVenta, MedioPagoVenta, EstadoVenta, SubcategoriaVenta } from '../../types';
import { formatCOP, SUBCATEGORIAS_POR_CATEGORIA } from '../../utils/formatters';
import { dataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';

interface ModalRegistroVentaProps {
  ventaParaEditar?: Venta;
  onGuardado: (ventaId: string) => void;
  onCerrar: () => void;
}

export const ModalRegistroVenta: React.FC<ModalRegistroVentaProps> = ({
  ventaParaEditar,
  onGuardado,
  onCerrar,
}) => {
  const { mostrarToast } = useToast();

  const [consecutivo, setConsecutivo] = useState(ventaParaEditar?.consecutivo || '');
  const [fecha, setFecha] = useState(
    ventaParaEditar?.fecha || new Date().toISOString().split('T')[0]
  );
  const [categoria, setCategoria] = useState<CategoriaVenta>(
    ventaParaEditar?.categoria || 'consultas_clinica'
  );
  const [subcategoria, setSubcategoria] = useState<string>(
    ventaParaEditar?.subcategoria || ''
  );
  const [concepto, setConcepto] = useState(ventaParaEditar?.concepto || '');
  const [monto, setMonto] = useState<number | ''>(
    ventaParaEditar ? ventaParaEditar.monto : ''
  );
  const [medioPago, setMedioPago] = useState<MedioPagoVenta>(
    ventaParaEditar?.medioPago || 'efectivo'
  );
  const [estado, setEstado] = useState<EstadoVenta>(
    ventaParaEditar?.estado || 'pagada'
  );
  const [clienteNombre, setClienteNombre] = useState(ventaParaEditar?.clienteNombre || '');
  const [clienteTelefono, setClienteTelefono] = useState(ventaParaEditar?.clienteTelefono || '');
  const [mascotaNombre, setMascotaNombre] = useState(ventaParaEditar?.mascotaNombre || '');
  const [observaciones, setObservaciones] = useState(ventaParaEditar?.observaciones || '');

  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!ventaParaEditar) {
      dataService.generarSiguienteConsecutivoVenta().then((sig) => {
        setConsecutivo(sig);
      });
    }
  }, [ventaParaEditar]);

  const handleCategoriaChange = (nuevaCat: CategoriaVenta) => {
    setCategoria(nuevaCat);
    const lista = SUBCATEGORIAS_POR_CATEGORIA[nuevaCat] || [];
    if (lista.length > 0) {
      if (!lista.some((s) => s.value === subcategoria)) {
        setSubcategoria(lista[0].value);
      }
    } else {
      setSubcategoria('');
    }
  };

  // Si selecciona a crédito, sugerir marcar como pendiente automáticamente
  const handleMedioPagoChange = (nuevoMedio: MedioPagoVenta) => {
    setMedioPago(nuevoMedio);
    if (nuevoMedio === 'credito') {
      setEstado('pendiente');
    } else if (estado === 'pendiente' && !ventaParaEditar) {
      setEstado('pagada');
    }
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!concepto.trim()) {
      mostrarToast('error', 'Falta concepto', 'Por favor describe qué se vendió.');
      return;
    }

    const valorMonto = Number(monto);
    if (isNaN(valorMonto) || valorMonto <= 0) {
      mostrarToast('error', 'Monto inválido', 'Por favor ingresa un monto mayor a cero.');
      return;
    }

    try {
      setGuardando(true);

      const nuevaVenta: Venta = {
        id: ventaParaEditar?.id || `vnt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        consecutivo: consecutivo.trim() || 'VNT-001',
        fecha,
        categoria,
        subcategoria: subcategoria.trim() || undefined,
        concepto: concepto.trim(),
        monto: Math.round(valorMonto),
        medioPago,
        estado,
        clienteNombre: clienteNombre.trim() || undefined,
        clienteTelefono: clienteTelefono.trim() || undefined,
        mascotaNombre: mascotaNombre.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
        creadoEn: ventaParaEditar?.creadoEn || new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      };

      if (ventaParaEditar) {
        await dataService.actualizarVenta(nuevaVenta);
        mostrarToast('success', 'Venta actualizada', `Registro ${nuevaVenta.consecutivo} guardado exitosamente.`);
      } else {
        await dataService.guardarVenta(nuevaVenta);
        mostrarToast('success', 'Venta registrada', `Registro ${nuevaVenta.consecutivo} guardado correctamente.`);
      }

      onGuardado(nuevaVenta.id);
    } catch (err: any) {
      mostrarToast('error', 'Error al guardar venta', err?.message || 'Ocurrió un problema');
    } finally {
      setGuardando(false);
    }
  };

  const categoriasConfig: { id: CategoriaVenta; label: string; desc: string; icon: any; color: string }[] = [
    {
      id: 'banos',
      label: 'Baños',
      desc: 'Baño medicado, secado, corte y estética',
      icon: Scissors,
      color: 'border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300',
    },
    {
      id: 'vacunas',
      label: 'Vacunas',
      desc: 'Antirrábica, séxtuple, triple felina, KC',
      icon: Syringe,
      color: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
    },
    {
      id: 'consultas_clinica',
      label: 'Consultas clinica',
      desc: 'Consulta médica general y especializada',
      icon: Stethoscope,
      color: 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300',
    },
    {
      id: 'tratamientos_clinica',
      label: 'Tratamientos clinica',
      desc: 'Canalizaciones, cirugías, curaciones, inyecciones',
      icon: Activity,
      color: 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300',
    },
    {
      id: 'purinas_empaque',
      label: 'Purinas (bultos y paquetes)',
      desc: 'Bultos cerrados y bolsas selladas de fábrica',
      icon: Package,
      color: 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
    },
    {
      id: 'purinas_granel',
      label: 'Purinas a granel',
      desc: 'Alimento pesado en báscula por kilos o libras',
      icon: Wheat,
      color: 'border-orange-500 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300',
    },
    {
      id: 'vitrina',
      label: 'Vitrina',
      desc: 'Accesorios, correas, pecheras, snacks, juguetes',
      icon: ShoppingBag,
      color: 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300',
    },
    {
      id: 'varios',
      label: 'Varios / Otros',
      desc: 'Guardería, transporte, domicilios, nuevos conceptos',
      icon: Sparkles,
      color: 'border-slate-500 bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300',
    },
  ];

  const mediosPagoConfig: { id: MedioPagoVenta; label: string; icon: any; desc: string }[] = [
    { id: 'efectivo', label: 'Efectivo', icon: Banknote, desc: 'Caja menor / Dinero físico' },
    { id: 'nequi', label: 'Transferencia Nequi / Daviplata', icon: Smartphone, desc: 'Pago electrónico por app móvil' },
    { id: 'bancos', label: 'Bancos / Tarjeta', icon: CreditCard, desc: 'Datáfono o transferencia bancaria' },
    { id: 'credito', label: 'A Crédito', icon: Clock, desc: 'Cuenta por cobrar al cliente' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm overflow-hidden animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Encabezado */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
              <CircleDollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {ventaParaEditar ? 'Editar Venta' : 'Registrar Venta Veterinaria'}
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-300 dark:border-emerald-800">
                  {consecutivo || 'VNT-001'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Se guardará en la base de datos de este equipo.
              </p>
            </div>
          </div>

          <button
            onClick={onCerrar}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleGuardar} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Fila 1: Fecha y Consecutivo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Fecha de la Venta *
              </label>
              <input
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Consecutivo / Recibo *
              </label>
              <input
                type="text"
                required
                value={consecutivo}
                onChange={(e) => setConsecutivo(e.target.value)}
                placeholder="Ej: VNT-001"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 uppercase"
              />
            </div>
          </div>

          {/* Fila 2: Selector de Categoría (5 categorías de venta) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Categoría de la Venta *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
              {categoriasConfig.map((cat) => {
                const Icono = cat.icon;
                const seleccionada = categoria === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoriaChange(cat.id)}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                      seleccionada
                        ? `${cat.color} border-2 shadow-sm scale-[1.02]`
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={`p-2 rounded-xl ${seleccionada ? 'bg-white dark:bg-slate-900 shadow-sm' : 'bg-slate-200 dark:bg-slate-700'}`}>
                        <Icono className="w-4 h-4" />
                      </div>
                      {seleccionada && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                    </div>
                    <div>
                      <div className="font-bold text-xs">{cat.label}</div>
                      <div className="text-[10px] opacity-75 line-clamp-1">{cat.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Subdivisión interactiva para cualquier categoría de ventas (con opción Varios en todas) */}
            {(() => {
              const subcategoriasDisponibles = SUBCATEGORIAS_POR_CATEGORIA[categoria] || [];
              if (subcategoriasDisponibles.length === 0) return null;

              return (
                <div className="mt-3.5 p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Subcategoría o Tipo de Servicio / Producto *</span>
                    </label>
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      Incluye opción &quot;Varios&quot; para conceptos nuevos
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {subcategoriasDisponibles.map((sub) => {
                      const activo = subcategoria === sub.value;
                      const esVarios = sub.value === 'varios';
                      return (
                        <button
                          key={sub.value}
                          type="button"
                          onClick={() => {
                            setSubcategoria(sub.value);
                            if (esVarios) {
                              if (!concepto.trim() || subcategoriasDisponibles.some((s) => concepto === s.nombreCorto || concepto.startsWith('Tratamiento '))) {
                                setConcepto('');
                              }
                            } else {
                              if (!concepto.trim() || subcategoriasDisponibles.some((s) => concepto === s.nombreCorto || concepto.startsWith('Tratamiento '))) {
                                setConcepto(categoria === 'tratamientos_clinica' ? `Tratamiento ${sub.nombreCorto}` : sub.nombreCorto);
                              }
                            }
                          }}
                          className={`px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all border flex items-center justify-between gap-1.5 ${
                            activo
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/30'
                              : esVarios
                              ? 'bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800 hover:border-amber-400'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                          }`}
                        >
                          <span className="line-clamp-1">{sub.label}</span>
                          {activo && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-white" />}
                        </button>
                      );
                    })}
                  </div>
                  {subcategoria === 'varios' && (
                    <div className="flex items-center gap-2 text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Has seleccionado <strong>Varios</strong>: Describe el nuevo concepto o producto específico en el campo &quot;Concepto / ¿Qué se vendió?&quot;.</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Fila 3: Concepto y Monto */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Concepto / ¿Qué se vendió? *
              </label>
              <input
                type="text"
                required
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Ej: Baño medicado perro mediano, Alimento Hills 3kg, Vacuna séxtuple..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 placeholder:font-normal"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Valor de la Venta ($ COP) *</span>
                {typeof monto === 'number' && monto > 0 && (
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCOP(monto)}
                  </span>
                )}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  $
                </span>
                <input
                  type="number"
                  required
                  min="0"
                  step="100"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="50000"
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-emerald-700 dark:text-emerald-300 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Fila 4: Medio de Pago y Estado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Modalidad de Pago *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {mediosPagoConfig.map((mp) => {
                  const Icono = mp.icon;
                  const activo = medioPago === mp.id;
                  return (
                    <button
                      key={mp.id}
                      type="button"
                      onClick={() => handleMedioPagoChange(mp.id)}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all text-xs font-medium ${
                        activo
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 font-bold'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Icono className={`w-4 h-4 ${activo ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                      <span className="line-clamp-1">{mp.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Estado del Cobro *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEstado('pagada')}
                  className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all ${
                    estado === 'pagada'
                      ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  ✓ Pagada / Cobrada
                </button>
                <button
                  type="button"
                  onClick={() => setEstado('pendiente')}
                  className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all ${
                    estado === 'pendiente'
                      ? 'border-rose-500 bg-rose-500 text-white shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  ⏳ Pendiente (Por cobrar)
                </button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                {estado === 'pagada'
                  ? 'El dinero ya ingresó a la veterinaria.'
                  : 'Queda registrada en cartera de clientes hasta que se marque como pagada.'}
              </p>
            </div>
          </div>

          {/* Fila 5: Datos del Cliente y Mascota (Opcional) */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              Datos del Cliente y Mascota (Opcional)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1 flex items-center gap-1">
                  <User className="w-3 h-3" /> Nombre del Cliente
                </label>
                <input
                  type="text"
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  placeholder="Ej: Laura Gómez"
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Teléfono / Celular
                </label>
                <input
                  type="text"
                  value={clienteTelefono}
                  onChange={(e) => setClienteTelefono(e.target.value)}
                  placeholder="Ej: 310 1234567"
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1 flex items-center gap-1">
                  <Heart className="w-3 h-3 text-rose-500" /> Mascota (Nombre / Raza)
                </label>
                <input
                  type="text"
                  value={mascotaNombre}
                  onChange={(e) => setMascotaNombre(e.target.value)}
                  placeholder="Ej: Toby (Pug)"
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Fila 6: Observaciones */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Observaciones o Notas (Opcional)
            </label>
            <input
              type="text"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej: Entregar historia clínica por WhatsApp, pendiente saldo de $15.000..."
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          {/* Botones de acción */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onCerrar}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{guardando ? 'Guardando...' : ventaParaEditar ? 'Guardar Cambios' : 'Registrar Venta'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
