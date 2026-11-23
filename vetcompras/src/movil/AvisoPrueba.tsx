import React, { useState } from 'react';
import { FlaskConical, X } from 'lucide-react';

/** Franja de la versión de prueba del celular: se puede ocultar y vuelve al abrir la app. */
export const AvisoPrueba: React.FC = () => {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <div className="fixed z-[60] left-1/2 -translate-x-1/2 w-[min(560px,calc(100vw-24px))]" style={{ bottom: 'calc(78px + var(--sa-bottom, 0px))' }}>
      <div className="flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50/95 backdrop-blur px-3 py-2 text-[11px] font-semibold text-amber-950 shadow-lg">
        <FlaskConical className="w-4 h-4 shrink-0" />
        <span className="flex-1">Versión de prueba: sin licencia, con datos de ejemplo y hasta 60 ventas y 60 compras.</span>
        <button onClick={() => setVisible(false)} className="p-1 rounded-lg hover:bg-amber-100" title="Ocultar aviso">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
