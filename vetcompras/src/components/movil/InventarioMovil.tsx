import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, ClipboardCheck, PackageX, RotateCcw, Search, ShoppingCart, SlidersHorizontal, Truck } from 'lucide-react';
import type { MovimientoInventario, Producto } from '../../types';
import { dataService } from '../../services/dataService';
import { ajusteASaldo, calcularSaldos, efecto, type SaldoProducto } from '../../utils/inventario';
import { controlaInventario } from '../../utils/conceptos';
import { formatCOP } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';
import { Hoja } from './CajaMovil';
import { colorDe, iniciales } from './fotos';

const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const num = (v: number) => (Number.isInteger(v) ? String(v) : v.toLocaleString('es-CO', { maximumFractionDigits: 3 }));

const ESTADO: Record<SaldoProducto['estado'], { texto: string; clase: string }> = {
  negativo: { texto: 'Negativo', clase: 'bg-rose-600 text-white' },
  agotado: { texto: 'Agotado', clase: 'bg-rose-100 text-rose-800' },
  bajo: { texto: 'Bajo', clase: 'bg-amber-100 text-amber-900' },
  ok: { texto: '', clase: 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300' },
};

const MOTIVOS_BAJA = ['Producto vencido', 'Producto dañado', 'Pérdida o robo', 'Consumo interno', 'Muestra o regalo'];

/** Icono y texto del origen de un movimiento. */
function origenDe(m: MovimientoInventario): { icono: React.ReactNode; texto: string } {
  if (m.origen === 'compra') return { icono: <Truck className="w-4 h-4 text-green-600" />, texto: 'Compra' };
  if (m.origen === 'venta') return { icono: <ShoppingCart className="w-4 h-4 text-blue-600" />, texto: 'Venta' };
  if (m.tipo === 'baja') return { icono: <PackageX className="w-4 h-4 text-rose-600" />, texto: 'Baja' };
  if (m.origen === 'inicial' || m.origen === 'importacion') return { icono: <ClipboardCheck className="w-4 h-4 text-slate-600" />, texto: 'Saldo inicial' };
  return { icono: <SlidersHorizontal className="w-4 h-4 text-violet-600" />, texto: 'Ajuste' };
}

/**
 * Inventario del celular. Las compras suman y las ventas restan solas; aquí se
 * consulta el saldo de cada producto y se corrige con el submódulo de ajustes
 * (conteo físico, sumar, restar o dar de baja). Todo ajuste se puede deshacer.
 */
export const InventarioMovil: React.FC = () => {
  const { mostrarToast } = useToast();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [pestana, setPestana] = useState<'existencias' | 'ajustes' | 'movimientos'>('existencias');
  const [texto, setTexto] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'alerta'>('todos');
  const [ajustando, setAjustando] = useState<SaldoProducto | null>(null);
  const [deshacer, setDeshacer] = useState<MovimientoInventario | null>(null);
  // Solo Administración ajusta; Ventas y Compras consultan
  const soloConsulta = !dataService.puedeAjustarInventario();

  const cargar = useCallback(() => {
    Promise.all([dataService.obtenerProductos(), dataService.obtenerMovimientos()])
      .then(([p, m]) => {
        setProductos(p);
        setMovimientos(m);
      })
      .catch((e) => mostrarToast('error', 'Inventario', e?.message));
  }, [mostrarToast]);
  useEffect(cargar, [cargar]);

  const conInventario = useMemo(() => productos.filter((p) => p.activo !== false && controlaInventario(p)), [productos]);
  const saldos = useMemo(() => calcularSaldos(conInventario, movimientos).sort((a, b) => a.producto.nombre.localeCompare(b.producto.nombre, 'es')), [conInventario, movimientos]);
  const nombreDe = (id: string) => productos.find((p) => p.id === id)?.nombre || 'Producto eliminado';
  const fotoDe = (id: string) => productos.find((p) => p.id === id)?.foto;

  const unidades = saldos.reduce((s, x) => s + Math.max(0, x.saldo), 0);
  const valor = saldos.reduce((s, x) => s + x.valor, 0);
  const alertas = saldos.filter((x) => x.estado !== 'ok').length;
  const ajustesManuales = movimientos.filter((m) => m.origen === 'manual');

  const filtrar = (nombre: string) => !texto.trim() || nombre.toLowerCase().includes(texto.trim().toLowerCase());
  const listaExistencias = saldos.filter((x) => filtrar(x.producto.nombre) && (filtro === 'todos' || x.estado !== 'ok'));

  const quitarAjuste = async () => {
    if (!deshacer) return;
    try {
      await dataService.eliminarMovimiento(deshacer.id);
      mostrarToast('success', 'Ajuste deshecho', nombreDe(deshacer.productoId));
      setDeshacer(null);
      cargar();
    } catch (e: any) {
      mostrarToast('error', 'No se deshizo', e?.message);
    }
  };

  const Miniatura: React.FC<{ id: string; nombre: string }> = ({ id, nombre }) => {
    const foto = fotoDe(id);
    return (
      <span className="w-8 h-8 rounded-md overflow-hidden shrink-0 flex items-center justify-center text-white text-xs font-black" style={{ background: foto ? '#fff' : colorDe(nombre) }}>
        {foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : iniciales(nombre)}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Resumen */}
      <div className="shrink-0 grid grid-cols-3 gap-2 p-3 pb-2">
        <div className="rounded-xl bg-white dark:bg-slate-800 p-2 shadow-sm">
          <p className="text-[10px] font-semibold uppercase text-slate-500">Unidades</p>
          <p className="text-base font-black tabular-nums">{num(unidades)}</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-800 p-2 shadow-sm">
          <p className="text-[10px] font-semibold uppercase text-slate-500">Valor (costo)</p>
          <p className="text-base font-black tabular-nums text-blue-700 dark:text-blue-400">{formatCOP(valor)}</p>
        </div>
        <button onClick={() => (setPestana('existencias'), setFiltro(filtro === 'alerta' ? 'todos' : 'alerta'))} className={`rounded-xl p-2 shadow-sm text-left ${filtro === 'alerta' ? 'bg-amber-100' : 'bg-white dark:bg-slate-800'}`}>
          <p className="text-[10px] font-semibold uppercase text-slate-500">Por revisar</p>
          <p className={`text-base font-black tabular-nums ${alertas ? 'text-rose-600' : 'text-green-700'}`}>{alertas}</p>
        </button>
      </div>

      {/* Pestañas */}
      <div className="shrink-0 px-3 grid grid-cols-3 gap-1.5">
        {(
          [
            ['existencias', 'Existencias'],
            ['ajustes', `Ajustes (${ajustesManuales.length})`],
            ['movimientos', 'Movimientos'],
          ] as const
        ).map(([id, t]) => (
          <button key={id} id={`inv-pestana-${id}`} onClick={() => setPestana(id)} className={`py-2 rounded-xl text-[13px] font-bold ${pestana === id ? 'bg-red-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="shrink-0 px-3 pt-2">
        <div className="flex items-center gap-2 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <Search className="w-4 h-4 text-slate-400" />
          <input id="inv-buscar" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar producto" className="flex-1 py-2.5 bg-transparent focus:outline-none" />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5" style={{ paddingBottom: 'calc(1.5rem + var(--sa-bottom, 0px))' }}>
        {pestana === 'existencias' && (
          <>
            <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2 text-[12px] font-bold text-red-900 dark:text-red-200 text-center">
              Saldo = Compras − Ventas ± Ajustes
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" id="inv-tabla">
              <div className="grid grid-cols-[1fr_2.6rem_2.6rem_2.6rem_3rem] gap-1 px-2 py-1.5 bg-slate-100 dark:bg-slate-900 text-[10px] font-bold uppercase text-slate-500 sticky top-0">
                <span>Producto</span>
                <span className="text-right">Compr.</span>
                <span className="text-right">Vent.</span>
                <span className="text-right">Ajust.</span>
                <span className="text-right">Saldo</span>
              </div>
              {listaExistencias.map((x) => {
                const ajustes = x.ajustes - x.bajas;
                return (
                  <button
                    key={x.producto.id}
                    onClick={() => (soloConsulta ? (setTexto(x.producto.nombre), setPestana('movimientos')) : setAjustando(x))}
                    className="w-full grid grid-cols-[1fr_2.6rem_2.6rem_2.6rem_3rem] gap-1 items-center px-2 py-1.5 border-t border-slate-100 dark:border-slate-700 text-left"
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <Miniatura id={x.producto.id} nombre={x.producto.nombre} />
                      <span className="text-[11.5px] font-semibold leading-tight line-clamp-2">{x.producto.nombre}</span>
                    </span>
                    <span className="text-right text-[12px] tabular-nums text-green-700 dark:text-green-400">{num(x.entradas)}</span>
                    <span className="text-right text-[12px] tabular-nums text-rose-600">{num(x.salidas)}</span>
                    <span className="text-right text-[12px] tabular-nums text-slate-600 dark:text-slate-300">{ajustes ? (ajustes > 0 ? '+' : '') + num(ajustes) : '—'}</span>
                    <span className="text-right">
                      <span className={`inline-block min-w-[2.4rem] px-1 py-0.5 rounded-md text-[13px] font-black tabular-nums text-center ${ESTADO[x.estado].clase}`}>{num(x.saldo)}</span>
                    </span>
                  </button>
                );
              })}
              {listaExistencias.length > 0 && (
                <div className="grid grid-cols-[1fr_2.6rem_2.6rem_2.6rem_3rem] gap-1 px-2 py-2 border-t-2 border-slate-300 dark:border-slate-600 text-[12px] font-black tabular-nums">
                  <span>Total</span>
                  <span className="text-right text-green-700 dark:text-green-400">{num(listaExistencias.reduce((t, x) => t + x.entradas, 0))}</span>
                  <span className="text-right text-rose-600">{num(listaExistencias.reduce((t, x) => t + x.salidas, 0))}</span>
                  <span className="text-right">{num(listaExistencias.reduce((t, x) => t + x.ajustes - x.bajas, 0))}</span>
                  <span className="text-right">{num(listaExistencias.reduce((t, x) => t + x.saldo, 0))}</span>
                </div>
              )}
            </div>
            {!listaExistencias.length && (
              <p className="text-center text-sm text-slate-500 mt-6 px-4">
                {filtro === 'alerta' ? 'No hay productos agotados, negativos o bajos.' : 'Aún no hay productos con inventario. Se crean solos al registrar compras de mercancía con detalle.'}
              </p>
            )}
            <p className="text-center text-[11px] text-slate-500 pt-1">
              {soloConsulta ? 'Solo consulta. Toque un producto para ver sus movimientos. Los ajustes los hace el perfil Administración.' : 'Toque un producto para ajustar su inventario.'}
            </p>
          </>
        )}

        {pestana === 'ajustes' && (
          <>
            <p className="text-[12px] text-slate-500 pb-1">
              {soloConsulta
                ? 'Correcciones hechas por el administrador: conteos físicos, sumas, restas y bajas.'
                : 'Correcciones hechas a mano: conteos físicos, sumas, restas y bajas. Si alguno quedó mal, tóquelo para deshacerlo. Para un ajuste nuevo, vaya a Existencias y toque el producto.'}
            </p>
            {ajustesManuales.filter((m) => filtrar(nombreDe(m.productoId))).map((m) => {
              const e = efecto(m);
              return (
                <button key={m.id} onClick={() => !soloConsulta && setDeshacer(m)} className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-left">
                  <Miniatura id={m.productoId} nombre={nombreDe(m.productoId)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold truncate">{nombreDe(m.productoId)}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {m.fecha} · {m.tipo === 'baja' ? 'Baja' : 'Ajuste'}
                      {m.motivo ? ` · ${m.motivo}` : ''}
                    </p>
                  </div>
                  <span className={`text-base font-black tabular-nums ${e < 0 ? 'text-rose-600' : 'text-green-700'}`}>
                    {e > 0 ? '+' : ''}
                    {num(e)}
                  </span>
                </button>
              );
            })}
            {!ajustesManuales.length && <p className="text-center text-sm text-slate-500 mt-6">Todavía no hay ajustes.</p>}
          </>
        )}

        {pestana === 'movimientos' &&
          movimientos
            .filter((m) => filtrar(nombreDe(m.productoId)))
            .slice(0, 300)
            .map((m) => {
              const o = origenDe(m);
              const e = efecto(m);
              return (
                <div key={m.id} className="flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">{o.icono}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold truncate">{nombreDe(m.productoId)}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {m.fecha} · {o.texto}
                      {m.referencia ? ` · ${m.referencia}` : m.motivo ? ` · ${m.motivo}` : ''}
                    </p>
                  </div>
                  <span className={`text-sm font-black tabular-nums ${e < 0 ? 'text-rose-600' : 'text-green-700'}`}>
                    {e > 0 ? '+' : ''}
                    {num(e)}
                  </span>
                </div>
              );
            })}
      </div>

      {ajustando && (
        <HojaAjuste
          saldo={ajustando}
          onCerrar={() => setAjustando(null)}
          onGuardado={() => {
            setAjustando(null);
            cargar();
          }}
        />
      )}
      {deshacer && (
        <Hoja titulo="¿Deshacer este ajuste?" onCerrar={() => setDeshacer(null)}>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
            {nombreDe(deshacer.productoId)}: {efecto(deshacer) > 0 ? '+' : ''}
            {num(efecto(deshacer))} ({deshacer.motivo || deshacer.tipo}, {deshacer.fecha}). El saldo vuelve a como estaba antes de este ajuste.
          </p>
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <button onClick={() => setDeshacer(null)} className="py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold">
              Cancelar
            </button>
            <button id="ajuste-deshacer" onClick={quitarAjuste} className="py-3 rounded-xl bg-rose-600 text-white font-bold flex items-center justify-center gap-2">
              <RotateCcw className="w-4 h-4" /> Deshacer
            </button>
          </div>
        </Hoja>
      )}
    </div>
  );
};

const claseCampo = 'w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500';

/** Submódulo de ajustes de un producto: conteo físico, sumar, restar o dar de baja. */
const HojaAjuste: React.FC<{ saldo: SaldoProducto; onCerrar: () => void; onGuardado: () => void }> = ({ saldo, onCerrar, onGuardado }) => {
  const { mostrarToast } = useToast();
  const [tipo, setTipo] = useState<'conteo' | 'sumar' | 'restar' | 'baja'>('conteo');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const n = Number(String(cantidad).replace(',', '.')) || 0;
  const nuevoSaldo = tipo === 'conteo' ? n : tipo === 'sumar' ? saldo.saldo + n : saldo.saldo - n;
  const listo = tipo === 'conteo' ? cantidad.trim() !== '' && n >= 0 && nuevoSaldo !== saldo.saldo : n > 0;

  const guardar = async () => {
    const fecha = hoyLocal();
    const ahora = new Date().toISOString();
    const id = `mov-a-${saldo.producto.id}-${Date.now()}`;
    let mov: MovimientoInventario | null;
    if (tipo === 'conteo') mov = ajusteASaldo(saldo.producto.id, saldo.saldo, n, fecha, motivo.trim() || undefined);
    else if (tipo === 'baja') mov = { id, fecha, productoId: saldo.producto.id, tipo: 'baja', cantidad: n, origen: 'manual', motivo: motivo || 'Baja', creadoEn: ahora, actualizadoEn: ahora };
    else
      mov = {
        id,
        fecha,
        productoId: saldo.producto.id,
        tipo: 'ajuste',
        cantidad: tipo === 'sumar' ? n : -n,
        origen: 'manual',
        motivo: motivo.trim() || (tipo === 'sumar' ? 'Corrección: sumar unidades' : 'Corrección: restar unidades'),
        creadoEn: ahora,
        actualizadoEn: ahora,
      };
    if (!mov) return onCerrar();
    setGuardando(true);
    try {
      await dataService.guardarMovimiento(mov);
      mostrarToast('success', 'Inventario ajustado', `${saldo.producto.nombre}: queda en ${num(nuevoSaldo)}.`);
      onGuardado();
    } catch (e: any) {
      mostrarToast('error', 'No se guardó el ajuste', e?.message);
    } finally {
      setGuardando(false);
    }
  };

  const opciones = [
    { id: 'conteo', t: 'Conteo físico', i: <ClipboardCheck className="w-4 h-4" /> },
    { id: 'sumar', t: 'Sumar', i: <ArrowUpCircle className="w-4 h-4" /> },
    { id: 'restar', t: 'Restar', i: <ArrowDownCircle className="w-4 h-4" /> },
    { id: 'baja', t: 'Dar de baja', i: <PackageX className="w-4 h-4" /> },
  ] as const;

  return (
    <Hoja titulo={saldo.producto.nombre} onCerrar={onCerrar}>
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2">
          <span className="text-sm text-slate-600 dark:text-slate-300">Saldo en el sistema</span>
          <span className="text-2xl font-black tabular-nums">{num(saldo.saldo)}</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {opciones.map((o) => (
            <button key={o.id} id={`ajuste-${o.id}`} onClick={() => (setTipo(o.id), setMotivo(''))} className={`py-2 rounded-xl text-[11.5px] font-bold border flex flex-col items-center gap-0.5 ${tipo === o.id ? 'bg-red-600 border-red-600 text-white' : 'border-slate-300 dark:border-slate-700'}`}>
              {o.i}
              {o.t}
            </button>
          ))}
        </div>
        <label htmlFor="ajuste-cantidad" className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
          {tipo === 'conteo' ? '¿Cuántas unidades hay físicamente?' : tipo === 'baja' ? '¿Cuántas unidades se dan de baja?' : `¿Cuántas unidades ${tipo === 'sumar' ? 'sumar' : 'restar'}?`}
        </label>
        <input id="ajuste-cantidad" autoFocus inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="0" className={claseCampo + ' text-2xl font-black text-right tabular-nums'} />
        {tipo === 'baja' ? (
          <div className="flex flex-wrap gap-1.5">
            {MOTIVOS_BAJA.map((m) => (
              <button key={m} onClick={() => setMotivo(m)} className={`px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border ${motivo === m ? 'bg-rose-100 border-rose-400 text-rose-900' : 'border-slate-300 dark:border-slate-700'}`}>
                {m}
              </button>
            ))}
          </div>
        ) : (
          <input id="ajuste-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (ej. error al registrar la compra)" className={claseCampo} />
        )}
        {(cantidad.trim() !== '') && (
          <p className="text-sm font-semibold text-center tabular-nums">
            Quedará en <span className={nuevoSaldo < 0 ? 'text-rose-600' : 'text-green-700'}>{num(nuevoSaldo)}</span> unidades
            {tipo === 'conteo' && nuevoSaldo !== saldo.saldo && ` (${nuevoSaldo - saldo.saldo > 0 ? '+' : ''}${num(nuevoSaldo - saldo.saldo)})`}
          </p>
        )}
        <button id="ajuste-guardar" disabled={!listo || guardando || (tipo === 'baja' && !motivo)} onClick={guardar} className="w-full py-3.5 rounded-xl bg-red-600 text-white font-black disabled:opacity-40">
          Guardar ajuste
        </button>
      </div>
    </Hoja>
  );
};
