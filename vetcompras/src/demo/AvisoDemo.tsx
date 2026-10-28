import React, { useEffect, useRef, useState } from "react";
import {
  FlaskConical,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  CREDENCIALES_DEMO,
  modoAccesoDemo,
  reiniciarDemo,
} from "./servidorDemo";

/** Aviso flotante de la demostración en línea: credenciales y reinicio. */
export const AvisoDemo: React.FC = () => {
  // En celular empieza plegado para no tapar el formulario de ingreso
  // Empieza plegado (una sola línea abajo): así nunca tapa el botón Ingresar ni los formularios
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  // Se pliega solo al primer clic fuera del aviso, para no tapar los formularios
  useEffect(() => {
    if (!abierto) return;
    const alHacerClic = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node))
        setAbierto(false);
    };
    document.addEventListener("mousedown", alHacerClic);
    return () => document.removeEventListener("mousedown", alHacerClic);
  }, [abierto]);

  const libre = modoAccesoDemo() === "libre";
  const reiniciar = (
    conUsuarios: boolean,
    modo: "libre" | "usuarios" = "libre",
  ) => {
    reiniciarDemo(conUsuarios, modo);
    location.reload();
  };

  return (
    <div
      ref={contenedor}
      className="fixed z-[60] left-1/2 -translate-x-1/2 bottom-[76px] md:bottom-4 w-[min(560px,calc(100vw-32px))]"
    >
      <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50/95 dark:bg-amber-950/95 backdrop-blur shadow-xl text-amber-950 dark:text-amber-100">
        <button
          onClick={() => setAbierto(!abierto)}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs font-bold"
          aria-expanded={abierto}
        >
          <FlaskConical className="w-4 h-4 shrink-0" />
          <span className="flex-1">
            Demostración de VetCompras: los datos son de ejemplo y quedan solo
            en este navegador
          </span>
          {abierto ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronUp className="w-4 h-4" />
          )}
        </button>
        {abierto && (
          <div className="px-4 pb-3 space-y-2.5 text-xs">
            {libre ? (
              <p className="rounded-xl bg-white/70 dark:bg-black/20 px-3 py-2">
                Ingreso <strong>sin usuario ni contraseña</strong>: pulse el
                botón grande <strong>Ingresar</strong>. Si algún día quiere
                pedir contraseña, se activa en{" "}
                <em>Ingreso y Bitácora → Forma de ingreso</em>.
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                {CREDENCIALES_DEMO.map((c) => (
                  <div
                    key={c.usuario}
                    className="rounded-xl bg-white/70 dark:bg-black/20 px-3 py-2"
                  >
                    <p className="font-semibold">{c.rol}</p>
                    <p className="font-mono select-all">
                      {c.usuario} / {c.clave}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] opacity-80">
              Pruebe una venta con el buscador (F2), varios ítems y formas de
              pago, y descargue el recibo PDF. Las plantillas y exportaciones a
              Excel se descargan normalmente. En esta vista previa no se
              descargan copias de seguridad ni se leen PDF escaneados o fotos;
              en la instalación real sí.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => reiniciar(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900 font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reiniciar demostración
              </button>
              <button
                onClick={() => reiniciar(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900 font-semibold"
              >
                <Sparkles className="w-3.5 h-3.5" /> Empezar sin datos
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
