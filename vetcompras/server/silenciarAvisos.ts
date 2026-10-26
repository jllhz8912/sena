// Debe importarse antes que node:sqlite: oculta el aviso "SQLite is an experimental feature"
// para no confundir al usuario en la ventana del servidor.
const emitirAviso = process.emitWarning.bind(process);
process.emitWarning = ((aviso: string | Error, ...resto: any[]) => {
  if (String(aviso).includes('SQLite')) return;
  return emitirAviso(aviso as any, ...resto);
}) as typeof process.emitWarning;
