import { describe, it, expect } from 'vitest';
import { rutaApi } from '../src/demo/servidorDemo';

describe('demostración: reconoce las llamadas a /api', () => {
  it('en Windows con doble clic (letra de unidad en la ruta)', () => {
    expect(rutaApi('file:///C:/api/sesion')?.ruta).toBe('/sesion');
    expect(rutaApi('file:///D:/api/ventas?desde=2026-01-01')?.query.get('desde')).toBe('2026-01-01');
  });
  it('en Linux/Mac, en línea y con ruta relativa', () => {
    expect(rutaApi('/api/documentos')?.ruta).toBe('/documentos');
    expect(rutaApi('file:///api/sesion')?.ruta).toBe('/sesion');
    expect(rutaApi('https://claude.ai/api/estado')?.ruta).toBe('/estado');
  });
  it('deja pasar lo que no es /api', () => {
    expect(rutaApi('https://wa.me/573001234567')).toBeNull();
    expect(rutaApi('file:///C:/Users/x/Los-Criollos-Vet-PRUEBA.html')).toBeNull();
    expect(rutaApi('data:application/pdf;base64,AAA')).toBeNull();
  });
});
