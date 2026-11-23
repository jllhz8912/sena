import type { CapacitorConfig } from '@capacitor/cli';

/** App de celular (Android) de Sistema de Control 2.0. */
const config: CapacitorConfig = {
  appId: 'com.sistemacontrol.movil',
  appName: 'Sistema de Control',
  webDir: 'dist-movil',
  android: {
    // Sin contenido mezclado ni depuración remota en la versión entregada
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SystemBars: { insetsHandling: 'css' },
  },
};

export default config;
