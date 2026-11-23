/**
 * Dónde corre el programa. La app de celular marca la ventana antes de dibujar
 * la interfaz; en el PC y en la demostración no existe la marca.
 */
export function esMovil(): boolean {
  return typeof window !== 'undefined' && (window as any).__SISTEMA_CONTROL_MOVIL__ === true;
}

/** "este celular" o "este PC", para los textos que nombran el equipo. */
export const nombreEquipo = () => (esMovil() ? 'este celular' : 'este PC');
