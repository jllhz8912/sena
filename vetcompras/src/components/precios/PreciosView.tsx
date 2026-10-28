import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Copy,
  Download,
  History,
  Loader2,
  PackageSearch,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Stethoscope,
  Package,
  Trash2,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { guardarExcel } from '../../services/descargaExcel';
import { CategoriaVenta, FichaPrecio, MovimientoInventario, Producto, VentaItem } from '../../types';
import { dataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { ModalConfirmacion } from '../common/ModalConfirmacion';
import { CATEGORIAS_VENTA, formatCOP, fechaLocal } from '../../utils/formatters';
import { PLANTILLA_COSTOS, calcularPrecio, rentabilidad } from '../../utils/precios';
import { calcularSaldos } from '../../utils/inventario';

const claseInput =
  'w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500';
const claseEtiqueta = 'block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1';
const claseTarjeta = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800';
const boton = 'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors';
const nuevoId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const pesosInput = (v: number) => (v ? Math.round(v).toLocaleString('es-CO') : '');
const leerPesos = (t: string) => Number(t.replace(/\D/g, '')) || 0;
const pct = (n: number) => `${n.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`;
const nombreCategoria = (id: string) => CATEGORIAS_VENTA.find((c) => c.id === id)?.label || id;

function fichaNueva(tipo: FichaPrecio['tipo'], ivaPorDefecto: number): FichaPrecio {
  const ahora = new Date().toISOString();
  return {
    id: nuevoId('ficha'),
    tipo,
    nombre: '',
    categoriaVenta: (tipo === 'servicio' ? 'consultas_clinica' : 'vitrina') as CategoriaVenta,
    unidad: tipo === 'servicio' ? 'SERVICIO' : 'UND',
    costos: PLANTILLA_COSTOS[tipo].map((c) => ({ id: nuevoId('cst'), concepto: c.concepto, cantidad: c.cantidad, valorUnitario: 0 })),
    gastosGeneralesPct: 10,
    metodo: 'margen',
    porcentajeObjetivo: tipo === 'servicio' ? 50 : 30,
    comisionPct: 0,
    ivaPct: ivaPorDefecto,
    redondeo: 100,
    precioVenta: 0,
    historial: [],
    activo: true,
    creadoEn: ahora,
    actualizadoEn: ahora,
  };
}

/** Línea "Costo de compra" de la ficha (la que se actualiza desde el inventario). */
const lineaCompra = (f: FichaPrecio) => f.costos.find((c) => /costo de compra/i.test(c.concepto)) || (f.tipo === 'producto' ? f.costos[0] : undefined);

// --------------------------------------------------------------- editor

const EditorFicha: React.FC<{
  inicial: FichaPrecio;
  productos: Producto[];
  costosInventario: Map<string, number>;
  onCerrar: () => void;
  onGuardado: () => void;
  onFacturar: (items: VentaItem[]) => void;
}> = ({ inicial, productos, costosInventario, onCerrar, onGuardado, onFacturar }) => {
  const { mostrarToast } = useToast();
  const [f, setF] = useState<FichaPrecio>(() => JSON.parse(JSON.stringify(inicial)));
  const [actualizarInventario, setActualizarInventario] = useState(true);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  const calc = useMemo(() => calcularPrecio(f), [f]);
  const rent = useMemo(() => rentabilidad(f.precioVenta, calc.costoTotal, f.ivaPct, f.comisionPct), [f.precioVenta, calc.costoTotal, f.ivaPct, f.comisionPct]);
  const producto = productos.find((p) => p.id === f.productoId);
  const costoInv = f.productoId ? costosInventario.get(f.productoId) : undefined;
  const objetivo = f.metodo === 'margen' ? rent.margen : rent.markup;
  const estado = !f.precioVenta ? 'sin' : rent.ganancia < 0 ? 'perdida' : objetivo + 0.05 < f.porcentajeObjetivo ? 'bajo' : 'ok';

  const cambiarCosto = (id: string, cambios: Partial<FichaPrecio['costos'][number]>) =>
    setF((x) => ({ ...x, costos: x.costos.map((c) => (c.id === id ? { ...c, ...cambios } : c)) }));

  const elegirProducto = (id: string) => {
    const p = productos.find((x) => x.id === id);
    setF((x) => {
      const sig = { ...x, productoId: id || undefined };
      if (p) {
        if (!x.nombre.trim()) sig.nombre = p.nombre;
        sig.unidad = p.unidad || x.unidad;
        if (!x.precioVenta && p.precioVenta) sig.precioVenta = p.precioVenta;
        const costo = costosInventario.get(p.id) || p.costoUltimo || 0;
        const linea = lineaCompra(sig);
        if (linea && costo) sig.costos = sig.costos.map((c) => (c.id === linea.id ? { ...c, valorUnitario: costo } : c));
      }
      return sig;
    });
  };

  const traerCostoInventario = () => {
    const linea = lineaCompra(f);
    if (!costoInv || !linea) return;
    cambiarCosto(linea.id, { valorUnitario: costoInv });
    mostrarToast('info', 'Costo actualizado', `Costo de compra: ${formatCOP(costoInv)} (promedio del inventario).`);
  };

  const guardar = async (facturar: boolean) => {
    if (!f.nombre.trim()) return mostrarToast('warning', 'Falta el nombre', 'Escriba el nombre del producto o servicio.');
    if (!f.precioVenta) return mostrarToast('warning', 'Falta el precio', 'Escriba el precio de venta o use el sugerido.');
    setGuardando(true);
    try {
      const ultimo = f.historial[f.historial.length - 1];
      const cambio = !ultimo || ultimo.precioVenta !== f.precioVenta || Math.abs(ultimo.costoTotal - calc.costoTotal) >= 1;
      const ficha: FichaPrecio = {
        ...f,
        nombre: f.nombre.trim(),
        historial: cambio
          ? [...f.historial, { fecha: new Date().toISOString(), precioVenta: f.precioVenta, costoTotal: calc.costoTotal, margen: rent.margen, nota: nota.trim() || undefined }]
          : f.historial,
      };
      await dataService.guardarFichaPrecio(ficha);
      if (producto && actualizarInventario && producto.precioVenta !== f.precioVenta) {
        await dataService.guardarProducto({ ...producto, precioVenta: f.precioVenta });
      }
      mostrarToast('success', 'Precio guardado', `${ficha.nombre}: ${formatCOP(ficha.precioVenta)} · margen ${pct(rent.margen)}`);
      onGuardado();
      onCerrar();
      if (facturar) onFacturar([itemDeFicha(ficha)]);
    } catch (e: any) {
      mostrarToast('error', 'No se pudo guardar', e?.message);
    } finally {
      setGuardando(false);
    }
  };

  const colorEstado = { sin: 'text-slate-500', perdida: 'text-rose-600', bajo: 'text-amber-600', ok: 'text-emerald-700 dark:text-emerald-400' }[estado];

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/60 flex items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-6xl max-h-[calc(100dvh-1rem)] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800">
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-600" /> {inicial.nombre ? `Precio de: ${inicial.nombre}` : `Nueva ficha de ${f.tipo === 'servicio' ? 'servicio' : 'producto'}`}
          </h3>
          <button onClick={onCerrar} className="text-slate-400 hover:text-slate-600" title="Cerrar sin guardar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-5 p-5">
          <div className="space-y-5">
            {/* 1. Qué se vende */}
            <section className="space-y-3">
              <h4 className="text-sm font-bold">1. Producto o servicio</h4>
              <div className="flex gap-2">
                {(['producto', 'servicio'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setF({ ...f, tipo: t })}
                    className={`${boton} ${f.tipo === t ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-300 dark:border-slate-700'}`}
                  >
                    {t === 'producto' ? <Package className="w-4 h-4" /> : <Stethoscope className="w-4 h-4" />} {t === 'producto' ? 'Producto' : 'Servicio'}
                  </button>
                ))}
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="sm:col-span-2">
                  <span className={claseEtiqueta}>Nombre (así aparece en la venta y el recibo) *</span>
                  <input id="ficha-nombre" autoFocus value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} className={claseInput} placeholder={f.tipo === 'servicio' ? 'Ej. Consulta general, Baño perro mediano' : 'Ej. Nexgard 10-25 kg'} />
                </label>
                <label>
                  <span className={claseEtiqueta}>Categoría en ventas</span>
                  <select value={f.categoriaVenta} onChange={(e) => setF({ ...f, categoriaVenta: e.target.value as CategoriaVenta })} className={claseInput}>
                    {CATEGORIAS_VENTA.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={claseEtiqueta}>Unidad</span>
                  <input value={f.unidad} onChange={(e) => setF({ ...f, unidad: e.target.value.toUpperCase() })} className={claseInput} />
                </label>
                {f.tipo === 'producto' && (
                  <label className="sm:col-span-2">
                    <span className={claseEtiqueta}>Producto del inventario (trae su costo y actualiza su precio)</span>
                    <select id="ficha-producto" value={f.productoId || ''} onChange={(e) => elegirProducto(e.target.value)} className={claseInput}>
                      <option value="">— Sin vincular —</option>
                      {productos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                          {costosInventario.get(p.id) ? ` · costo ${formatCOP(costosInventario.get(p.id)!)}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </section>

            {/* 2. Costos */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-bold">2. Costos asociados (por {f.unidad.toLowerCase() || 'unidad'})</h4>
                <div className="flex gap-2">
                  {costoInv ? (
                    <button type="button" onClick={traerCostoInventario} className={`${boton} border-emerald-600 text-emerald-700 dark:text-emerald-300`} title="Usar el costo promedio de las compras registradas">
                      <RefreshCw className="w-3.5 h-3.5" /> Traer costo del inventario ({formatCOP(costoInv)})
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setF({ ...f, costos: [...f.costos, { id: nuevoId('cst'), concepto: '', cantidad: 1, valorUnitario: 0 }] })}
                    className={`${boton} border-slate-300 dark:border-slate-700`}
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar costo
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead className="text-[11px] uppercase text-slate-500">
                    <tr>
                      <th className="text-left pb-1">Concepto</th>
                      <th className="text-right pb-1 w-24">Cantidad</th>
                      <th className="text-right pb-1 w-36">Valor unitario</th>
                      <th className="text-right pb-1 w-32">Total</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {f.costos.map((c) => (
                      <tr key={c.id}>
                        <td className="pr-2 py-1">
                          <input value={c.concepto} onChange={(e) => cambiarCosto(c.id, { concepto: e.target.value })} className={claseInput} placeholder="Ej. Vacuna, jeringa, mano de obra" aria-label="Concepto del costo" />
                        </td>
                        <td className="px-1">
                          <input type="number" step="any" min={0} value={c.cantidad} onChange={(e) => cambiarCosto(c.id, { cantidad: Number(e.target.value) })} className={claseInput + ' text-right'} aria-label="Cantidad" />
                        </td>
                        <td className="px-1">
                          <input inputMode="numeric" value={pesosInput(c.valorUnitario)} onChange={(e) => cambiarCosto(c.id, { valorUnitario: leerPesos(e.target.value) })} className={claseInput + ' text-right'} placeholder="0" aria-label="Valor unitario" />
                        </td>
                        <td className="text-right font-semibold whitespace-nowrap px-1">{formatCOP((c.cantidad || 0) * (c.valorUnitario || 0))}</td>
                        <td>
                          <button type="button" onClick={() => setF({ ...f, costos: f.costos.filter((x) => x.id !== c.id) })} className="p-1.5 text-slate-400 hover:text-rose-600" title="Quitar costo">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-500">
                Consejo: para la mano de obra ponga los minutos en "Cantidad" y el valor de un minuto en "Valor unitario" (ej. sueldo mensual ÷ 9.600 minutos).
              </p>
              <label className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-slate-600 dark:text-slate-300 text-xs">Gastos generales (arriendo, servicios, administración):</span>
                <input type="number" step="any" min={0} value={f.gastosGeneralesPct} onChange={(e) => setF({ ...f, gastosGeneralesPct: Number(e.target.value) })} className="w-24 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-right" aria-label="Gastos generales %" />
                <span className="text-xs">% del costo directo = {formatCOP(calc.gastosGenerales)}</span>
              </label>
            </section>

            {/* 3. Rentabilidad deseada */}
            <section className="space-y-3">
              <h4 className="text-sm font-bold">3. Ganancia deseada, comisiones e impuestos</h4>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <label>
                  <span className={claseEtiqueta}>Cómo calcular la ganancia</span>
                  <select value={f.metodo} onChange={(e) => setF({ ...f, metodo: e.target.value as FichaPrecio['metodo'] })} className={claseInput}>
                    <option value="margen">% de ganancia sobre el precio (margen)</option>
                    <option value="markup">% sobre el costo (incremento)</option>
                  </select>
                </label>
                <label>
                  <span className={claseEtiqueta}>% de ganancia deseado</span>
                  <input id="ficha-objetivo" type="number" step="any" min={0} value={f.porcentajeObjetivo} onChange={(e) => setF({ ...f, porcentajeObjetivo: Number(e.target.value) })} className={claseInput} />
                </label>
                <label>
                  <span className={claseEtiqueta}>Comisión datáfono / plataforma (%)</span>
                  <input type="number" step="any" min={0} value={f.comisionPct} onChange={(e) => setF({ ...f, comisionPct: Number(e.target.value) })} className={claseInput} />
                </label>
                <label>
                  <span className={claseEtiqueta}>IVA que se cobra</span>
                  <select value={f.ivaPct} onChange={(e) => setF({ ...f, ivaPct: Number(e.target.value) })} className={claseInput}>
                    <option value={0}>No se cobra IVA (0 % / no responsable)</option>
                    <option value={5}>5 %</option>
                    <option value={19}>19 %</option>
                  </select>
                </label>
                <label>
                  <span className={claseEtiqueta}>Redondear el sugerido a</span>
                  <select value={f.redondeo} onChange={(e) => setF({ ...f, redondeo: Number(e.target.value) })} className={claseInput}>
                    {[0, 50, 100, 500, 1000, 5000].map((r) => (
                      <option key={r} value={r}>
                        {r ? `Múltiplos de ${formatCOP(r)}` : 'Sin redondeo'}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <label className="block">
              <span className={claseEtiqueta}>Notas (proveedor, presentación, por qué cambió el precio…)</span>
              <input value={f.notas || ''} onChange={(e) => setF({ ...f, notas: e.target.value })} className={claseInput} />
            </label>

            {f.historial.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-600" /> Historial de precios
                </h4>
                <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                      <tr>
                        <th className="text-left p-2">Fecha</th>
                        <th className="text-right p-2">Precio</th>
                        <th className="text-right p-2">Costo</th>
                        <th className="text-right p-2">Margen</th>
                        <th className="text-left p-2">Nota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...f.historial].reverse().map((h, i) => (
                        <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="p-2">{new Date(h.fecha).toLocaleDateString('es-CO')}</td>
                          <td className="p-2 text-right font-semibold">{formatCOP(h.precioVenta)}</td>
                          <td className="p-2 text-right">{formatCOP(h.costoTotal)}</td>
                          <td className="p-2 text-right">{pct(h.margen)}</td>
                          <td className="p-2">{h.nota || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>

          {/* Resultado */}
          <aside className="space-y-3 lg:sticky lg:top-16 self-start">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span>Costo directo</span><span>{formatCOP(calc.costoDirecto)}</span></div>
              <div className="flex justify-between"><span>Gastos generales</span><span>{formatCOP(calc.gastosGenerales)}</span></div>
              <div className="flex justify-between font-bold border-t border-slate-100 dark:border-slate-800 pt-1.5"><span>Costo total</span><span id="ficha-costo-total">{formatCOP(calc.costoTotal)}</span></div>
            </div>

            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-4 space-y-2">
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Precio sugerido{f.ivaPct ? ' (con IVA)' : ''}</p>
              {calc.imposible ? (
                <p className="text-sm text-rose-700">El % de ganancia más la comisión llegan al 100 %: no existe un precio que lo cumpla. Baje el %.</p>
              ) : (
                <>
                  <p id="ficha-sugerido" className="text-3xl font-black text-emerald-800 dark:text-emerald-300">{formatCOP(calc.precioSugerido)}</p>
                  <button
                    type="button"
                    onClick={() => setF({ ...f, precioVenta: calc.precioSugerido })}
                    disabled={!calc.precioSugerido}
                    className={`${boton} w-full justify-center bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 disabled:opacity-50`}
                  >
                    <CheckCircle2 className="w-4 h-4" /> Usar el precio sugerido
                  </button>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
              <label className="block">
                <span className={claseEtiqueta}>Precio de venta {f.ivaPct ? '(con IVA)' : ''} — puede escribir el suyo</span>
                <input id="ficha-precio" inputMode="numeric" value={pesosInput(f.precioVenta)} onChange={(e) => setF({ ...f, precioVenta: leerPesos(e.target.value) })} className={claseInput + ' text-xl font-black'} placeholder="0" />
              </label>
              {f.precioVenta > 0 && (
                <div className="text-sm space-y-1">
                  {f.ivaPct > 0 && <div className="flex justify-between"><span>Precio sin IVA</span><span>{formatCOP(rent.precioSinIva)}</span></div>}
                  {f.ivaPct > 0 && <div className="flex justify-between text-slate-500"><span>IVA ({f.ivaPct} %)</span><span>{formatCOP(rent.iva)}</span></div>}
                  {f.comisionPct > 0 && <div className="flex justify-between text-slate-500"><span>Comisión ({f.comisionPct} %)</span><span>− {formatCOP(rent.comision)}</span></div>}
                  <div className="flex justify-between text-slate-500"><span>Costo total</span><span>− {formatCOP(calc.costoTotal)}</span></div>
                  <div className={`flex justify-between font-black text-base border-t border-slate-100 dark:border-slate-800 pt-1 ${colorEstado}`}>
                    <span>Ganancia por {f.unidad.toLowerCase() || 'unidad'}</span>
                    <span id="ficha-ganancia">{formatCOP(rent.ganancia)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-2 text-center">
                      <p className="text-[10px] uppercase text-slate-500">Margen sobre venta</p>
                      <p id="ficha-margen" className={`text-lg font-black ${colorEstado}`}>{pct(rent.margen)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-2 text-center">
                      <p className="text-[10px] uppercase text-slate-500">Sobre el costo</p>
                      <p className={`text-lg font-black ${colorEstado}`}>{pct(rent.markup)}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">Precio mínimo para no perder: <strong>{formatCOP(rent.puntoEquilibrio)}</strong></p>
                  {estado === 'perdida' && <p className="text-xs text-rose-700 flex gap-1"><AlertTriangle className="w-4 h-4 shrink-0" /> A este precio se pierde dinero.</p>}
                  {estado === 'bajo' && <p className="text-xs text-amber-700 flex gap-1"><AlertTriangle className="w-4 h-4 shrink-0" /> La ganancia está por debajo del {f.porcentajeObjetivo} % deseado.</p>}
                </div>
              )}
            </div>

            <label className="block">
              <span className={claseEtiqueta}>Motivo del cambio (queda en el historial)</span>
              <input value={nota} onChange={(e) => setNota(e.target.value)} className={claseInput} placeholder="Ej. subió el costo del proveedor" />
            </label>
            {producto && (
              <label className="flex items-start gap-2 text-xs">
                <input type="checkbox" checked={actualizarInventario} onChange={(e) => setActualizarInventario(e.target.checked)} className="mt-0.5" />
                Actualizar también el precio de venta de “{producto.nombre}” en el inventario
              </label>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => guardar(false)} disabled={guardando} className={`${boton} justify-center border-emerald-600 text-emerald-700 dark:text-emerald-300`}>
                {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Guardar precio
              </button>
              <button type="button" onClick={() => guardar(true)} disabled={guardando} className={`${boton} justify-center bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600`}>
                <Receipt className="w-4 h-4" /> Guardar y facturar
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

/** Ítem de venta listo para el facturador. */
function itemDeFicha(f: FichaPrecio): VentaItem {
  return {
    id: nuevoId('itm'),
    categoria: f.categoriaVenta,
    concepto: f.nombre,
    cantidad: 1,
    precioUnitario: f.precioVenta,
    subtotal: f.precioVenta,
    productoId: f.productoId,
  };
}

// ------------------------------------------------------------------ vista

export const PreciosView: React.FC<{ onFacturar: (items: VentaItem[]) => void }> = ({ onFacturar }) => {
  const { mostrarToast } = useToast();
  const [fichas, setFichas] = useState<FichaPrecio[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState<'' | FichaPrecio['tipo']>('');
  const [editando, setEditando] = useState<FichaPrecio | null>(null);
  const [aEliminar, setAEliminar] = useState<FichaPrecio | null>(null);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [ivaPorDefecto, setIvaPorDefecto] = useState(0);

  const cargar = useCallback(async () => {
    const [f, p, m] = await Promise.all([dataService.obtenerFichasPrecio(), dataService.obtenerProductos(), dataService.obtenerMovimientos()]);
    setFichas(f);
    setProductos(p);
    setMovimientos(m);
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
    setIvaPorDefecto(dataService.obtenerDatosEmpresa().responsableIva ? 19 : 0);
    return dataService.suscribirCambiosEnVivo(cargar);
  }, [cargar]);

  // Costo de cada producto del inventario: promedio de compras, o el último costo registrado
  const costosInventario = useMemo(
    () => new Map(calcularSaldos(productos, movimientos).filter((s) => s.costoPromedio).map((s) => [s.producto.id, s.costoPromedio])),
    [productos, movimientos]
  );

  // Productos del inventario con precio de venta (de la plantilla de compras o editado allí) que
  // aún no tienen ficha: se muestran con su margen sobre el costo de compra; al editarlos se guarda la ficha
  const fichasInventario = useMemo(() => {
    const ahora = new Date().toISOString();
    return productos
      .filter((p) => p.activo !== false && (p.precioVenta || 0) > 0 && !fichas.some((f) => f.productoId === p.id))
      .map<FichaPrecio>((p) => ({
        id: `ficha-${p.id}`,
        tipo: 'producto',
        nombre: p.nombre,
        categoriaVenta: 'vitrina' as CategoriaVenta,
        productoId: p.id,
        unidad: p.unidad || 'UND',
        costos: [{ id: 'cst-compra', concepto: 'Costo de compra (sin IVA)', cantidad: 1, valorUnitario: costosInventario.get(p.id) || p.costoUltimo || 0 }],
        gastosGeneralesPct: 0,
        metodo: 'margen',
        porcentajeObjetivo: 30,
        comisionPct: 0,
        ivaPct: ivaPorDefecto,
        redondeo: 100,
        precioVenta: p.precioVenta || 0,
        historial: [],
        activo: true,
        creadoEn: ahora,
        actualizadoEn: ahora,
      }));
  }, [productos, fichas, costosInventario, ivaPorDefecto]);
  const idsInventario = useMemo(() => new Set(fichasInventario.map((f) => f.id)), [fichasInventario]);

  const filas = useMemo(
    () =>
      [...fichas, ...fichasInventario]
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        .filter((f) => !tipo || f.tipo === tipo)
        .filter((f) => !texto.trim() || `${f.nombre} ${nombreCategoria(f.categoriaVenta)}`.toLowerCase().includes(texto.trim().toLowerCase()))
        .map((f) => {
          const calc = calcularPrecio(f);
          const rent = rentabilidad(f.precioVenta, calc.costoTotal, f.ivaPct, f.comisionPct);
          const linea = lineaCompra(f);
          const costoInv = f.productoId ? costosInventario.get(f.productoId) : undefined;
          const costoDesactualizado = !!(costoInv && linea && Math.abs(costoInv - linea.valorUnitario) >= 1);
          return { f, calc, rent, costoDesactualizado, costoInv };
        }),
    [fichas, fichasInventario, tipo, texto, costosInventario]
  );

  const crearDesdeInventario = () => {
    const sinFicha = productos.filter((p) => !fichas.some((f) => f.productoId === p.id) && !p.precioVenta);
    if (!sinFicha.length) return mostrarToast('info', 'Inventario', 'Todos los productos del inventario ya tienen ficha de precio.');
    const ficha = fichaNueva('producto', ivaPorDefecto);
    const p = sinFicha[0];
    ficha.productoId = p.id;
    ficha.nombre = p.nombre;
    ficha.unidad = p.unidad;
    ficha.precioVenta = p.precioVenta || 0;
    ficha.costos[0].valorUnitario = costosInventario.get(p.id) || p.costoUltimo || 0;
    setEditando(ficha);
  };

  const duplicar = (f: FichaPrecio) => {
    const ahora = new Date().toISOString();
    setEditando({ ...JSON.parse(JSON.stringify(f)), id: nuevoId('ficha'), nombre: `${f.nombre} (copia)`, productoId: undefined, historial: [], creadoEn: ahora, actualizadoEn: ahora });
  };

  const facturarSeleccion = () => {
    const items = [...fichas, ...fichasInventario].filter((f) => seleccion.includes(f.id) && f.precioVenta > 0).map(itemDeFicha);
    if (!items.length) return mostrarToast('warning', 'Seleccione', 'Marque los productos o servicios a facturar.');
    onFacturar(items);
    setSeleccion([]);
  };

  const exportar = () => {
    const datos = [
      ['Tipo', 'Nombre', 'Categoría', 'Unidad', 'Costo directo', 'Gastos generales', 'Costo total', '% deseado', 'Método', 'Comisión %', 'IVA %', 'Precio sugerido', 'Precio de venta', 'Ganancia', 'Margen %', 'Sobre costo %', 'Actualizado'],
      ...filas.map(({ f, calc, rent }) => [
        f.tipo, f.nombre, nombreCategoria(f.categoriaVenta), f.unidad, calc.costoDirecto, calc.gastosGenerales, calc.costoTotal, f.porcentajeObjetivo,
        f.metodo === 'margen' ? 'Sobre precio' : 'Sobre costo', f.comisionPct, f.ivaPct, calc.precioSugerido, f.precioVenta, rent.ganancia, rent.margen, rent.markup, f.actualizadoEn.slice(0, 10),
      ]),
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(datos);
    ws['!cols'] = datos[0].map((_, i) => ({ wch: i === 1 ? 34 : 13 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Precios de venta');
    guardarExcel(wb, `VetCompras_Precios_${fechaLocal()}.xlsx`);
  };

  if (cargando) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const conPerdida = filas.filter((x) => x.f.precioVenta && x.rent.ganancia < 0).length;
  const desactualizados = filas.filter((x) => x.costoDesactualizado).length;
  const margenPromedio = filas.filter((x) => x.f.precioVenta).reduce((a, x, _, arr) => a + x.rent.margen / arr.length, 0);

  return (
    <div className="space-y-5">
      <div className={`${claseTarjeta} p-5 space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <Calculator className="w-5 h-5 text-emerald-600" /> Cálculo de precios de venta
            </h2>
            <p className="text-xs text-slate-500 max-w-2xl">
              Para cada producto o servicio registre sus costos y la ganancia que quiere obtener: el sistema sugiere el precio y muestra la rentabilidad del precio que usted
              decida. Todo se puede cambiar cuando cambien los costos; cada precio queda en el historial. Con “Facturar” pasa directo a la venta.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setEditando(fichaNueva('servicio', ivaPorDefecto))} className={`${boton} bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600`}>
              <Stethoscope className="w-4 h-4" /> Nuevo servicio
            </button>
            <button onClick={() => setEditando(fichaNueva('producto', ivaPorDefecto))} className={`${boton} border-emerald-600 text-emerald-700 dark:text-emerald-300`}>
              <Package className="w-4 h-4" /> Nuevo producto
            </button>
            <button onClick={crearDesdeInventario} className={`${boton} border-slate-300 dark:border-slate-700`} title="Crea la ficha del siguiente producto del inventario que aún no tiene precio calculado">
              <PackageSearch className="w-4 h-4" /> Desde el inventario
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { t: 'Productos y servicios con precio', v: String(fichas.length + fichasInventario.length), c: 'text-slate-900 dark:text-white' },
            { t: 'Margen promedio', v: pct(margenPromedio), c: 'text-emerald-700 dark:text-emerald-400' },
            { t: 'Precios con pérdida', v: String(conPerdida), c: conPerdida ? 'text-rose-600' : 'text-slate-400' },
            { t: 'Costo cambió en inventario', v: String(desactualizados), c: desactualizados ? 'text-amber-600' : 'text-slate-400' },
          ].map((k) => (
            <div key={k.t} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{k.t}</p>
              <p className={`text-lg font-black ${k.c}`}>{k.v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar producto o servicio…" className={claseInput + ' pl-9'} />
        </div>
        <select value={tipo} onChange={(e) => setTipo(e.target.value as any)} className={claseInput + ' max-w-[170px]'}>
          <option value="">Productos y servicios</option>
          <option value="producto">Solo productos</option>
          <option value="servicio">Solo servicios</option>
        </select>
        {seleccion.length > 0 && (
          <button onClick={facturarSeleccion} className={`${boton} bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600`}>
            <Receipt className="w-4 h-4" /> Facturar {seleccion.length} seleccionado(s)
          </button>
        )}
        <button onClick={exportar} className={`${boton} border-slate-300 dark:border-slate-700`}>
          <Download className="w-4 h-4" /> Exportar Excel
        </button>
      </div>

      <div className={`${claseTarjeta} overflow-x-auto`}>
        {filas.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500 space-y-2">
            <Calculator className="w-10 h-10 mx-auto text-slate-300" />
            <p>{fichas.length ? 'No hay fichas con ese filtro.' : 'Aún no hay precios calculados. Cree un servicio o un producto para empezar.'}</p>
          </div>
        ) : (
          <table className="w-full text-sm min-w-[980px]">
            <thead className="text-[11px] uppercase tracking-wide text-slate-500 bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="w-8 py-2.5 px-3" />
                <th className="text-left px-2">Producto / servicio</th>
                <th className="text-right px-2">Costo total</th>
                <th className="text-right px-2">Sugerido</th>
                <th className="text-right px-2">Precio de venta</th>
                <th className="text-right px-2">Ganancia</th>
                <th className="text-right px-2">Margen</th>
                <th className="text-right px-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filas.map(({ f, calc, rent, costoDesactualizado, costoInv }) => {
                const color = !f.precioVenta ? 'text-slate-400' : rent.ganancia < 0 ? 'text-rose-600' : (f.metodo === 'margen' ? rent.margen : rent.markup) + 0.05 < f.porcentajeObjetivo ? 'text-amber-600' : 'text-emerald-700 dark:text-emerald-400';
                return (
                  <tr key={f.id}>
                    <td className="px-3">
                      <input
                        type="checkbox"
                        checked={seleccion.includes(f.id)}
                        onChange={(e) => setSeleccion(e.target.checked ? [...seleccion, f.id] : seleccion.filter((x) => x !== f.id))}
                        aria-label={`Seleccionar ${f.nombre}`}
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <button onClick={() => setEditando(f)} className="font-semibold text-left hover:text-emerald-700">
                        {f.nombre}
                      </button>
                      <p className="text-[11px] text-slate-500">
                        {f.tipo === 'servicio' ? 'Servicio' : 'Producto'} · {nombreCategoria(f.categoriaVenta)}
                        {f.historial.length > 1 ? ` · ${f.historial.length} cambios de precio` : ''}
                      </p>
                      {idsInventario.has(f.id) && (
                        <p className="text-[11px] text-teal-700 dark:text-teal-400">Precio tomado del inventario · margen sobre el costo de compra. Ábralo para agregar costos o cambiar el precio.</p>
                      )}
                      {costoDesactualizado && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> El costo en inventario ahora es {formatCOP(costoInv!)}: revise el precio
                        </p>
                      )}
                    </td>
                    <td className="text-right px-2 whitespace-nowrap">{formatCOP(calc.costoTotal)}</td>
                    <td className="text-right px-2 whitespace-nowrap text-slate-500">{calc.imposible ? '—' : formatCOP(calc.precioSugerido)}</td>
                    <td className="text-right px-2 whitespace-nowrap font-black">{f.precioVenta ? formatCOP(f.precioVenta) : '—'}</td>
                    <td className={`text-right px-2 whitespace-nowrap font-semibold ${color}`}>{f.precioVenta ? formatCOP(rent.ganancia) : '—'}</td>
                    <td className={`text-right px-2 whitespace-nowrap font-black ${color}`}>{f.precioVenta ? pct(rent.margen) : '—'}</td>
                    <td className="px-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => onFacturar([itemDeFicha(f)])} disabled={!f.precioVenta} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40" title="Pasar a la venta (POS)">
                          <Receipt className="w-3.5 h-3.5" /> Facturar
                        </button>
                        <button onClick={() => setEditando(f)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" title="Editar costos y precio">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => duplicar(f)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" title="Duplicar (por ejemplo, para otra presentación)">
                          <Copy className="w-4 h-4" />
                        </button>
                        <button onClick={() => setAEliminar(f)} disabled={idsInventario.has(f.id)} className="disabled:opacity-30 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600" title="Eliminar ficha">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editando && (
        <EditorFicha
          inicial={editando}
          productos={productos}
          costosInventario={costosInventario}
          onCerrar={() => setEditando(null)}
          onGuardado={cargar}
          onFacturar={onFacturar}
        />
      )}
      <ModalConfirmacion
        abierto={!!aEliminar}
        titulo="¿Eliminar la ficha de precio?"
        mensaje={`Se elimina la ficha de "${aEliminar?.nombre}" y su historial. Las ventas ya hechas y el inventario no cambian.`}
        textoConfirmar="Sí, eliminar"
        tipo="peligro"
        enConfirmar={async () => {
          if (aEliminar) await dataService.eliminarFichaPrecio(aEliminar.id);
          setAEliminar(null);
          cargar();
        }}
        enCancelar={() => setAEliminar(null)}
      />
    </div>
  );
};
