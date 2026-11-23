import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronUp, Minus, Pencil, Plus, Receipt, Search, Trash2, X } from 'lucide-react';
import type { FichaPrecio, PagoVenta, Producto, Venta, VentaItem } from '../../types';
import { dataService } from '../../services/dataService';
import { construirCatalogo, buscarEnCatalogo, type EntradaCatalogo } from '../../utils/catalogoVenta';
import { calcularSaldos, normalizarNombre } from '../../utils/inventario';
import { sirvePara } from '../../utils/conceptos';
import { cerrarVenta, cambioEfectivo } from '../../utils/ventas';
import { CATEGORIAS_VENTA, MEDIOS_PAGO_VENTA, formatCOP } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';
import { ModalDocumentoVenta } from '../ventas/ModalDocumentoVenta';
import { ModalProductoMovil, type SemillaProducto } from './ModalProductoMovil';
import { colorDe, iniciales } from './fotos';

const nuevoId = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const soloNumero = (t: string) => Math.round(Number(String(t).replace(/[^\d]/g, '')) || 0);

interface Linea {
  clave: string;
  nombre: string;
  categoria: string;
  subcategoria?: string;
  productoId?: string;
  precio: number;
  cantidad: number;
}

/** Mosaico de un producto: foto o color con iniciales, nombre y precio. */
const Mosaico: React.FC<{ e: EntradaCatalogo; foto?: string; cantidad?: number; editar: boolean; onClick: () => void }> = ({ e, foto, cantidad, editar, onClick }) => (
  <button
    onClick={onClick}
    className="relative flex flex-col rounded-2xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 active:scale-[0.97] transition-transform text-left"
  >
    <div className="aspect-square w-full flex items-center justify-center text-white text-2xl font-black" style={{ background: foto ? '#fff' : colorDe(e.nombre) }}>
      {foto ? <img src={foto} alt="" className="w-full h-full object-cover" loading="lazy" /> : iniciales(e.nombre)}
    </div>
    <div className="px-2 py-1.5 min-h-[3.4rem] flex flex-col justify-between">
      <span className="text-[12px] leading-tight font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">{e.nombre}</span>
      <span className="text-[12px] font-bold text-green-700 dark:text-green-400 tabular-nums">{e.precio ? formatCOP(e.precio) : 'Precio libre'}</span>
    </div>
    {!!cantidad && (
      <span className="absolute top-1.5 right-1.5 min-w-[1.6rem] h-[1.6rem] px-1 rounded-full bg-green-600 text-white text-xs font-black flex items-center justify-center shadow">{cantidad}</span>
    )}
    {editar && (
      <span className="absolute top-1.5 left-1.5 w-7 h-7 rounded-full bg-white/90 text-slate-700 flex items-center justify-center shadow">
        <Pencil className="w-3.5 h-3.5" />
      </span>
    )}
  </button>
);

/**
 * Caja del celular: se toca un producto para sumarlo al ticket, y se cobra con
 * el medio de pago (calcula el cambio en efectivo) o se guarda a crédito.
 * En modo "editar" la misma cuadrícula sirve para crear productos y ponerles foto.
 */
export const CajaMovil: React.FC<{ modo: 'vender' | 'editar'; ventas: Venta[]; onVentaGuardada: () => void }> = ({ modo, ventas, onVentaGuardada }) => {
  const { mostrarToast } = useToast();
  const editar = modo === 'editar';
  const [productos, setProductos] = useState<Producto[]>([]);
  const [fichas, setFichas] = useState<FichaPrecio[]>([]);
  const [existencias, setExistencias] = useState<Map<string, number>>(new Map());
  const [pestana, setPestana] = useState<string>('todos');
  const [buscando, setBuscando] = useState(false);
  const [texto, setTexto] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [ticketAbierto, setTicketAbierto] = useState(false);
  const [cobrando, setCobrando] = useState<null | 'cobrar' | 'guardar'>(null);
  const [precioPara, setPrecioPara] = useState<EntradaCatalogo | 'libre' | null>(null);
  const [editando, setEditando] = useState<{ producto?: Producto; semilla?: SemillaProducto } | null>(null);
  const [vendida, setVendida] = useState<{ venta: Venta; cambio: number } | null>(null);
  const [recibo, setRecibo] = useState<Venta | null>(null);

  const cargar = useCallback(() => {
    Promise.all([dataService.obtenerProductos(), dataService.obtenerMovimientos(), dataService.obtenerFichasPrecio()])
      .then(([p, m, f]) => {
        setProductos(p);
        setExistencias(new Map(calcularSaldos(p, m).map((s) => [s.producto.id, s.saldo])));
        setFichas(f.filter((x) => x.activo !== false && x.precioVenta > 0));
      })
      .catch(() => undefined);
  }, []);
  useEffect(cargar, [cargar]);

  const venden = useMemo(() => productos.filter((p) => p.activo !== false && sirvePara(p, 'venta')), [productos]);
  const catalogo = useMemo(
    // Los nombres de ejemplo sin precio de las categorías no se muestran como mosaicos
    () => construirCatalogo({ fichas, productos: venden, existencias, ventas }).filter((e) => e.origen !== 'catalogo'),
    [fichas, venden, existencias, ventas]
  );
  const fotoDe = (e: EntradaCatalogo) => (e.productoId ? productos.find((p) => p.id === e.productoId)?.foto : venden.find((p) => normalizarNombre(p.nombre) === e.clave)?.foto);
  const productoDe = (e: EntradaCatalogo) => (e.productoId ? productos.find((p) => p.id === e.productoId) : venden.find((p) => normalizarNombre(p.nombre) === e.clave));

  const categoriasConProductos = CATEGORIAS_VENTA.filter((c) => catalogo.some((e) => e.categoria === c.id));
  const visibles = useMemo(() => {
    if (texto.trim()) return buscarEnCatalogo(catalogo, { texto }, 60);
    const lista = pestana === 'frecuentes' ? catalogo.filter((e) => e.vendidos > 0).sort((a, b) => b.vendidos - a.vendidos) : pestana === 'todos' ? catalogo : catalogo.filter((e) => e.categoria === pestana);
    return [...lista].sort((a, b) => (pestana === 'frecuentes' ? 0 : a.nombre.localeCompare(b.nombre, 'es')));
  }, [catalogo, pestana, texto]);

  const total = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);
  const articulos = lineas.reduce((s, l) => s + l.cantidad, 0);
  const cantidadDe = (clave: string) => lineas.filter((l) => l.clave === clave).reduce((s, l) => s + l.cantidad, 0);

  const sumar = (e: { clave: string; nombre: string; categoria: string; subcategoria?: string; productoId?: string }, precio: number) =>
    setLineas((ls) => {
      const i = ls.findIndex((l) => l.clave === e.clave && l.precio === precio);
      if (i >= 0) return ls.map((l, k) => (k === i ? { ...l, cantidad: l.cantidad + 1 } : l));
      return [...ls, { clave: e.clave, nombre: e.nombre, categoria: e.categoria, subcategoria: e.subcategoria, productoId: e.productoId, precio, cantidad: 1 }];
    });

  const tocar = (e: EntradaCatalogo) => {
    if (editar) {
      const p = productoDe(e);
      setEditando(p ? { producto: p } : { semilla: { nombre: e.nombre, precio: e.precio, categoria: e.categoria } });
      return;
    }
    if (!e.precio) return setPrecioPara(e);
    sumar(e, e.precio);
  };

  const cambiarCantidad = (k: number, delta: number) =>
    setLineas((ls) => ls.flatMap((l, i) => (i !== k ? [l] : l.cantidad + delta <= 0 ? [] : [{ ...l, cantidad: l.cantidad + delta }])));

  // ---------------------------------------------------------------- guardar venta
  const registrar = async (pagos: PagoVenta[], cliente: string) => {
    const consecutivo = await dataService.generarSiguienteConsecutivoVenta();
    const ahora = new Date().toISOString();
    const items: VentaItem[] = lineas.map((l) => ({
      id: nuevoId('itm'),
      categoria: l.categoria,
      subcategoria: l.subcategoria,
      concepto: l.nombre,
      cantidad: l.cantidad,
      precioUnitario: l.precio,
      subtotal: l.precio * l.cantidad,
      productoId: l.productoId,
    }));
    const venta = cerrarVenta({ id: nuevoId('vnt'), consecutivo, fecha: hoyLocal(), clienteNombre: cliente.trim() || undefined, items, pagos, creadoEn: ahora, actualizadoEn: ahora });
    await dataService.guardarVenta(venta);
    setLineas([]);
    setCobrando(null);
    setTicketAbierto(false);
    setVendida({ venta, cambio: cambioEfectivo(pagos) });
    onVentaGuardada();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Pestañas y búsqueda */}
      <div className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        {buscando ? (
          <div className="flex items-center gap-2 px-3 py-2">
            <Search className="w-5 h-5 text-slate-400" />
            <input id="caja-buscar" autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar producto, código…" className="flex-1 bg-transparent py-2 focus:outline-none text-slate-900 dark:text-white" />
            <button onClick={() => (setBuscando(false), setTexto(''))} className="p-2" title="Cerrar búsqueda">
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center">
            <div className="flex-1 flex gap-1.5 overflow-x-auto px-3 py-2.5 no-scrollbar">
              {[{ id: 'todos', label: 'Todos' }, ...(catalogo.some((e) => e.vendidos) ? [{ id: 'frecuentes', label: '★ Más vendidos' }] : []), ...categoriasConProductos].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setPestana(c.id)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap ${pestana === c.id ? 'bg-green-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <button id="caja-abrir-busqueda" onClick={() => setBuscando(true)} className="p-3 text-slate-600 dark:text-slate-300" title="Buscar">
              <Search className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Cuadrícula */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-3 gap-2.5">
          {editar && (
            <button id="caja-nuevo-producto" onClick={() => setEditando({ semilla: {} })} className="aspect-[3/4] rounded-2xl border-2 border-dashed border-green-500 text-green-700 dark:text-green-400 flex flex-col items-center justify-center gap-1 font-bold text-sm">
              <Plus className="w-8 h-8" /> Nuevo producto
            </button>
          )}
          {visibles.map((e) => (
            <Mosaico key={e.clave} e={e} foto={fotoDe(e)} cantidad={editar ? 0 : cantidadDe(e.clave)} editar={editar} onClick={() => tocar(e)} />
          ))}
          {!editar && (
            <button id="caja-otro" onClick={() => setPrecioPara('libre')} className="aspect-[3/4] rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 flex flex-col items-center justify-center gap-1 font-semibold text-sm">
              <Plus className="w-7 h-7" /> Otro valor
            </button>
          )}
        </div>
        {!visibles.length && !editar && (
          <p className="text-center text-sm text-slate-500 mt-8 px-6">
            {texto ? 'No hay productos con ese nombre.' : 'Aún no hay productos para vender. Créelos con su foto en el mosaico "Productos" del inicio.'}
          </p>
        )}
        <div className="h-28" />
      </div>

      {/* Barra del ticket */}
      {!editar && (
        <div className="shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-3 space-y-2" style={{ paddingBottom: 'calc(0.75rem + var(--sa-bottom, 0px))' }}>
          <button id="caja-ver-ticket" onClick={() => lineas.length && setTicketAbierto(true)} className="w-full flex items-center justify-between px-1 text-sm">
            <span className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
              <Receipt className="w-4 h-4" /> Ticket · {articulos} artículo{articulos === 1 ? '' : 's'}
            </span>
            {lineas.length > 0 && (
              <span className="flex items-center gap-1 text-green-700 dark:text-green-400 font-semibold">
                Ver <ChevronUp className="w-4 h-4" />
              </span>
            )}
          </button>
          <div className="grid grid-cols-[1fr_1.6fr] gap-2">
            <button id="caja-guardar" disabled={!lineas.length} onClick={() => setCobrando('guardar')} className="py-3.5 rounded-2xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white font-bold disabled:opacity-40">
              GUARDAR
            </button>
            <button id="caja-cobrar" disabled={!lineas.length} onClick={() => setCobrando('cobrar')} className="py-3.5 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-black disabled:opacity-40 tabular-nums">
              COBRAR {formatCOP(total)}
            </button>
          </div>
        </div>
      )}

      {/* Ticket */}
      {ticketAbierto && (
        <Hoja titulo={`Ticket · ${formatCOP(total)}`} onCerrar={() => setTicketAbierto(false)}>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {lineas.map((l, k) => (
              <div key={k} className="flex items-center gap-2 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{l.nombre}</p>
                  <p className="text-xs text-slate-500 tabular-nums">{formatCOP(l.precio)} c/u</p>
                </div>
                <button onClick={() => cambiarCantidad(k, -1)} className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center" title="Uno menos">
                  {l.cantidad === 1 ? <Trash2 className="w-4 h-4 text-rose-600" /> : <Minus className="w-4 h-4" />}
                </button>
                <span className="w-7 text-center font-bold tabular-nums">{l.cantidad}</span>
                <button onClick={() => cambiarCantidad(k, 1)} className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center" title="Uno más">
                  <Plus className="w-4 h-4" />
                </button>
                <span className="w-24 text-right font-bold tabular-nums">{formatCOP(l.precio * l.cantidad)}</span>
              </div>
            ))}
          </div>
          <button onClick={() => (setLineas([]), setTicketAbierto(false))} className="mt-3 text-sm text-rose-600 font-semibold">
            Vaciar ticket
          </button>
        </Hoja>
      )}

      {/* Precio libre o producto sin precio */}
      {precioPara && <HojaPrecio entrada={precioPara === 'libre' ? null : precioPara} onCerrar={() => setPrecioPara(null)} onAgregar={(nombre, precio) => {
        const e = precioPara === 'libre' ? { clave: 'libre:' + normalizarNombre(nombre), nombre, categoria: CATEGORIAS_VENTA[0]?.id || 'varios' } : precioPara;
        sumar(e, precio);
        setPrecioPara(null);
      }} />}

      {/* Cobrar o guardar a crédito */}
      {cobrando && <HojaCobro modo={cobrando} total={total} onCerrar={() => setCobrando(null)} onConfirmar={async (pagos, cliente) => {
        try {
          await registrar(pagos, cliente);
        } catch (err: any) {
          mostrarToast('error', 'No se guardó la venta', err?.message);
        }
      }} />}

      {/* Venta lista */}
      {vendida && (
        <Hoja titulo="" onCerrar={() => setVendida(null)}>
          <div className="text-center space-y-2 py-2">
            <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto" />
            <p className="text-lg font-bold">Venta {vendida.venta.consecutivo} guardada</p>
            <p className="text-3xl font-black tabular-nums">{formatCOP(vendida.venta.monto)}</p>
            {vendida.cambio > 0 && <p className="text-lg font-bold text-amber-700 tabular-nums">Cambio: {formatCOP(vendida.cambio)}</p>}
            {!!vendida.venta.saldoPendiente && <p className="text-sm font-semibold text-rose-600 tabular-nums">A crédito: {formatCOP(vendida.venta.saldoPendiente)}</p>}
          </div>
          <div className="grid gap-2 mt-3">
            <button id="venta-recibo" onClick={() => (setRecibo(vendida.venta), setVendida(null))} className="py-3 rounded-2xl border border-slate-300 dark:border-slate-600 font-semibold">
              Recibo (PDF o WhatsApp)
            </button>
            <button id="venta-nueva" onClick={() => setVendida(null)} className="py-3.5 rounded-2xl bg-green-600 text-white font-bold">
              Nueva venta
            </button>
          </div>
        </Hoja>
      )}
      {recibo && <ModalDocumentoVenta venta={recibo} empresa={dataService.obtenerDatosEmpresa()} onCerrar={() => setRecibo(null)} />}
      {editando && (
        <ModalProductoMovil
          producto={editando.producto}
          semilla={editando.semilla}
          onCerrar={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null);
            cargar();
          }}
        />
      )}
    </div>
  );
};

/** Hoja que sube desde abajo. */
export const Hoja: React.FC<{ titulo: string; onCerrar: () => void; children: React.ReactNode }> = ({ titulo, onCerrar, children }) => (
  <div className="fixed inset-0 z-[65] bg-slate-950/55 flex items-end" onClick={onCerrar}>
    <div className="w-full max-h-[88%] overflow-y-auto bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-t-3xl p-5" style={{ paddingBottom: 'calc(1.25rem + var(--sa-bottom, 0px))' }} onClick={(e) => e.stopPropagation()}>
      <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-3" />
      {titulo && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold">{titulo}</h3>
          <button onClick={onCerrar} className="p-1.5" title="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      {children}
    </div>
  </div>
);

const HojaPrecio: React.FC<{ entrada: EntradaCatalogo | null; onCerrar: () => void; onAgregar: (nombre: string, precio: number) => void }> = ({ entrada, onCerrar, onAgregar }) => {
  const [nombre, setNombre] = useState(entrada?.nombre || '');
  const [valor, setValor] = useState('');
  const precio = soloNumero(valor);
  return (
    <Hoja titulo={entrada ? entrada.nombre : 'Otro valor'} onCerrar={onCerrar}>
      <div className="space-y-3">
        {!entrada && (
          <input id="libre-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Concepto (ej. Domicilio)" className="w-full px-3 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" />
        )}
        <input id="libre-precio" autoFocus inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Precio" className="w-full px-3 py-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-2xl font-black text-right tabular-nums" />
        <p className="text-right text-sm text-slate-500 tabular-nums">{formatCOP(precio)}</p>
        <button id="libre-agregar" disabled={!precio || !nombre.trim()} onClick={() => onAgregar(nombre.trim(), precio)} className="w-full py-3.5 rounded-2xl bg-green-600 text-white font-bold disabled:opacity-40">
          Agregar al ticket
        </button>
      </div>
    </Hoja>
  );
};

const HojaCobro: React.FC<{ modo: 'cobrar' | 'guardar'; total: number; onCerrar: () => void; onConfirmar: (pagos: PagoVenta[], cliente: string) => Promise<void> }> = ({ modo, total, onCerrar, onConfirmar }) => {
  const [medio, setMedio] = useState<PagoVenta['medio']>('efectivo');
  const [recibido, setRecibido] = useState('');
  const [cliente, setCliente] = useState('');
  const [guardando, setGuardando] = useState(false);
  const entregado = soloNumero(recibido);
  const cambio = medio === 'efectivo' && entregado > total ? entregado - total : 0;
  const sugeridos = [total, ...[10000, 20000, 50000, 100000].map((b) => Math.ceil(total / b) * b)].filter((v, i, a) => v >= total && a.indexOf(v) === i).slice(0, 4);
  const aCredito = modo === 'guardar';

  const confirmar = async () => {
    setGuardando(true);
    await onConfirmar(aCredito ? [] : [{ id: nuevoId('pag'), medio, monto: total, ...(medio === 'efectivo' && entregado ? { recibido: entregado } : {}) }], cliente);
    setGuardando(false);
  };

  return (
    <Hoja titulo={aCredito ? 'Guardar sin cobrar (a crédito)' : `Cobrar ${formatCOP(total)}`} onCerrar={onCerrar}>
      <div className="space-y-4">
        {!aCredito && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {MEDIOS_PAGO_VENTA.map((m) => (
                <button
                  key={m.id}
                  id={`medio-${m.id}`}
                  onClick={() => setMedio(m.id)}
                  className={`py-3 rounded-xl text-sm font-bold border ${medio === m.id ? 'bg-green-600 border-green-600 text-white' : 'border-slate-300 dark:border-slate-700'}`}
                >
                  {m.id === 'bancos' ? 'Transferencia' : m.label}
                </button>
              ))}
            </div>
            {medio === 'efectivo' && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500">¿Con cuánto paga?</p>
                <div className="flex flex-wrap gap-2">
                  {sugeridos.map((v) => (
                    <button key={v} onClick={() => setRecibido(String(v))} className={`px-3 py-2 rounded-xl text-sm font-bold border tabular-nums ${entregado === v ? 'bg-amber-100 border-amber-400 text-amber-900' : 'border-slate-300 dark:border-slate-700'}`}>
                      {v === total ? 'Exacto' : formatCOP(v)}
                    </button>
                  ))}
                </div>
                <input id="cobro-recibido" inputMode="numeric" value={recibido} onChange={(e) => setRecibido(e.target.value)} placeholder="Otro valor recibido" className="w-full px-3 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-right font-bold tabular-nums" />
                {cambio > 0 && <p className="text-right text-xl font-black text-amber-700 tabular-nums">Cambio: {formatCOP(cambio)}</p>}
                {!!recibido && entregado < total && (
                  <p className="text-right text-sm font-semibold text-rose-600 tabular-nums">Faltan {formatCOP(total - entregado)}. Si paga una parte, use “Guardar” para dejar el resto a crédito.</p>
                )}
              </div>
            )}
          </>
        )}
        <div className="space-y-1">
          <label htmlFor="cobro-cliente" className="text-xs font-semibold text-slate-500">
            Cliente {aCredito ? '(obligatorio para venta a crédito)' : '(opcional)'}
          </label>
          <input id="cobro-cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre del cliente" className="w-full px-3 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" />
        </div>
        <button
          id="cobro-confirmar"
          disabled={guardando || (aCredito && !cliente.trim()) || (medio === 'efectivo' && !!recibido && entregado < total)}
          onClick={confirmar}
          className="w-full py-4 rounded-2xl bg-green-600 hover:bg-green-700 text-white text-lg font-black disabled:opacity-40 tabular-nums"
        >
          {aCredito ? `Guardar a crédito ${formatCOP(total)}` : `Cobrar ${formatCOP(total)}`}
        </button>
      </div>
    </Hoja>
  );
};
