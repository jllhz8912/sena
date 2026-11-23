/**
 * Fotos de productos para la caja del celular: se recortan al centro en cuadrado
 * y se guardan como miniatura JPEG (unos 15 KB) dentro del producto. Así viajan
 * con las copias de seguridad y no dependen de archivos sueltos.
 */
export const LADO_FOTO = 280;

export async function comprimirFoto(archivo: Blob, lado = LADO_FOTO, calidad = 0.72): Promise<string> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error('No se pudo leer la imagen. Pruebe con otra foto.'));
      i.src = url;
    });
    const corte = Math.min(img.naturalWidth, img.naturalHeight);
    const lienzo = document.createElement('canvas');
    lienzo.width = lienzo.height = lado;
    const ctx = lienzo.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, lado, lado);
    ctx.drawImage(img, (img.naturalWidth - corte) / 2, (img.naturalHeight - corte) / 2, corte, corte, 0, 0, lado, lado);
    return lienzo.toDataURL('image/jpeg', calidad);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Color estable para el mosaico de un producto sin foto. */
const COLORES = ['#16a34a', '#ea580c', '#7c3aed', '#dc2626', '#0891b2', '#d97706', '#db2777', '#4f46e5', '#0d9488', '#65a30d'];
export function colorDe(nombre: string): string {
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORES[h % COLORES.length];
}

/** Iniciales para el mosaico sin foto: "Concentrado perro" → "CP". */
export function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || p[0]?.[1] || '')).toUpperCase();
}

/** Reduce una foto (soporte de pago, consignación) sin recortarla: lado mayor de 1200 px, JPEG. */
export async function reducirImagen(archivo: Blob, ladoMayor = 1200, calidad = 0.7): Promise<string> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error('No se pudo leer la imagen.'));
      i.src = url;
    });
    const escala = Math.min(1, ladoMayor / Math.max(img.naturalWidth, img.naturalHeight));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(img.naturalWidth * escala);
    lienzo.height = Math.round(img.naturalHeight * escala);
    const ctx = lienzo.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    return lienzo.toDataURL('image/jpeg', calidad);
  } finally {
    URL.revokeObjectURL(url);
  }
}
