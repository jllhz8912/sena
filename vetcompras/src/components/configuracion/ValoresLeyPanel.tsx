import React, { useCallback, useEffect, useState } from 'react';
import { CalendarPlus, Pencil, RotateCcw, Save, Scale, X } from 'lucide-react';
import { dataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { formatCOP } from '../../utils/formatters';
import { VALORES_LEY_DEFECTO, type ValoresLey } from '../../utils/valoresLey';

const claseInput =
  'w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const etiqueta = 'block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1';
/** "0, 5, 19" → [0, 5, 19]. Separador: coma, punto y coma, barra o espacio. */
const leerTarifas = (t: string) =>
  [...new Set(t.split(/[;,/\s]+/).filter(Boolean).map(Number).filter((x) => Number.isFinite(x) && x >= 0 && x <= 100))].sort((a, b) => a - b);
const numero = (t: string) => Number(String(t).replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.')) || 0;

/** Lista y edición de los valores de ley de cada año (salario mínimo, auxilio, UVT, jornada, recargo e IVA). */
export const ValoresLeyPanel: React.FC<{ alGuardar?: () => void }> = ({ alGuardar }) => {
  const { mostrarToast } = useToast();
  const [lista, setLista] = useState<ValoresLey[]>([]);
  const [guardados, setGuardados] = useState<Set<number>>(new Set());
  const [editando, setEditandoBase] = useState<ValoresLey | null>(null);
  const [ivaTexto, setIvaTexto] = useState('');
  /** Abrir un año nuevo o distinto también carga sus tarifas de IVA en el campo de texto. */
  const abrir = (v: ValoresLey | null) => {
    setEditandoBase(v);
    if (v) setIvaTexto(v.tarifasIva.join(', '));
  };
  const setEditando = setEditandoBase;
  const admin = dataService.esAdministrador();

  const cargar = useCallback(async () => {
    const todos = await dataService.obtenerValoresLey();
    setLista(todos);
    // Años que el usuario guardó (los demás son los que trae el programa)
    const defecto = new Map(VALORES_LEY_DEFECTO.map((v) => [v.anio, JSON.stringify(v)]));
    setGuardados(new Set(todos.filter((v) => v.actualizadoEn || defecto.get(v.anio) !== JSON.stringify(v)).map((v) => v.anio)));
  }, []);
  useEffect(() => {
    cargar().catch((e) => mostrarToast('error', 'Valores de ley', e?.message));
  }, [cargar, mostrarToast]);

  const anioActual = new Date().getFullYear();
  const nuevoAnio = () => {
    const ultimo = lista[lista.length - 1];
    const anio = Math.max(anioActual, (ultimo?.anio ?? anioActual - 1) + 1);
    const base = ultimo ?? VALORES_LEY_DEFECTO[VALORES_LEY_DEFECTO.length - 1];
    // Arranca con los valores del último año ya aplicados los cambios de mitad de año
    abrir({
      ...base,
      id: String(anio),
      anio,
      horasSemana: base.cambioJornada?.valor ?? base.horasSemana,
      recargoDominical: base.cambioRecargo?.valor ?? base.recargoDominical,
      cambioJornada: undefined,
      cambioRecargo: undefined,
      fuente: '',
      creadoEn: undefined,
      actualizadoEn: undefined,
    });
  };

  const guardar = async () => {
    if (!editando) return;
    const v = { ...editando, tarifasIva: leerTarifas(ivaTexto) };
    if (!v.anio || v.anio < 2000 || v.anio > 2100) return mostrarToast('error', 'Año no válido', 'Escriba un año entre 2000 y 2100.');
    if (!v.smmlv || !v.auxilioTransporte || !v.uvt) return mostrarToast('error', 'Faltan valores', 'Salario mínimo, auxilio de transporte y UVT son obligatorios.');
    if (!v.tarifasIva.length) return mostrarToast('error', 'Faltan tarifas de IVA', 'Escriba al menos una tarifa, por ejemplo 0, 5, 19.');
    for (const c of [v.cambioJornada, v.cambioRecargo])
      if (c && !c.desde.startsWith(String(v.anio))) return mostrarToast('error', 'Fecha de cambio fuera del año', `La fecha del cambio debe ser de ${v.anio}.`);
    try {
      await dataService.guardarValoresLey(v);
      mostrarToast('success', `Valores de ${v.anio} guardados`, 'Los cálculos de ese año ya usan estos valores.');
      setEditando(null);
      await cargar();
      alGuardar?.();
    } catch (e: any) {
      mostrarToast('error', 'No se guardó', e?.message);
    }
  };

  const restaurar = async (anio: number) => {
    const trae = VALORES_LEY_DEFECTO.some((v) => v.anio === anio);
    if (!window.confirm(trae ? `¿Volver a los valores de ${anio} que trae el programa?` : `¿Borrar los valores de ${anio}?`)) return;
    try {
      await dataService.eliminarValoresLey(anio);
      mostrarToast('success', trae ? `Valores de ${anio} restaurados` : `Año ${anio} borrado`);
      await cargar();
      alGuardar?.();
    } catch (e: any) {
      mostrarToast('error', 'No se pudo', e?.message);
    }
  };

  const cambio = (k: 'cambioJornada' | 'cambioRecargo', campo: 'desde' | 'valor', valor: string) => {
    if (!editando) return;
    const actual = editando[k] ?? { desde: '', valor: 0 };
    const sig = { ...actual, [campo]: campo === 'valor' ? numero(valor) : valor };
    setEditando({ ...editando, [k]: sig.desde || sig.valor ? sig : undefined });
  };

  return (
    <div className="space-y-4" id="valores-ley">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <Scale className="w-4 h-4 text-blue-600" /> Valores de ley por año
          </h3>
          <p className="text-xs text-slate-500 max-w-2xl">
            Salario mínimo, auxilio de transporte, UVT, jornada, recargo dominical y tarifas de IVA. Cada cálculo usa los valores del año de su fecha: una
            nómina de diciembre de 2025 usa los de 2025 y una de enero de 2026, los de 2026. Cuando el Gobierno publique los del año nuevo, agréguelos aquí.
          </p>
        </div>
        {admin && (
          <button id="valores-ley-nuevo" onClick={nuevoAnio} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">
            <CalendarPlus className="w-4 h-4" /> Agregar año
          </button>
        )}
      </div>

      {!lista.some((v) => v.anio === anioActual) && (
        <p className="text-xs font-semibold text-amber-700 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
          No hay valores registrados para {anioActual}. Mientras tanto se usan los del último año registrado; agréguelos con “Agregar año”.
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500">
            <tr>
              {['Año', 'Salario mínimo', 'Auxilio transporte', 'UVT', 'Jornada', 'Dominical', 'IVA', ''].map((t) => (
                <th key={t} className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...lista].reverse().map((v) => (
              <tr key={v.anio} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-2 font-black text-slate-900 dark:text-white">
                  {v.anio}
                  {v.anio === anioActual && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px]">vigente</span>}
                  {guardados.has(v.anio) && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px]">editado</span>}
                </td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">{formatCOP(v.smmlv)}</td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">{formatCOP(v.auxilioTransporte)}</td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">{formatCOP(v.uvt)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {v.horasSemana} h{v.cambioJornada ? ` → ${v.cambioJornada.valor} h desde ${v.cambioJornada.desde}` : ''}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {v.recargoDominical} %{v.cambioRecargo ? ` → ${v.cambioRecargo.valor} % desde ${v.cambioRecargo.desde}` : ''}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{v.tarifasIva.join(' · ')} %</td>
                <td className="px-3 py-2 whitespace-nowrap text-right">
                  {admin && (
                    <>
                      <button id={`valores-ley-editar-${v.anio}`} onClick={() => abrir({ ...v })} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {guardados.has(v.anio) && (
                        <button onClick={() => restaurar(v.anio)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Restaurar o borrar">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!admin && <p className="text-xs text-slate-500">Solo el perfil Administración puede cambiar estos valores.</p>}

      {editando && (
        <div className="p-4 rounded-2xl border-2 border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 space-y-3" id="valores-ley-editor">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">Valores de {editando.anio || 'un año nuevo'}</h4>
            <button onClick={() => setEditando(null)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Cerrar">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 [&>*]:min-w-0">
            <div>
              <label className={etiqueta}>Año</label>
              <input id="vl-anio" inputMode="numeric" value={editando.anio || ''} onChange={(e) => setEditando({ ...editando, anio: numero(e.target.value), id: String(numero(e.target.value)) })} className={claseInput} />
            </div>
            {(
              [
                ['smmlv', 'Salario mínimo mensual'],
                ['auxilioTransporte', 'Auxilio de transporte'],
                ['uvt', 'UVT'],
                ['horasSemana', 'Jornada semanal (horas) al iniciar el año'],
                ['recargoDominical', 'Recargo dominical (%) al iniciar el año'],
              ] as const
            ).map(([k, t]) => (
              <div key={k}>
                <label className={etiqueta}>{t}</label>
                <input id={`vl-${k}`} inputMode="numeric" value={editando[k] || ''} onChange={(e) => setEditando({ ...editando, [k]: numero(e.target.value) })} className={claseInput + ' text-right'} />
              </div>
            ))}
            <div>
              <label className={etiqueta}>Tarifas de IVA (%), separadas por coma</label>
              <input id="vl-iva" value={ivaTexto} onChange={(e) => setIvaTexto(e.target.value)} className={claseInput} placeholder="0, 5, 19" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 [&>*]:min-w-0">
            <div>
              <label className={etiqueta}>Cambio de jornada: desde (opcional)</label>
              <input id="vl-jornada-desde" type="date" value={editando.cambioJornada?.desde || ''} onChange={(e) => cambio('cambioJornada', 'desde', e.target.value)} className={claseInput} />
            </div>
            <div>
              <label className={etiqueta}>Nueva jornada (horas)</label>
              <input id="vl-jornada-valor" inputMode="numeric" value={editando.cambioJornada?.valor || ''} onChange={(e) => cambio('cambioJornada', 'valor', e.target.value)} className={claseInput + ' text-right'} />
            </div>
            <div>
              <label className={etiqueta}>Cambio de recargo dominical: desde (opcional)</label>
              <input id="vl-recargo-desde" type="date" value={editando.cambioRecargo?.desde || ''} onChange={(e) => cambio('cambioRecargo', 'desde', e.target.value)} className={claseInput} />
            </div>
            <div>
              <label className={etiqueta}>Nuevo recargo (%)</label>
              <input id="vl-recargo-valor" inputMode="numeric" value={editando.cambioRecargo?.valor || ''} onChange={(e) => cambio('cambioRecargo', 'valor', e.target.value)} className={claseInput + ' text-right'} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 [&>*]:min-w-0">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={editando.exoneradoParafiscales} onChange={(e) => setEditando({ ...editando, exoneradoParafiscales: e.target.checked })} />
              Exonerado de salud 8,5 %, SENA e ICBF (art. 114-1 E.T.)
            </label>
            <div>
              <label className={etiqueta}>Norma o fuente (decreto, resolución)</label>
              <input id="vl-fuente" value={editando.fuente || ''} onChange={(e) => setEditando({ ...editando, fuente: e.target.value })} className={claseInput} placeholder="Ej.: Decreto del salario mínimo y resolución DIAN de la UVT" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditando(null)} className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700">
              Cancelar
            </button>
            <button id="vl-guardar" onClick={guardar} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">
              <Save className="w-4 h-4" /> Guardar valores de {editando.anio}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
