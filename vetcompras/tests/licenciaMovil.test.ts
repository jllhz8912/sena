import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { codigoEquipo as codigoPC, firmarLicencia, type DatosLicencia } from '../server/licencia';
import { codigoEquipo, verificarLicencia } from '../src/movil/licenciaMovil';

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const PUBLICA = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const datos = (e: string, extra: Partial<DatosLicencia> = {}): DatosLicencia => ({ v: 1, p: 'sistema-control-2', c: 'Tienda Móvil', d: '900123456', e, f: '2026-11-23', n: 'L-0002', ...extra });

describe('licencia del celular (mismo formato que el PC)', () => {
  it('calcula el código igual que el PC', async () => {
    expect(await codigoEquipo('android:abc123')).toBe(codigoPC('android:abc123'));
  });

  it('acepta la clave firmada por el generador para este celular', async () => {
    const equipo = await codigoEquipo('android:abc123');
    const e = await verificarLicencia(firmarLicencia(datos(equipo), privateKey), equipo, new Date('2026-11-24'), PUBLICA);
    expect(e).toMatchObject({ activa: true, cliente: 'Tienda Móvil', numero: 'L-0002' });
  });

  it('rechaza otro celular, vencida, alterada u otra llave', async () => {
    const equipo = await codigoEquipo('android:abc123');
    const otro = await codigoEquipo('android:zzz999');
    expect((await verificarLicencia(firmarLicencia(datos(otro), privateKey), equipo, new Date(), PUBLICA)).activa).toBe(false);
    expect((await verificarLicencia(firmarLicencia(datos(equipo, { x: '2026-01-01' }), privateKey), equipo, new Date('2026-11-24'), PUBLICA)).motivo).toMatch(/venció/);
    const clave = firmarLicencia(datos(equipo), privateKey);
    const [cuerpo, firma] = clave.slice(4).split('.');
    const alterado = Buffer.from(JSON.stringify({ ...datos(equipo), c: 'Pirata' })).toString('base64url');
    expect((await verificarLicencia(`SC2-${alterado}.${firma}`, equipo, new Date(), PUBLICA)).motivo).toMatch(/firma/);
    const ajena = crypto.generateKeyPairSync('ed25519').privateKey;
    expect((await verificarLicencia(firmarLicencia(datos(equipo), ajena), equipo, new Date(), PUBLICA)).activa).toBe(false);
    expect(cuerpo.length).toBeGreaterThan(10);
  });

  it('la clave pública incluida verifica licencias reales', async () => {
    const e = await verificarLicencia('SC2-xxx.yyy', 'AAAA-BBBB-CCCC-DDDD');
    expect(e.activa).toBe(false);
  });
});
