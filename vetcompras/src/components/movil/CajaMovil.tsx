import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, FileText, Minus, Pencil, Plus, Search, Trash2, UserRound, X } from 'lucide-react';
import type { FichaPrecio, PagoVenta, Producto, Venta, VentaItem } from '../../types';
import { dataService } from '../../services/dataService';
import { construirCatalogo, buscarEnCatalogo, type EntradaCatalogo } from '../../utils/catalogoVenta';
import { calcularSaldos, normalizarNombre } from '../../utils/inventario';
import { sirvePara } from '../../utils/conceptos';
import { cerrarVenta, cambioEfectivo } from '../../utils/ventas';
import { CATEGORIAS_VENTA, MEDIOS_PAGO_VENTA, formatCOP } from '../../utils/formatters';
import { etiquetaReferencia } from '../../utils/etiquetas';
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

export interface DatosCliente {
  nombre: string;
  documento: string;
  telefono: string;
  email: string;
  referencia: string;
  observaciones: string;
}
const CLIENTE_VACIO: DatosCliente = { nombre: '', documento: '', telefono: '', email: '', referencia: '', observaciones: '' };

/** Reparte un descuento total entre las líneas, en proporción a su valor (la última absorbe el redondeo). */
function repartirDescuento(lineas: Linea[], descuento: number): number[] {
  const bruto = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);
  if (!descuento || !bruto) return lineas.map(() => 0);
  let resto = Math.min(descuento, bruto);
  return lineas.map((l, i) => {
    if (i === lineas.length - 1) return resto;
    const parte = Math.round((descuento * l.precio * l.cantidad) / bruto);
    resto -= parte;
    return parte;
  });
}

/** Mosaico de un producto: foto (o color con iniciales), nombre y precio. */
const Mosaico: React.FC<{ e: EntradaCatalogo; foto?: string; cantidad?: number; editar: boolean; onClick: () => void }> = ({ e, foto, cantidad, editar, onClick }) => (
  <button
    onClick={onClick}
    className="relative flex flex-col rounded-xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 active:scale-[0.96] transition-transform text-left"
  >
    <div className="aspect-square w-full flex items-center justify-center text-white text-base font-black" style={{ background: foto ? '#fff' : colorDe(e.nombre) }}>
      {foto ? <img src={foto} alt="" className="w-full h-full object-cover" loading="lazy" /> : iniciales(e.nombre)}
    </div>
    <div className="px-1.5 py-1 min-h-[2.7rem] flex flex-col justify-between">
      <span className="text-[10.5px] leading-tight font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">{e.nombre}</span>
      <span className="text-[10.5px] font-bold text-green-700 dark:text-green-400 tabular-nums">{e.precio ? formatCOP(e.precio) : 'Precio libre'}</span>
    </div>
    {!!cantidad && (
      <span className="absolute top-1 right-1 min-w-[1.3rem] h-[1.3rem] px-1 rounded-full bg-green-600 text-white text-[11px] font-black flex items-center justify-center shadow">{cantidad}</span>
    )}
    {editar && (
      <span className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white/90 text-slate-700 flex items-center justify-center shadow">
        <Pencil className="w-3 h-3" />
      </span>
    )}
  </button>
);

/**
 * Caja del celular: se toca un producto para sumarlo al ticket, que se ve siempre
 * abajo con su autosuma (cantidad × precio, subtotal, descuento y total). Al cobrar
 * se piden los datos del cliente y sale el recibo con el membrete de la empresa.
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
  const [descuento, setDescuento] = useState(0);
  const [ticketPlegado, setTicketPlegado] = useState(false);
  const [cobrando, setCobrando] = useState<null | 'cobrar' | 'guardar'>(null);
  const [precioPara, setPrecioPara] = useState<EntradaCatalogo | 'libre' | null>(null);
  const [pidiendoDescuento, setPidiendoDescuento] = useState(false);
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
  const productoDe = (e: EntradaCatalogo) => (e.productoId ? productos.find((p) => p.id === e.productoId) : venden.find((p) => normalizarNombre(p.nombre) === e.clave));

  const categoriasConProductos = CATEGORIAS_VENTA.filter((c) => catalogo.some((e) => e.categoria === c.id));
  const visibles = useMemo(() => {
    if (texto.trim()) return buscarEnCatalogo(catalogo, { texto }, 80);
    const lista = pestana === 'frecuentes' ? catalogo.filter((e) => e.vendidos > 0).sort((a, b) => b.vendidos - a.vendidos) : pestana === 'todos' ? catalogo : catalogo.filter((e) => e.categoria === pestana);
    return [...lista].sort((a, b) => (pestana === 'frecuentes' ? 0 : a.nombre.localeCompare(b.nombre, 'es')));
  }, [catalogo, pestana, texto]);

  const subtotal = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);
  const descuentoAplicado = Math.min(descuento, subtotal);
  const total = subtotal - descuentoAplicado;
  const articulos = lineas.reduce((s, l) => s + l.cantidad, 0);
  const cantidadDe = (clave: string) => lineas.filter((l) => l.clave === clave).reduce((s, l) => s + l.cantidad, 0);

  const sumar = (e: { clave: string; nombre: string; categoria: string; subcategoria?: string; productoId?: string }, precio: number) => {
    setTicketPlegado(false);
    setLineas((ls) => {
      const i = ls.findIndex((l) => l.clave === e.clave && l.precio === precio);
      if (i >= 0) return ls.map((l, k) => (k === i ? { ...l, cantidad: l.cantidad + 1 } : l));
      return [...ls, { clave: e.clave, nombre: e.nombre, categoria: e.categoria, subcategoria: e.subcategoria, productoId: e.productoId, precio, cantidad: 1 }];
    });
  };

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
  const registrar = async (pagos: PagoVenta[], c: DatosCliente) => {
    const consecutivo = await dataService.generarSiguienteConsecutivoVenta();
    const ahora = new Date().toISOString();
    const partes = repartirDescuento(lineas, descuentoAplicado);
    const items: VentaItem[] = lineas.map((l, i) => ({
      id: nuevoId('itm'),
      categoria: l.categoria,
      subcategoria: l.subcategoria,
      concepto: l.nombre,
      cantidad: l.cantidad,
      precioUnitario: l.precio,
      descuento: partes[i] || undefined,
      subtotal: l.precio * l.cantidad - (partes[i] || 0),
      productoId: l.productoId,
    }));
    const venta = cerrarVenta({
      id: nuevoId('vnt'),
      consecutivo,
      fecha: hoyLocal(),
      clienteNombre: c.nombre.trim() || undefined,
      clienteDocumento: c.documento.trim() || undefined,
      clienteTelefono: c.telefono.trim() || undefined,
      clienteEmail: c.email.trim() || undefined,
      mascotaNombre: c.referencia.trim() || undefined,
      observaciones: c.observaciones.trim() || undefined,
      items,
      pagos,
      creadoEn: ahora,
      actualizadoEn: ahora,
    });
    await dataService.guardarVenta(venta);
    setLineas([]);
    setDescuento(0);
    setCobrando(null);
    setVendida({ venta, cambio: cambioEfectivo(pagos) });
    onVentaGuardada();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Pestañas y búsqueda */}
      <div className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        {buscando ? (
          <div className="flex items-center gap-2 px-3 py-1.5">
            <Search className="w-5 h-5 text-slate-400" />
            <input id="caja-buscar" autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar producto, código…" className="flex-1 bg-transparent py-2 focus:outline-none text-slate-900 dark:text-white" />
            <button onClick={() => (setBuscando(false), setTexto(''))} className="p-2" title="Cerrar búsqueda">
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center">
            <div className="flex-1 flex gap-1.5 overflow-x-auto px-3 py-2 no-scrollbar">
              {[{ id: 'todos', label: 'Todos' }, ...(catalogo.some((e) => e.vendidos) ? [{ id: 'frecuentes', label: '★ Más vendidos' }] : []), ...categoriasConProductos].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setPestana(c.id)}
                  className={`shrink-0 px-3 py-1 rounded-full text-[13px] font-semibold whitespace-nowrap ${pestana === c.id ? 'bg-green-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <button id="caja-abrir-busqueda" onClick={() => setBuscando(true)} className="p-2.5 text-slate-600 dark:text-slate-300" title="Buscar">
              <Search className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Cuadrícula */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2.5">
        <div className="grid grid-cols-4 gap-2">
          {editar && (
            <button id="caja-nuevo-producto" onClick={() => setEditando({ semilla: {} })} className="aspect-[3/4] rounded-xl border-2 border-dashed border-green-500 text-green-700 dark:text-green-400 flex flex-col items-center justify-center gap-0.5 font-bold text-[11px]">
              <Plus className="w-6 h-6" /> Nuevo
            </button>
          )}
          {visibles.map((e) => (
            <Mosaico key={e.clave} e={e} foto={productoDe(e)?.foto} cantidad={editar ? 0 : cantidadDe(e.clave)} editar={editar} onClick={() => tocar(e)} />
          ))}
          {!editar && (
            <button id="caja-otro" onClick={() => setPrecioPara('libre')} className="aspect-[3/4] rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 flex flex-col items-center justify-center gap-0.5 font-semibold text-[11px]">
              <Plus className="w-6 h-6" /> Otro valor
            </button>
          )}
        </div>
        {!visibles.length && !editar && (
          <p className="text-center text-sm text-slate-500 mt-8 px-6">
            {texto ? 'No hay productos con ese nombre.' : 'Aún no hay productos para vender. Créelos con su foto en el mosaico "Productos" del inicio.'}
          </p>
        )}
        {editar && <p className="text-center text-[12px] text-slate-500 mt-3 px-4">Toque un producto para cambiar su foto, nombre o precio.</p>}
      </div>

      {/* Ticket con autosuma */}
      {!editar && (
        <div className="shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-6px_16px_rgba(0,0,0,0.06)]" style={{ paddingBottom: 'calc(0.6rem + var(--sa-bottom, 0px))' }}>
          <button id="caja-ver-ticket" onClick={() => setTicketPlegado(!ticketPlegado)} className="w-full flex items-center justify-between px-3 pt-2 pb-1 text-[13px]">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              Ticket · {articulos} artículo{articulos === 1 ? '' : 's'}
            </span>
            {lineas.length > 0 && (ticketPlegado ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />)}
          </button>
          {!ticketPlegado && lineas.length > 0 && (
            <div className="max-h-[26vh] overflow-y-auto px-3 divide-y divide-slate-100 dark:divide-slate-800" id="caja-lineas">
              {lineas.map((l, k) => (
                <div key={k} className="flex items-center gap-1.5 py-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold truncate">{l.nombre}</p>
                    <p className="text-[11px] text-slate-500 tabular-nums">
                      {l.cantidad} × {formatCOP(l.precio)}
                    </p>
                  </div>
                  <button onClick={() => cambiarCantidad(k, -1)} className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center" title="Uno menos">
                    {l.cantidad === 1 ? <Trash2 className="w-3.5 h-3.5 text-rose-600" /> : <Minus className="w-3.5 h-3.5" />}
                  </button>
                  <span className="w-5 text-center text-[13px] font-bold tabular-nums">{l.cantidad}</span>
                  <button onClick={() => cambiarCantidad(k, 1)} className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center" title="Uno más">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-[5.5rem] text-right text-[13px] font-bold tabular-nums">{formatCOP(l.precio * l.cantidad)}</span>
                </div>
              ))}
            </div>
          )}
          {lineas.length > 0 && (
            <div className="px-3 pt-1.5 space-y-0.5 text-[13px] tabular-nums" id="caja-totales">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Subtotal</span>
                <span>{formatCOP(subtotal)}</span>
              </div>
              <button onClick={() => setPidiendoDescuento(true)} className="w-full flex justify-between text-slate-600 dark:text-slate-300">
                <span className="underline decoration-dotted">Descuento</span>
                <span>{descuentoAplicado ? `− ${formatCOP(descuentoAplicado)}` : 'Agregar'}</span>
              </button>
              <div className="flex justify-between text-[16px] font-black text-slate-900 dark:text-white">
                <span>Total</span>
                <span>{formatCOP(total)}</span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-[1fr_1.7fr] gap-2 px-3 pt-2">
            <button id="caja-guardar" disabled={!lineas.length} onClick={() => setCobrando('guardar')} className="py-3 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white font-bold text-sm disabled:opacity-40">
              GUARDAR
            </button>
            <button id="caja-cobrar" disabled={!lineas.length} onClick={() => setCobrando('cobrar')} className="py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-black text-sm disabled:opacity-40 tabular-nums">
              COBRAR {formatCOP(total)}
            </button>
          </div>
        </div>
      )}

      {/* Precio libre o producto sin precio */}
      {precioPara && (
        <HojaPrecio
          entrada={precioPara === 'libre' ? null : precioPara}
          onCerrar={() => setPrecioPara(null)}
          onAgregar={(nombre, precio) => {
            const e = precioPara === 'libre' ? { clave: 'libre:' + normalizarNombre(nombre), nombre, categoria: CATEGORIAS_VENTA[0]?.id || 'varios' } : precioPara;
            sumar(e, precio);
            setPrecioPara(null);
          }}
        />
      )}

      {pidiendoDescuento && (
        <HojaDescuento subtotal={subtotal} actual={descuentoAplicado} onCerrar={() => setPidiendoDescuento(false)} onAplicar={(v) => (setDescuento(v), setPidiendoDescuento(false))} />
      )}

      {/* Cobrar o guardar a crédito */}
      {cobrando && (
        <HojaCobro
          modo={cobrando}
          total={total}
          ventas={ventas}
          onCerrar={() => setCobrando(null)}
          onConfirmar={async (pagos, cliente) => {
            try {
              await registrar(pagos, cliente);
            } catch (err: any) {
              mostrarToast('error', 'No se guardó la venta', err?.message);
            }
          }}
        />
      )}

      {/* Venta lista */}
      {vendida && (
        <Hoja titulo="" onCerrar={() => setVendida(null)}>
          <div className="text-center space-y-1.5 py-1">
            <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto" />
            <p className="text-base font-bold">Venta {vendida.venta.consecutivo} guardada</p>
            <p className="text-3xl font-black tabular-nums">{formatCOP(vendida.venta.monto)}</p>
            {vendida.cambio > 0 && <p className="text-lg font-bold text-amber-700 tabular-nums">Cambio: {formatCOP(vendida.cambio)}</p>}
            {!!vendida.venta.saldoPendiente && <p className="text-sm font-semibold text-rose-600 tabular-nums">A crédito: {formatCOP(vendida.venta.saldoPendiente)}</p>}
            {vendida.venta.clienteNombre && <p className="text-sm text-slate-500">Cliente: {vendida.venta.clienteNombre}</p>}
          </div>
          <div className="grid gap-2 mt-3">
            <button id="venta-recibo" onClick={() => (setRecibo(vendida.venta), setVendida(null))} className="py-3 rounded-xl border border-slate-300 dark:border-slate-600 font-semibold flex items-center justify-center gap-2">
              <FileText className="w-4 h-4" /> Ver recibo con membrete (PDF o WhatsApp)
            </button>
            <button id="venta-nueva" onClick={() => setVendida(null)} className="py-3 rounded-xl bg-green-600 text-white font-bold">
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
    <div className="w-full max-h-[90%] overflow-y-auto bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-t-3xl p-4" style={{ paddingBottom: 'calc(1rem + var(--sa-bottom, 0px))' }} onClick={(e) => e.stopPropagation()}>
      <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-2.5" />
      {titulo && (
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-base font-bold">{titulo}</h3>
          <button onClick={onCerrar} className="p-1.5" title="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      {children}
    </div>
  </div>
);

const claseCampo = 'w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500';

const HojaPrecio: React.FC<{ entrada: EntradaCatalogo | null; onCerrar: () => void; onAgregar: (nombre: string, precio: number) => void }> = ({ entrada, onCerrar, onAgregar }) => {
  const [nombre, setNombre] = useState(entrada?.nombre || '');
  const [valor, setValor] = useState('');
  const precio = soloNumero(valor);
  return (
    <Hoja titulo={entrada ? entrada.nombre : 'Otro valor'} onCerrar={onCerrar}>
      <div className="space-y-3">
        {!entrada && <input id="libre-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Concepto (ej. Domicilio)" className={claseCampo} />}
        <input id="libre-precio" autoFocus inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Precio" className={claseCampo + ' py-3.5 text-2xl font-black text-right tabular-nums'} />
        <p className="text-right text-sm text-slate-500 tabular-nums">{formatCOP(precio)}</p>
        <button id="libre-agregar" disabled={!precio || !nombre.trim()} onClick={() => onAgregar(nombre.trim(), precio)} className="w-full py-3 rounded-xl bg-green-600 text-white font-bold disabled:opacity-40">
          Agregar al ticket
        </button>
      </div>
    </Hoja>
  );
};

const HojaDescuento: React.FC<{ subtotal: number; actual: number; onCerrar: () => void; onAplicar: (valor: number) => void }> = ({ subtotal, actual, onCerrar, onAplicar }) => {
  const [valor, setValor] = useState(actual ? String(actual) : '');
  const [porcentaje, setPorcentaje] = useState(false);
  const n = soloNumero(valor);
  const enPesos = porcentaje ? Math.round((subtotal * Math.min(100, n)) / 100) : Math.min(n, subtotal);
  return (
    <Hoja titulo="Descuento" onCerrar={onCerrar}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {[false, true].map((p) => (
            <button key={String(p)} onClick={() => setPorcentaje(p)} className={`py-2.5 rounded-xl font-bold border ${porcentaje === p ? 'bg-green-600 border-green-600 text-white' : 'border-slate-300 dark:border-slate-700'}`}>
              {p ? 'Porcentaje %' : 'Valor $'}
            </button>
          ))}
        </div>
        <input id="descuento-valor" autoFocus inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={porcentaje ? '10' : '5000'} className={claseCampo + ' py-3 text-xl font-black text-right tabular-nums'} />
        <p className="text-sm text-slate-600 dark:text-slate-300 tabular-nums flex justify-between">
          <span>Subtotal {formatCOP(subtotal)}</span>
          <span>Descuento − {formatCOP(enPesos)}</span>
        </p>
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <button onClick={() => onAplicar(0)} className="py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold">
            Quitar
          </button>
          <button id="descuento-aplicar" onClick={() => onAplicar(enPesos)} className="py-3 rounded-xl bg-green-600 text-white font-bold">
            Aplicar
          </button>
        </div>
      </div>
    </Hoja>
  );
};

const HojaCobro: React.FC<{
  modo: 'cobrar' | 'guardar';
  total: number;
  ventas: Venta[];
  onCerrar: () => void;
  onConfirmar: (pagos: PagoVenta[], cliente: DatosCliente) => Promise<void>;
}> = ({ modo, total, ventas, onCerrar, onConfirmar }) => {
  const [medio, setMedio] = useState<PagoVenta['medio']>('efectivo');
  const [recibido, setRecibido] = useState('');
  const [cliente, setCliente] = useState<DatosCliente>(CLIENTE_VACIO);
  const [verCliente, setVerCliente] = useState(modo === 'guardar');
  const [guardando, setGuardando] = useState(false);
  const entregado = soloNumero(recibido);
  const cambio = medio === 'efectivo' && entregado > total ? entregado - total : 0;
  const sugeridos = [total, ...[10000, 20000, 50000, 100000].map((b) => Math.ceil(total / b) * b)].filter((v, i, a) => v >= total && a.indexOf(v) === i).slice(0, 4);
  const aCredito = modo === 'guardar';
  const poner = (campo: keyof DatosCliente, valor: string) => setCliente((c) => ({ ...c, [campo]: valor }));

  // Clientes atendidos antes: al escribir el nombre se completan sus datos
  const clientes = useMemo(() => {
    const mapa = new Map<string, Venta>();
    for (const v of [...ventas].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))) if (v.clienteNombre?.trim()) mapa.set(v.clienteNombre.trim().toLowerCase(), v);
    return mapa;
  }, [ventas]);
  const alEscribirNombre = (nombre: string) => {
    const previo = clientes.get(nombre.trim().toLowerCase());
    setCliente((c) => ({
      ...c,
      nombre,
      ...(previo
        ? {
            documento: c.documento || previo.clienteDocumento || '',
            telefono: c.telefono || previo.clienteTelefono || '',
            email: c.email || previo.clienteEmail || '',
          }
        : {}),
    }));
  };

  const confirmar = async () => {
    setGuardando(true);
    await onConfirmar(aCredito ? [] : [{ id: nuevoId('pag'), medio, monto: total, ...(medio === 'efectivo' && entregado ? { recibido: entregado } : {}) }], cliente);
    setGuardando(false);
  };

  return (
    <Hoja titulo={aCredito ? 'Guardar sin cobrar (a crédito)' : `Cobrar ${formatCOP(total)}`} onCerrar={onCerrar}>
      <div className="space-y-3">
        {!aCredito && (
          <>
            <div className="grid grid-cols-3 gap-1.5">
              {MEDIOS_PAGO_VENTA.map((m) => (
                <button
                  key={m.id}
                  id={`medio-${m.id}`}
                  onClick={() => setMedio(m.id)}
                  className={`py-2.5 rounded-xl text-[13px] font-bold border ${medio === m.id ? 'bg-green-600 border-green-600 text-white' : 'border-slate-300 dark:border-slate-700'}`}
                >
                  {m.id === 'bancos' ? 'Transferencia' : m.label}
                </button>
              ))}
            </div>
            {medio === 'efectivo' && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-500">¿Con cuánto paga?</p>
                <div className="flex flex-wrap gap-1.5">
                  {sugeridos.map((v) => (
                    <button key={v} onClick={() => setRecibido(String(v))} className={`px-3 py-1.5 rounded-xl text-[13px] font-bold border tabular-nums ${entregado === v ? 'bg-amber-100 border-amber-400 text-amber-900' : 'border-slate-300 dark:border-slate-700'}`}>
                      {v === total ? 'Exacto' : formatCOP(v)}
                    </button>
                  ))}
                </div>
                <input id="cobro-recibido" inputMode="numeric" value={recibido} onChange={(e) => setRecibido(e.target.value)} placeholder="Otro valor recibido" className={claseCampo + ' text-right font-bold tabular-nums'} />
                {cambio > 0 && <p className="text-right text-lg font-black text-amber-700 tabular-nums">Cambio: {formatCOP(cambio)}</p>}
                {!!recibido && entregado < total && (
                  <p className="text-right text-[12px] font-semibold text-rose-600 tabular-nums">Faltan {formatCOP(total - entregado)}. Si paga una parte, use “Guardar” para dejar el resto a crédito.</p>
                )}
              </div>
            )}
          </>
        )}

        {/* Datos del cliente para el recibo con membrete */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700">
          <button id="cobro-ver-cliente" onClick={() => setVerCliente(!verCliente)} className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-bold">
            <span className="flex items-center gap-2">
              <UserRound className="w-4 h-4" /> Datos del cliente {aCredito ? '(obligatorio el nombre)' : '(para el recibo)'}
            </span>
            {verCliente ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {verCliente && (
            <div className="px-3 pb-3 grid gap-2">
              <input id="cobro-cliente" list="clientes-anteriores" value={cliente.nombre} onChange={(e) => alEscribirNombre(e.target.value)} placeholder="Nombre o razón social" className={claseCampo} />
              <datalist id="clientes-anteriores">
                {[...clientes.values()].slice(-60).map((v) => (
                  <option key={v.id} value={v.clienteNombre} />
                ))}
              </datalist>
              <div className="grid grid-cols-2 gap-2">
                <input id="cobro-documento" inputMode="numeric" value={cliente.documento} onChange={(e) => poner('documento', e.target.value)} placeholder="Cédula o NIT" className={claseCampo} />
                <input id="cobro-telefono" inputMode="tel" value={cliente.telefono} onChange={(e) => poner('telefono', e.target.value)} placeholder="Celular / WhatsApp" className={claseCampo} />
              </div>
              <input id="cobro-email" inputMode="email" type="email" value={cliente.email} onChange={(e) => poner('email', e.target.value)} placeholder="Correo electrónico" className={claseCampo} />
              <input id="cobro-referencia" value={cliente.referencia} onChange={(e) => poner('referencia', e.target.value)} placeholder={etiquetaReferencia()} className={claseCampo} />
              <input id="cobro-observaciones" value={cliente.observaciones} onChange={(e) => poner('observaciones', e.target.value)} placeholder="Observaciones (salen en el recibo)" className={claseCampo} />
            </div>
          )}
        </div>

        <button
          id="cobro-confirmar"
          disabled={guardando || (aCredito && !cliente.nombre.trim()) || (medio === 'efectivo' && !!recibido && entregado < total && !aCredito)}
          onClick={confirmar}
          className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-base font-black disabled:opacity-40 tabular-nums"
        >
          {aCredito ? `Guardar a crédito ${formatCOP(total)}` : `Cobrar ${formatCOP(total)}`}
        </button>
      </div>
    </Hoja>
  );
};
