import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Package, Search, Star, Stethoscope, X } from 'lucide-react';
import { CATEGORIAS_VENTA, formatCOP } from '../../utils/formatters';
import { EntradaCatalogo, TipoCatalogo, buscarEnCatalogo, separarCantidad } from '../../utils/catalogoVenta';

interface BuscadorVentaProps {
  catalogo: EntradaCatalogo[];
  onElegir: (entrada: EntradaCatalogo, cantidad: number) => void;
}

const chip = 'px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap transition-colors';

/**
 * Buscador para facturar rápido: palabras sueltas, código, otros nombres, grupo o
 * categoría; filtros por categoría, tipo y más vendidos; teclado (↑ ↓ Enter Esc)
 * y cantidad rápida escribiendo "3*nexgard".
 */
export const BuscadorVenta: React.FC<BuscadorVentaProps> = ({ catalogo, onElegir }) => {
  const [texto, setTexto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [tipo, setTipo] = useState<'' | TipoCatalogo>('');
  const [frecuentes, setFrecuentes] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const entrada = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const contenedor = useRef<HTMLDivElement>(null);

  const { cantidad, texto: consulta } = separarCantidad(texto);
  const resultados = useMemo(
    () => buscarEnCatalogo(catalogo, { texto: consulta, categoria: categoria || undefined, tipo: tipo || undefined, soloFrecuentes: frecuentes }, 40),
    [catalogo, consulta, categoria, tipo, frecuentes]
  );
  const visible = abierto && (texto.trim() !== '' || !!categoria || !!tipo || frecuentes);

  useEffect(() => setActivo(0), [consulta, categoria, tipo, frecuentes]);
  useEffect(() => {
    lista.current?.querySelector<HTMLElement>(`[data-indice="${activo}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activo]);

  // F2 lleva al buscador desde cualquier parte del formulario
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        entrada.current?.focus();
        setAbierto(true);
      }
    };
    const fuera = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false);
    };
    window.addEventListener('keydown', tecla);
    document.addEventListener('mousedown', fuera);
    return () => {
      window.removeEventListener('keydown', tecla);
      document.removeEventListener('mousedown', fuera);
    };
  }, []);

  const elegir = (e: EntradaCatalogo) => {
    onElegir(e, cantidad);
    setTexto('');
    setActivo(0);
    if (e.precio) entrada.current?.focus();
    else setAbierto(false); // sin precio: se cierra la lista para escribir el precio en la fila de abajo
  };

  const alTeclear = (ev: React.KeyboardEvent) => {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      setAbierto(true);
      setActivo((a) => Math.min(a + 1, resultados.length - 1));
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      setActivo((a) => Math.max(a - 1, 0));
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      if (visible && resultados[activo]) elegir(resultados[activo]);
    } else if (ev.key === 'Escape') {
      if (texto) setTexto('');
      else setAbierto(false);
    }
  };

  const filtroActivo = (c: string) => categoria === c;

  return (
    <div ref={contenedor} className="relative space-y-2">
      <div className="relative">
        <Search className="w-5 h-5 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          id="buscador-venta"
          ref={entrada}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onKeyDown={alTeclear}
          placeholder="Buscar producto o servicio: nombre, letras, código, grupo o categoría…  (F2)   Ej.: vac rab · nex 10 · 3*dog chow"
          className="w-full pl-10 pr-10 py-3 rounded-xl border-2 border-emerald-500 bg-white dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
          autoComplete="off"
          role="combobox"
          aria-expanded={visible}
          aria-controls="resultados-venta"
        />
        {texto && (
          <button type="button" onClick={() => setTexto('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" title="Limpiar">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filtros rápidos */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button type="button" onClick={() => { setCategoria(''); setTipo(''); setFrecuentes(false); entrada.current?.focus(); setAbierto(true); }}
          className={`${chip} ${!categoria && !tipo && !frecuentes ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
          Todo
        </button>
        <button type="button" onClick={() => { setFrecuentes(!frecuentes); setAbierto(true); entrada.current?.focus(); }}
          className={`${chip} flex items-center gap-1 ${frecuentes ? 'bg-amber-500 text-white border-amber-500' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
          <Star className="w-3 h-3" /> Más vendidos
        </button>
        {(['servicio', 'producto'] as const).map((t) => (
          <button key={t} type="button" onClick={() => { setTipo(tipo === t ? '' : t); setAbierto(true); entrada.current?.focus(); }}
            className={`${chip} flex items-center gap-1 ${tipo === t ? 'bg-teal-600 text-white border-teal-600' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
            {t === 'servicio' ? <Stethoscope className="w-3 h-3" /> : <Package className="w-3 h-3" />} {t === 'servicio' ? 'Servicios' : 'Productos'}
          </button>
        ))}
        <span className="w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />
        {CATEGORIAS_VENTA.map((c) => (
          <button key={c.id} type="button" onClick={() => { setCategoria(filtroActivo(c.id) ? '' : c.id); setAbierto(true); entrada.current?.focus(); }}
            className={`${chip} ${filtroActivo(c.id) ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
            {c.label}
          </button>
        ))}
      </div>

      {visible && (
        <ul
          id="resultados-venta"
          ref={lista}
          role="listbox"
          className="absolute z-30 left-0 right-0 top-[52px] max-h-80 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl divide-y divide-slate-100 dark:divide-slate-800"
        >
          {resultados.length === 0 ? (
            <li className="p-4 text-sm text-slate-500">
              Sin resultados. Escríbalo en la fila de abajo para venderlo como un ítem nuevo.
            </li>
          ) : (
            resultados.map((e, i) => (
              <li
                key={e.clave}
                data-indice={i}
                role="option"
                aria-selected={i === activo}
                onMouseEnter={() => setActivo(i)}
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  elegir(e);
                }}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${i === activo ? 'bg-emerald-50 dark:bg-emerald-950/40' : ''}`}
              >
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${e.tipo === 'servicio' ? 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'}`}>
                  {e.tipo === 'servicio' ? <Stethoscope className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {cantidad > 1 && i === activo ? `${cantidad} × ` : ''}
                    {e.nombre}
                  </span>
                  <span className="block text-[11px] text-slate-500 truncate">
                    {CATEGORIAS_VENTA.find((c) => c.id === e.categoria)?.label}
                    {e.codigo ? ` · ${e.codigo}` : ''}
                    {e.grupo ? ` · ${e.grupo}` : ''}
                    {e.existencia !== undefined ? ` · Inventario: ${e.existencia.toLocaleString('es-CO')}${e.unidad ? ' ' + e.unidad : ''}` : ''}
                    {e.vendidos ? ` · vendido ${e.vendidos.toLocaleString('es-CO')} veces` : ''}
                  </span>
                </span>
                <span className={`text-sm font-black whitespace-nowrap ${e.precio ? 'text-slate-900 dark:text-white' : 'text-amber-600 text-xs'}`}>
                  {e.precio ? formatCOP(e.precio) : 'Sin precio'}
                </span>
              </li>
            ))
          )}
          <li className="px-3 py-1.5 text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-800/60 sticky bottom-0">
            ↑ ↓ para moverse · Enter para agregar · Esc para cerrar · “3*” antes del nombre agrega 3 unidades
          </li>
        </ul>
      )}
    </div>
  );
};
