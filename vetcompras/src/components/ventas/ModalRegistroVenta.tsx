import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Save,
  Receipt,
  User,
  Heart,
  CalendarDays,
  ShoppingCart,
  Wallet,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { Venta, VentaItem, PagoVenta, CategoriaVenta } from '../../types';
import {
  formatCOP,
  CATEGORIAS_VENTA,
  MEDIOS_PAGO_VENTA,
  SUBCATEGORIAS_POR_CATEGORIA,
  fechaLocal,
} from '../../utils/formatters';
import {
  cerrarVenta,
  itemsDeVenta,
  pagosDeVenta,
  subtotalItem,
  totalPagado,
  cambioEfectivo,
} from '../../utils/ventas';
import { dataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { ModalDocumentoVenta } from './ModalDocumentoVenta';

interface ModalRegistroVentaProps {
  ventaParaEditar?: Venta;
  onGuardado: (ventaId: string) => void;
  onCerrar: () => void;
}

const nuevoId = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const hoy = () => fechaLocal();

const claseInput =
  'w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500';
const claseCelda =
  'w-full px-2 py-1.5 rounded-lg border border-transparent hover:border-slate-300 focus:border-emerald-500 dark:hover:border-slate-600 bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500';
const claseEtiqueta = 'block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1';

/** Campo numérico en pesos: muestra separador de miles mientras se escribe. */
const CampoPesos: React.FC<{
  id?: string;
  valor: number;
  onChange: (v: number) => void;
  className?: string;
  onEnter?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}> = ({ id, valor, onChange, className, onEnter, placeholder, autoFocus }) => (
  <input
    id={id}
    inputMode="numeric"
    value={valor ? valor.toLocaleString('es-CO') : ''}
    placeholder={placeholder ?? '0'}
    autoFocus={autoFocus}
    onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)}
    onKeyDown={(e) => {
      if (e.key === 'Enter' && onEnter) {
        e.preventDefault();
        onEnter();
      }
    }}
    className={(className || claseInput) + ' text-right tabular-nums'}
  />
);

const Seccion: React.FC<{ numero: number; titulo: string; icono: React.ElementType; children: React.ReactNode; extra?: React.ReactNode }> = ({
  numero,
  titulo,
  icono: Icono,
  children,
  extra,
}) => (
  <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center">{numero}</span>
        <Icono className="w-4 h-4 text-emerald-600" />
        {titulo}
      </h3>
      {extra}
    </div>
    {children}
  </section>
);

interface ClienteConocido {
  nombre: string;
  documento?: string;
  telefono?: string;
  email?: string;
  mascotas: string[];
}

export const ModalRegistroVenta: React.FC<ModalRegistroVentaProps> = ({ ventaParaEditar, onGuardado, onCerrar }) => {
  const { mostrarToast } = useToast();
  const editando = !!ventaParaEditar;

  // 1. Documento
  const [fecha, setFecha] = useState(ventaParaEditar?.fecha || hoy());
  const [consecutivo, setConsecutivo] = useState(ventaParaEditar?.consecutivo || '');
  // 2. Cliente
  const [clienteNombre, setClienteNombre] = useState(ventaParaEditar?.clienteNombre || '');
  const [clienteDocumento, setClienteDocumento] = useState(ventaParaEditar?.clienteDocumento || '');
  const [clienteTelefono, setClienteTelefono] = useState(ventaParaEditar?.clienteTelefono || '');
  const [clienteEmail, setClienteEmail] = useState(ventaParaEditar?.clienteEmail || '');
  // 3. Mascota
  const [mascotaNombre, setMascotaNombre] = useState(ventaParaEditar?.mascotaNombre || '');
  // 4. Ítems
  const [items, setItems] = useState<VentaItem[]>(() => (ventaParaEditar ? itemsDeVenta(ventaParaEditar).map((i) => ({ ...i })) : []));
  const [nuevo, setNuevo] = useState({ categoria: 'consultas_clinica', concepto: '', cantidad: 1, precioUnitario: 0, descuento: 0 });
  // 5. Pagos
  const [pagos, setPagos] = useState<PagoVenta[]>(() => (ventaParaEditar ? pagosDeVenta(ventaParaEditar).map((p) => ({ ...p })) : []));
  const [observaciones, setObservaciones] = useState(ventaParaEditar?.observaciones || '');

  const [ventasPrevias, setVentasPrevias] = useState<Venta[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [ventaParaRecibo, setVentaParaRecibo] = useState<Venta | null>(null);
  const conceptoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    dataService
      .obtenerVentas()
      .then(setVentasPrevias)
      .catch(() => setVentasPrevias([]));
    if (!editando) dataService.generarSiguienteConsecutivoVenta().then(setConsecutivo);
  }, [editando]);

  // Clientes ya atendidos: al escribir el nombre se completan sus datos
  const clientesConocidos = useMemo(() => {
    const mapa = new Map<string, ClienteConocido>();
    for (const v of [...ventasPrevias].reverse()) {
      if (!v.clienteNombre) continue;
      const clave = v.clienteNombre.trim().toLowerCase();
      const c = mapa.get(clave) || { nombre: v.clienteNombre.trim(), mascotas: [] };
      c.documento = v.clienteDocumento || c.documento;
      c.telefono = v.clienteTelefono || c.telefono;
      c.email = v.clienteEmail || c.email;
      if (v.mascotaNombre && !c.mascotas.includes(v.mascotaNombre)) c.mascotas.push(v.mascotaNombre);
      mapa.set(clave, c);
    }
    return mapa;
  }, [ventasPrevias]);

  // Último precio cobrado por cada concepto, para sugerirlo
  const preciosConocidos = useMemo(() => {
    const mapa = new Map<string, { precio: number; categoria: string }>();
    for (const v of [...ventasPrevias].reverse()) {
      for (const i of itemsDeVenta(v)) mapa.set(i.concepto.trim().toLowerCase(), { precio: i.precioUnitario, categoria: i.categoria });
    }
    return mapa;
  }, [ventasPrevias]);

  const sugerenciasConcepto = useMemo(() => {
    const sub = (SUBCATEGORIAS_POR_CATEGORIA[nuevo.categoria] || []).map((s) => s.nombreCorto);
    const usados = [...preciosConocidos.entries()].filter(([, v]) => v.categoria === nuevo.categoria).map(([k]) => k);
    return [...new Set([...sub, ...usados])];
  }, [nuevo.categoria, preciosConocidos]);

  const alCambiarCliente = (nombre: string) => {
    setClienteNombre(nombre);
    const c = clientesConocidos.get(nombre.trim().toLowerCase());
    if (c && !editando) {
      if (!clienteDocumento && c.documento) setClienteDocumento(c.documento);
      if (!clienteTelefono && c.telefono) setClienteTelefono(c.telefono);
      if (!clienteEmail && c.email) setClienteEmail(c.email);
      if (!mascotaNombre && c.mascotas.length === 1) setMascotaNombre(c.mascotas[0]);
    }
  };

  const alCambiarConceptoNuevo = (concepto: string) => {
    const conocido = preciosConocidos.get(concepto.trim().toLowerCase());
    setNuevo((n) => ({ ...n, concepto, precioUnitario: n.precioUnitario || conocido?.precio || 0 }));
  };

  // ------------------------------------------------------------ cálculos
  const total = items.reduce((s, i) => s + subtotalItem(i), 0);
  const pagado = totalPagado(pagos);
  const saldo = Math.max(0, total - pagado);
  const exceso = Math.max(0, pagado - total);
  const cambio = cambioEfectivo(pagos);
  const subtotalNuevo = subtotalItem(nuevo);

  // ------------------------------------------------------------ ítems
  const agregarItem = () => {
    if (!nuevo.concepto.trim()) {
      mostrarToast('warning', 'Falta el concepto', 'Escriba o elija qué se está vendiendo.');
      conceptoRef.current?.focus();
      return;
    }
    if (!(nuevo.cantidad > 0) || !(nuevo.precioUnitario > 0)) {
      mostrarToast('warning', 'Revise cantidad y precio', 'Ambos deben ser mayores a cero.');
      return;
    }
    const sub = SUBCATEGORIAS_POR_CATEGORIA[nuevo.categoria]?.find((s) => s.nombreCorto.toLowerCase() === nuevo.concepto.trim().toLowerCase());
    setItems((lista) => [
      ...lista,
      {
        id: nuevoId('itm'),
        categoria: nuevo.categoria as CategoriaVenta,
        subcategoria: sub?.value,
        concepto: nuevo.concepto.trim(),
        cantidad: nuevo.cantidad,
        precioUnitario: nuevo.precioUnitario,
        descuento: nuevo.descuento || undefined,
        subtotal: subtotalNuevo,
      },
    ]);
    setNuevo((n) => ({ ...n, concepto: '', cantidad: 1, precioUnitario: 0, descuento: 0 }));
    conceptoRef.current?.focus();
  };

  const editarItem = (id: string, cambios: Partial<VentaItem>) =>
    setItems((lista) =>
      lista.map((i) => {
        if (i.id !== id) return i;
        const actualizado = { ...i, ...cambios };
        return { ...actualizado, subtotal: subtotalItem(actualizado) };
      })
    );

  const quitarItem = (id: string) => setItems((lista) => lista.filter((i) => i.id !== id));

  // ------------------------------------------------------------ pagos
  const agregarPago = (medio: PagoVenta['medio'] = 'efectivo') =>
    setPagos((lista) => [...lista, { id: nuevoId('pag'), medio, monto: Math.max(0, total - totalPagado(lista)) }]);

  const pagarTodoCon = (medio: PagoVenta['medio']) => setPagos([{ id: nuevoId('pag'), medio, monto: total }]);

  const editarPago = (id: string, cambios: Partial<PagoVenta>) =>
    setPagos((lista) => lista.map((p) => (p.id === id ? { ...p, ...cambios } : p)));

  const quitarPago = (id: string) => setPagos((lista) => lista.filter((p) => p.id !== id));

  // ------------------------------------------------------------ guardar
  const guardar = async (verRecibo: boolean) => {
    if (items.length === 0) {
      mostrarToast('warning', 'Venta vacía', 'Agregue al menos un ítem antes de cerrar la venta.');
      return;
    }
    if (items.some((i) => !i.concepto.trim() || !(i.cantidad > 0) || !(i.precioUnitario > 0))) {
      mostrarToast('warning', 'Revise los ítems', 'Cada ítem necesita concepto, cantidad y precio mayores a cero.');
      return;
    }
    if (exceso > 0) {
      mostrarToast('warning', 'Los pagos superan el total', `Sobran ${formatCOP(exceso)}. Si el cliente entregó más efectivo, escríbalo en "Recibido" para calcular el cambio.`);
      return;
    }
    if (saldo > 0 && !clienteNombre.trim()) {
      mostrarToast('warning', 'Venta a crédito sin cliente', `Quedan ${formatCOP(saldo)} por cobrar: escriba el nombre del cliente.`);
      return;
    }
    const numero = consecutivo.trim();
    if (!numero) {
      mostrarToast('warning', 'Falta el número', 'Escriba el número del recibo.');
      return;
    }
    if (ventasPrevias.some((v) => v.consecutivo === numero && v.id !== ventaParaEditar?.id)) {
      mostrarToast('warning', 'Número repetido', `Ya existe una venta con el número ${numero}.`);
      return;
    }

    const ahora = new Date().toISOString();
    const venta = cerrarVenta({
      id: ventaParaEditar?.id || nuevoId('vnt'),
      consecutivo: numero,
      fecha,
      clienteNombre: clienteNombre.trim() || undefined,
      clienteDocumento: clienteDocumento.trim() || undefined,
      clienteTelefono: clienteTelefono.trim() || undefined,
      clienteEmail: clienteEmail.trim() || undefined,
      mascotaNombre: mascotaNombre.trim() || undefined,
      items,
      pagos,
      observaciones: observaciones.trim() || undefined,
      creadoEn: ventaParaEditar?.creadoEn || ahora,
      actualizadoEn: ahora,
    });

    try {
      setGuardando(true);
      if (editando) await dataService.actualizarVenta(venta);
      else await dataService.guardarVenta(venta);
      mostrarToast('success', editando ? 'Venta actualizada' : 'Venta registrada', `${venta.consecutivo} por ${formatCOP(venta.monto)}.`);
      if (verRecibo) setVentaParaRecibo(venta);
      else onGuardado(venta.id);
    } catch (err: any) {
      mostrarToast('error', 'No se guardó la venta', err?.message);
    } finally {
      setGuardando(false);
    }
  };

  if (ventaParaRecibo) {
    return (
      <ModalDocumentoVenta
        venta={ventaParaRecibo}
        empresa={dataService.obtenerDatosEmpresa()}
        onCerrar={() => onGuardado(ventaParaRecibo.id)}
      />
    );
  }

  const nombreCategoria = (id: string) => CATEGORIAS_VENTA.find((c) => c.id === id)?.label || id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-slate-50 dark:bg-slate-950 sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-6xl h-full sm:h-[94vh] flex flex-col overflow-hidden">
        {/* Encabezado */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{editando ? `Editar venta ${ventaParaEditar?.consecutivo}` : 'Nueva venta'}</h2>
            <p className="text-xs text-slate-500">Complete en orden: documento, cliente, mascota, ítems y forma de pago.</p>
          </div>
          <button onClick={onCerrar} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800" title="Cerrar sin guardar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* Formulario */}
          <div className="flex-1 min-w-0 overflow-y-auto p-4 space-y-4">
            <Seccion numero={1} titulo="Datos del documento" icono={CalendarDays}>
              <div className="grid grid-cols-2 gap-3 max-w-md">
                <div>
                  <label htmlFor="venta-fecha" className={claseEtiqueta}>Fecha</label>
                  <input id="venta-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={claseInput} />
                </div>
                <div>
                  <label htmlFor="venta-numero" className={claseEtiqueta}>N.º de recibo</label>
                  <input id="venta-numero" value={consecutivo} onChange={(e) => setConsecutivo(e.target.value.toUpperCase())} className={claseInput + ' font-mono'} />
                </div>
              </div>
            </Seccion>

            <Seccion numero={2} titulo="Cliente" icono={User}>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="venta-cliente" className={claseEtiqueta}>Nombre del cliente</label>
                  <input id="venta-cliente" list="clientes-conocidos" value={clienteNombre} onChange={(e) => alCambiarCliente(e.target.value)} placeholder="Escriba o elija un cliente anterior" className={claseInput} />
                  <datalist id="clientes-conocidos">
                    {[...clientesConocidos.values()].map((c) => (
                      <option key={c.nombre} value={c.nombre} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label htmlFor="venta-documento" className={claseEtiqueta}>Cédula o NIT</label>
                  <input id="venta-documento" value={clienteDocumento} onChange={(e) => setClienteDocumento(e.target.value)} inputMode="numeric" className={claseInput} />
                </div>
                <div>
                  <label htmlFor="venta-telefono" className={claseEtiqueta}>Celular / WhatsApp</label>
                  <input id="venta-telefono" value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value)} inputMode="tel" className={claseInput} />
                </div>
                <div>
                  <label htmlFor="venta-email" className={claseEtiqueta}>Correo electrónico</label>
                  <input id="venta-email" type="email" value={clienteEmail} onChange={(e) => setClienteEmail(e.target.value)} className={claseInput} />
                </div>
              </div>
            </Seccion>

            <Seccion numero={3} titulo="Mascota" icono={Heart}>
              <div className="max-w-md">
                <label htmlFor="venta-mascota" className={claseEtiqueta}>Nombre y especie / raza</label>
                <input
                  id="venta-mascota"
                  list="mascotas-cliente"
                  value={mascotaNombre}
                  onChange={(e) => setMascotaNombre(e.target.value)}
                  placeholder="Ej. Lucas (Golden Retriever)"
                  className={claseInput}
                />
                <datalist id="mascotas-cliente">
                  {(clientesConocidos.get(clienteNombre.trim().toLowerCase())?.mascotas || []).map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
            </Seccion>

            <Seccion
              numero={4}
              titulo="Ítems de la venta"
              icono={ShoppingCart}
              extra={<span className="text-xs text-slate-500">{items.length} ítem(s)</span>}
            >
              {/* Fila para agregar */}
              <div className="grid grid-cols-2 md:grid-cols-12 gap-2 items-end rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 p-3">
                <div className="col-span-2 md:col-span-3">
                  <label htmlFor="nuevo-categoria" className={claseEtiqueta}>Categoría</label>
                  <select id="nuevo-categoria" value={nuevo.categoria} onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value })} className={claseInput}>
                    {CATEGORIAS_VENTA.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 md:col-span-4">
                  <label htmlFor="nuevo-concepto" className={claseEtiqueta}>Concepto o producto</label>
                  <input
                    id="nuevo-concepto"
                    ref={conceptoRef}
                    list="sugerencias-concepto"
                    value={nuevo.concepto}
                    onChange={(e) => alCambiarConceptoNuevo(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregarItem())}
                    placeholder="Ej. Consulta general, Nexgard 10-25 kg"
                    className={claseInput}
                  />
                  <datalist id="sugerencias-concepto">
                    {sugerenciasConcepto.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
                <div className="md:col-span-1">
                  <label htmlFor="nuevo-cantidad" className={claseEtiqueta}>Cant.</label>
                  <input
                    id="nuevo-cantidad"
                    type="number"
                    min={0}
                    step="any"
                    value={nuevo.cantidad}
                    onChange={(e) => setNuevo({ ...nuevo, cantidad: Number(e.target.value) })}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregarItem())}
                    className={claseInput + ' text-right'}
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="nuevo-precio" className={claseEtiqueta}>Precio unitario</label>
                  <CampoPesos id="nuevo-precio" valor={nuevo.precioUnitario} onChange={(v) => setNuevo({ ...nuevo, precioUnitario: v })} onEnter={agregarItem} />
                </div>
                <div className="col-span-2 md:col-span-2">
                  <button
                    type="button"
                    onClick={agregarItem}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold"
                    title="También puede presionar Enter"
                  >
                    <Plus className="w-4 h-4" /> Agregar {subtotalNuevo > 0 ? formatCOP(subtotalNuevo) : ''}
                  </button>
                </div>
              </div>

              {/* Ítems agregados: editables en la misma tabla */}
              {items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[720px]">
                    <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="text-left py-2 pl-2 w-40">Categoría</th>
                        <th className="text-left">Concepto</th>
                        <th className="text-right w-16">Cant.</th>
                        <th className="text-right w-28">Precio</th>
                        <th className="text-right w-24">Descuento</th>
                        <th className="text-right w-28 pr-2">Subtotal</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {items.map((i) => (
                        <tr key={i.id}>
                          <td className="py-1">
                            <select value={i.categoria} onChange={(e) => editarItem(i.id, { categoria: e.target.value as CategoriaVenta, subcategoria: undefined })} className={claseCelda} title={nombreCategoria(i.categoria)}>
                              {CATEGORIAS_VENTA.some((c) => c.id === i.categoria) ? null : <option value={i.categoria}>{nombreCategoria(i.categoria)}</option>}
                              {CATEGORIAS_VENTA.map((c) => (
                                <option key={c.id} value={c.id}>{c.label}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input value={i.concepto} onChange={(e) => editarItem(i.id, { concepto: e.target.value })} className={claseCelda} />
                          </td>
                          <td>
                            <input type="number" min={0} step="any" value={i.cantidad} onChange={(e) => editarItem(i.id, { cantidad: Number(e.target.value) })} className={claseCelda + ' text-right'} />
                          </td>
                          <td>
                            <CampoPesos valor={i.precioUnitario} onChange={(v) => editarItem(i.id, { precioUnitario: v })} className={claseCelda} />
                          </td>
                          <td>
                            <CampoPesos valor={i.descuento || 0} onChange={(v) => editarItem(i.id, { descuento: v || undefined })} className={claseCelda} placeholder="—" />
                          </td>
                          <td className="text-right pr-2 font-semibold tabular-nums">{formatCOP(subtotalItem(i))}</td>
                          <td>
                            <button onClick={() => quitarItem(i.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40" title="Quitar ítem">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center py-4">
                  Aún no hay ítems. Elija la categoría, escriba el concepto y el precio, y presione <strong>Agregar</strong> o Enter.
                </p>
              )}
            </Seccion>

            <Seccion
              numero={5}
              titulo="Forma de pago"
              icono={Wallet}
              extra={
                <button onClick={() => agregarPago()} disabled={total === 0} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-300 text-xs font-semibold disabled:opacity-40">
                  <Plus className="w-3.5 h-3.5" /> Agregar forma de pago
                </button>
              }
            >
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-slate-500 self-center">Pagar todo con:</span>
                {MEDIOS_PAGO_VENTA.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => pagarTodoCon(m.id)}
                    disabled={total === 0}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-950 text-xs font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-40"
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {pagos.length > 0 && (
                <div className="space-y-2">
                  {pagos.map((p) => (
                    <div key={p.id} className="grid grid-cols-2 md:grid-cols-12 gap-2 items-end">
                      <div className="md:col-span-3">
                        <label className={claseEtiqueta}>Medio</label>
                        <select value={p.medio} onChange={(e) => editarPago(p.id, { medio: e.target.value as PagoVenta['medio'], recibido: undefined })} className={claseInput}>
                          {MEDIOS_PAGO_VENTA.map((m) => (
                            <option key={m.id} value={m.id}>{m.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-3">
                        <label className={claseEtiqueta}>Valor</label>
                        <CampoPesos valor={p.monto} onChange={(v) => editarPago(p.id, { monto: v })} />
                      </div>
                      {p.medio === 'efectivo' ? (
                        <div className="md:col-span-3">
                          <label className={claseEtiqueta}>Recibido (para el cambio)</label>
                          <CampoPesos valor={p.recibido || 0} onChange={(v) => editarPago(p.id, { recibido: v || undefined })} placeholder="Opcional" />
                        </div>
                      ) : (
                        <div className="md:col-span-3">
                          <label className={claseEtiqueta}>Referencia / comprobante</label>
                          <input value={p.referencia || ''} onChange={(e) => editarPago(p.id, { referencia: e.target.value })} className={claseInput} placeholder="Opcional" />
                        </div>
                      )}
                      <div className="md:col-span-3 flex items-center gap-2">
                        {p.medio === 'efectivo' && p.recibido && p.recibido > p.monto ? (
                          <span className="text-xs font-semibold text-sky-700 dark:text-sky-300">Cambio: {formatCOP(p.recibido - p.monto)}</span>
                        ) : (
                          <span className="flex-1" />
                        )}
                        <button onClick={() => quitarPago(p.id)} className="ml-auto p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40" title="Quitar forma de pago">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-slate-500">Lo que no se pague queda como saldo a crédito del cliente.</p>
            </Seccion>

            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <label htmlFor="venta-observaciones" className={claseEtiqueta}>Observaciones (aparecen en el recibo)</label>
              <textarea id="venta-observaciones" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className={claseInput} />
            </section>
          </div>

          {/* Resumen y cierre */}
          <aside className="lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3">
            <div className="rounded-2xl bg-emerald-700 text-white p-4">
              <p className="text-[11px] uppercase tracking-wider opacity-80">Total de la venta</p>
              <p className="text-3xl font-extrabold tabular-nums">{formatCOP(total)}</p>
              <p className="text-xs opacity-80">{items.length} ítem(s)</p>
            </div>
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between">
                <dt className="text-slate-500">Pagado</dt>
                <dd className="font-semibold tabular-nums">{formatCOP(pagado)}</dd>
              </div>
              {pagos.map((p) => (
                <div key={p.id} className="flex justify-between text-xs text-slate-500 pl-3">
                  <dt>{MEDIOS_PAGO_VENTA.find((m) => m.id === p.medio)?.label}</dt>
                  <dd className="tabular-nums">{formatCOP(p.monto)}</dd>
                </div>
              ))}
              <div className={`flex justify-between ${saldo > 0 ? 'text-rose-700 dark:text-rose-300 font-bold' : 'text-slate-500'}`}>
                <dt>Saldo a crédito</dt>
                <dd className="tabular-nums">{formatCOP(saldo)}</dd>
              </div>
              {cambio > 0 && (
                <div className="flex justify-between text-sky-700 dark:text-sky-300 font-bold">
                  <dt>Cambio a devolver</dt>
                  <dd className="tabular-nums">{formatCOP(cambio)}</dd>
                </div>
              )}
            </dl>
            {exceso > 0 && (
              <p className="text-xs rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 p-2 flex gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" /> Los pagos superan el total en {formatCOP(exceso)}.
              </p>
            )}
            <div className="mt-auto grid gap-2">
              <button
                onClick={() => guardar(true)}
                disabled={guardando}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-60"
              >
                {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
                {editando ? 'Guardar y ver recibo' : 'Cerrar venta y generar recibo'}
              </button>
              <button
                onClick={() => guardar(false)}
                disabled={guardando}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-60"
              >
                <Save className="w-4 h-4" /> {editando ? 'Guardar cambios' : 'Guardar sin recibo'}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

