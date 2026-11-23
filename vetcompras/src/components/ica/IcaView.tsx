import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Landmark, Save, Trash2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Venta } from '../../types';
import { dataService } from '../../services/dataService';
import { descargarBlob, nitCompleto } from '../../services/reciboPdf';
import { useToast } from '../../context/ToastContext';
import { formatCOP, formatFecha } from '../../utils/formatters';
import { ACTIVIDADES_ICA, DATOS_ICA_VACIOS, liquidarIca, type DatosIca, type LiquidacionIca, type RegistroIca } from '../../utils/ica';

const nuevoId = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const n = (v: string) => Math.round(Number(String(v).replace(/[^\d.-]/g, '')) || 0);
const claseInput = 'w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500';
const claseTarjeta = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800';
const etiqueta = 'block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1';
const CLAVE = 'sc-ica-ultima';

function periodos(): { id: string; texto: string; desde: string; hasta: string }[] {
  const h = new Date();
  const y = h.getFullYear();
  const m = h.getMonth(); // 0-11
  const b = Math.floor(m / 2); // bimestre actual 0-5
  const fin = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, '0')}-${String(new Date(yy, mm, 0).getDate()).padStart(2, '0')}`;
  const bimAnt = b === 0 ? { y: y - 1, b: 5 } : { y, b: b - 1 };
  return [
    { id: 'anio-anterior', texto: `Año ${y - 1}`, desde: `${y - 1}-01-01`, hasta: `${y - 1}-12-31` },
    { id: 'anio', texto: `Año ${y} (a la fecha)`, desde: `${y}-01-01`, hasta: `${y}-12-31` },
    { id: 'bim-ant', texto: 'Bimestre anterior', desde: `${bimAnt.y}-${String(bimAnt.b * 2 + 1).padStart(2, '0')}-01`, hasta: fin(bimAnt.y, bimAnt.b * 2 + 2) },
    { id: 'mes-ant', texto: 'Mes anterior', desde: `${m === 0 ? y - 1 : y}-${String(m === 0 ? 12 : m).padStart(2, '0')}-01`, hasta: fin(m === 0 ? y - 1 : y, m === 0 ? 12 : m) },
  ];
}

function pdfIca(l: LiquidacionIca): Blob {
  const empresa = dataService.obtenerDatosEmpresa();
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  doc.setFont('helvetica', 'bold').setFontSize(14).text('Liquidación del impuesto de industria y comercio (ICA)', 15, 18);
  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(70, 70, 70);
  doc.text([empresa.razonSocial || empresa.nombreComercial || '', nitCompleto(empresa), `Municipio: ${l.municipio || '—'} · Periodo ${formatFecha(l.desde)} a ${formatFecha(l.hasta)}`].filter(Boolean), 15, 25);
  const act = ACTIVIDADES_ICA.find((a) => a.id === l.actividad)?.texto || l.actividad;
  autoTable(doc, {
    startY: 40,
    margin: { left: 15, right: 15 },
    head: [['Renglón', 'Valor']],
    body: [
      ['Ingresos brutos del periodo', formatCOP(l.ingresosBrutos)],
      ['(−) Devoluciones, rebajas y descuentos', formatCOP(l.devoluciones)],
      ['(−) Ingresos exentos, no sujetos y exportaciones', formatCOP(l.exentosNoSujetos)],
      ['(−) Ingresos obtenidos fuera del municipio', formatCOP(l.fueraDelMunicipio)],
      ['Base gravable', formatCOP(l.baseGravable)],
      [`Actividad: ${act} · tarifa ${l.tarifa.toLocaleString('es-CO')} por mil`, ''],
      ['Impuesto de industria y comercio', formatCOP(l.impuestoIca)],
      ['Avisos y tableros (15 % del ICA)', formatCOP(l.avisos)],
      [`Sobretasa bomberil (${l.sobretasaBomberilPct} % del ICA)`, formatCOP(l.bomberil)],
      ['Total impuesto a cargo', formatCOP(l.totalImpuesto)],
      [`(+) Anticipo año siguiente (${l.anticipoSiguientePct} %)`, formatCOP(l.anticipoSiguiente)],
      ['(−) Retenciones, autorretenciones y anticipo anterior', formatCOP(l.descuentos)],
      ['SALDO A PAGAR', formatCOP(l.saldoAPagar)],
      ['SALDO A FAVOR', formatCOP(l.saldoAFavor)],
    ],
    styles: { fontSize: 9.5 },
    headStyles: { fillColor: [234, 88, 12] },
    columnStyles: { 1: { halign: 'right', cellWidth: 45 } },
  });
  doc.setFontSize(8).setTextColor(110, 110, 110).text('Borrador de apoyo. Verifique tarifas y beneficios en el estatuto tributario de su municipio antes de presentar la declaración.', 15, 265, { maxWidth: 185 });
  return doc.output('blob');
}

/**
 * Impuesto de industria y comercio: se escoge la actividad y la tarifa por mil,
 * el periodo, y el sistema toma las ventas como ingresos brutos y liquida ICA,
 * avisos y tableros y sobretasa bomberil. Todo es editable.
 */
export const IcaView: React.FC<{ ventas: Venta[] }> = ({ ventas }) => {
  const { mostrarToast } = useToast();
  const opciones = periodos();
  const [d, setD] = useState<DatosIca>(() => {
    let guardado: Partial<DatosIca> = {};
    try {
      guardado = JSON.parse(localStorage.getItem(CLAVE) || '{}');
    } catch {
      /* sin preferencias */
    }
    const p = opciones[0];
    return { ...DATOS_ICA_VACIOS(p.desde, p.hasta), ...guardado, desde: p.desde, hasta: p.hasta, ingresosBrutos: 0, retencionesPracticadas: 0, autorretenciones: 0, anticipoAnterior: 0, devoluciones: 0, exentosNoSujetos: 0, fueraDelMunicipio: 0 };
  });
  const [ingresosManual, setIngresosManual] = useState(false);
  const [historial, setHistorial] = useState<RegistroIca[]>([]);
  const poner = <K extends keyof DatosIca>(k: K, v: DatosIca[K]) => setD((x) => ({ ...x, [k]: v }));

  const ventasPeriodo = useMemo(() => ventas.filter((v) => v.fecha >= d.desde && v.fecha <= d.hasta).reduce((s, v) => s + (v.monto || 0), 0), [ventas, d.desde, d.hasta]);
  useEffect(() => {
    if (!ingresosManual) poner('ingresosBrutos', ventasPeriodo);
  }, [ventasPeriodo, ingresosManual]);
  const l = useMemo(() => liquidarIca(d), [d]);
  const actividad = ACTIVIDADES_ICA.find((a) => a.id === d.actividad)!;

  const cargar = useCallback(() => {
    dataService.obtenerLiquidacionesIca().then(setHistorial).catch(() => undefined);
  }, []);
  useEffect(cargar, [cargar]);

  const recordar = () => {
    try {
      const { actividad, tarifa, avisosYTableros, sobretasaBomberilPct, anticipoSiguientePct, municipio } = d;
      localStorage.setItem(CLAVE, JSON.stringify({ actividad, tarifa, avisosYTableros, sobretasaBomberilPct, anticipoSiguientePct, municipio }));
    } catch {
      /* nada */
    }
  };
  const guardar = async () => {
    const ahora = new Date().toISOString();
    await dataService.guardarLiquidacionIca({ ...l, id: nuevoId('ica'), creadoEn: ahora, actualizadoEn: ahora });
    recordar();
    mostrarToast('success', 'Liquidación de ICA guardada', `Saldo a pagar ${formatCOP(l.saldoAPagar)}`);
    cargar();
  };
  const descargar = async (x: LiquidacionIca) => {
    await descargarBlob(pdfIca(x), `ICA_${x.desde}_a_${x.hasta}.pdf`);
  };

  const dinero = (k: keyof DatosIca, t: string, ayuda?: string) => (
    <div>
      <label className={etiqueta} htmlFor={`ica-${k}`}>{t}</label>
      <input
        id={`ica-${k}`}
        inputMode="numeric"
        value={(d as any)[k] || ''}
        placeholder="0"
        onChange={(e) => {
          if (k === 'ingresosBrutos') setIngresosManual(true);
          poner(k, n(e.target.value) as any);
        }}
        className={claseInput + ' text-right tabular-nums'}
      />
      {ayuda && <p className="text-[10px] text-slate-500 mt-0.5">{ayuda}</p>}
    </div>
  );
  const fila = (t: string, v: number, fuerte = false) => (
    <div className={`flex justify-between py-1.5 tabular-nums ${fuerte ? 'font-black text-base border-t border-slate-200 dark:border-slate-700' : 'text-sm'}`}>
      <span>{t}</span>
      <span>{formatCOP(v)}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className={`${claseTarjeta} p-4 sm:p-5`}>
        <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
          <Landmark className="w-5 h-5 text-orange-600" /> Impuesto de Industria y Comercio (ICA)
        </h2>
        <p className="text-xs text-slate-500 max-w-3xl">
          Escoja la actividad y la tarifa por mil de su municipio y el periodo. El sistema toma sus ventas como ingresos brutos y liquida el ICA, avisos y tableros (15 %) y la
          sobretasa bomberil. La tarifa, la sobretasa y si cobra avisos los fija el acuerdo de su municipio (Ley 14 de 1983: comercio y servicios de 2 a 10 por mil; industria
          de 2 a 7 por mil).
        </p>
      </div>
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-4 [&>*]:min-w-0">
        <div className={`${claseTarjeta} p-4 space-y-3`}>
          <div className="grid sm:grid-cols-2 gap-2 [&>*]:min-w-0">
            <div>
              <label className={etiqueta} htmlFor="ica-municipio">Municipio</label>
              <input id="ica-municipio" value={d.municipio || ''} onChange={(e) => poner('municipio', e.target.value)} placeholder="Ej. Florencia, Caquetá" className={claseInput} />
            </div>
            <div>
              <label className={etiqueta}>Periodo</label>
              <div className="flex flex-wrap gap-1.5">
                {opciones.map((o) => (
                  <button key={o.id} id={`ica-periodo-${o.id}`} onClick={() => (setIngresosManual(false), setD((x) => ({ ...x, desde: o.desde, hasta: o.hasta })))} className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold ${d.desde === o.desde && d.hasta === o.hasta ? 'bg-orange-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                    {o.texto}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={etiqueta} htmlFor="ica-desde">Desde</label>
              <input id="ica-desde" type="date" value={d.desde} onChange={(e) => (setIngresosManual(false), poner('desde', e.target.value))} className={claseInput} />
            </div>
            <div>
              <label className={etiqueta} htmlFor="ica-hasta">Hasta</label>
              <input id="ica-hasta" type="date" value={d.hasta} onChange={(e) => (setIngresosManual(false), poner('hasta', e.target.value))} className={claseInput} />
            </div>
          </div>

          <div>
            <label className={etiqueta}>Actividad</label>
            <div className="grid grid-cols-2 gap-1.5">
              {ACTIVIDADES_ICA.map((a) => (
                <button key={a.id} id={`ica-actividad-${a.id}`} onClick={() => poner('actividad', a.id)} className={`px-2.5 py-2 rounded-xl text-xs font-semibold text-left ${d.actividad === a.id ? 'bg-orange-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                  {a.texto}
                  <span className="block font-normal opacity-80">{a.rango}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={etiqueta}>Tarifa (por mil) · escoja la de su municipio</label>
            <div className="flex flex-wrap gap-1.5 items-center">
              {actividad.tarifas.map((t) => (
                <button key={t} id={`ica-tarifa-${String(t).replace('.', '_')}`} onClick={() => poner('tarifa', t)} className={`w-14 py-2 rounded-xl text-sm font-bold ${d.tarifa === t ? 'bg-orange-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                  {t.toLocaleString('es-CO')}‰
                </button>
              ))}
              <input id="ica-tarifa-otra" inputMode="decimal" value={d.tarifa} onChange={(e) => poner('tarifa', Number(e.target.value.replace(',', '.')) || 0)} className="w-24 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-right" title="Otra tarifa por mil" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2 [&>*]:min-w-0">
            {dinero('ingresosBrutos', 'Ingresos brutos del periodo', ingresosManual ? `Escrito a mano · ventas del periodo: ${formatCOP(ventasPeriodo)}` : `Tomado de las ventas registradas (${formatCOP(ventasPeriodo)})`)}
            {dinero('devoluciones', 'Devoluciones y descuentos')}
            {dinero('exentosNoSujetos', 'Exentos, no sujetos, exportaciones')}
            {dinero('fueraDelMunicipio', 'Ingresos en otros municipios')}
            {dinero('retencionesPracticadas', 'Retenciones de ICA que le hicieron')}
            {dinero('autorretenciones', 'Autorretenciones')}
            {dinero('anticipoAnterior', 'Anticipo liquidado el año anterior')}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={etiqueta} htmlFor="ica-bomberil">Sobretasa bomberil %</label>
                <input id="ica-bomberil" inputMode="decimal" value={d.sobretasaBomberilPct || ''} placeholder="0" onChange={(e) => poner('sobretasaBomberilPct', Number(e.target.value.replace(',', '.')) || 0)} className={claseInput + ' text-right'} />
              </div>
              <div>
                <label className={etiqueta} htmlFor="ica-anticipo">Anticipo siguiente %</label>
                <input id="ica-anticipo" inputMode="decimal" value={d.anticipoSiguientePct || ''} placeholder="0" onChange={(e) => poner('anticipoSiguientePct', Number(e.target.value.replace(',', '.')) || 0)} className={claseInput + ' text-right'} />
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input id="ica-avisos" type="checkbox" checked={d.avisosYTableros} onChange={(e) => poner('avisosYTableros', e.target.checked)} /> Tiene avisos o tableros (paga 15 % del ICA)
          </label>
        </div>

        <div className={`${claseTarjeta} p-4 space-y-1`}>
          <p className="text-xs font-bold uppercase text-orange-700 pb-1">Liquidación</p>
          {fila('Base gravable', l.baseGravable)}
          {fila(`ICA (${d.tarifa.toLocaleString('es-CO')} por mil)`, l.impuestoIca)}
          {fila('Avisos y tableros (15 %)', l.avisos)}
          {fila(`Sobretasa bomberil (${d.sobretasaBomberilPct} %)`, l.bomberil)}
          {fila('Total impuesto a cargo', l.totalImpuesto, true)}
          {fila('(+) Anticipo año siguiente', l.anticipoSiguiente)}
          {fila('(−) Retenciones y anticipos', l.descuentos)}
          <div className="flex items-center justify-between rounded-xl bg-orange-600 text-white px-4 py-3 mt-2">
            <span className="font-bold">{l.saldoAFavor ? 'Saldo a favor' : 'Saldo a pagar'}</span>
            <span id="ica-saldo" className="text-2xl font-black tabular-nums">{formatCOP(l.saldoAFavor || l.saldoAPagar)}</span>
          </div>
          <p className="text-[11px] text-slate-500 pt-1">Valores redondeados a miles, como en el formulario. Es un borrador de apoyo: verifique beneficios y tarifas en el estatuto de su municipio.</p>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button id="ica-guardar" onClick={guardar} className="py-2.5 rounded-xl bg-orange-600 text-white font-bold text-sm flex items-center justify-center gap-1.5">
              <Save className="w-4 h-4" /> Guardar
            </button>
            <button onClick={() => descargar(l)} className="py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold text-sm flex items-center justify-center gap-1.5">
              <Download className="w-4 h-4" /> PDF
            </button>
          </div>
        </div>
      </div>

      {historial.length > 0 && (
        <div className={`${claseTarjeta} divide-y divide-slate-100 dark:divide-slate-800`}>
          <p className="p-3 text-sm font-bold">Liquidaciones guardadas</p>
          {historial.map((h) => (
            <div key={h.id} className="flex items-center gap-3 p-3 text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-semibold">
                  {formatFecha(h.desde)} a {formatFecha(h.hasta)} · {h.tarifa.toLocaleString('es-CO')}‰ {h.municipio ? `· ${h.municipio}` : ''}
                </p>
                <p className="text-xs text-slate-500 tabular-nums">Base {formatCOP(h.baseGravable)} · ICA {formatCOP(h.impuestoIca)}</p>
              </div>
              <span className="font-black tabular-nums">{formatCOP(h.saldoAPagar || -h.saldoAFavor)}</span>
              <button onClick={() => descargar(h)} className="p-1.5" title="Descargar PDF">
                <Download className="w-4 h-4" />
              </button>
              <button onClick={async () => (await dataService.eliminarLiquidacionIca(h.id), cargar())} className="p-1.5 text-slate-400 hover:text-rose-600" title="Eliminar">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
