import { createRoot } from 'react-dom/client';
import { instalarServidorDemo } from './servidorDemo';
import { AvisoDemo } from './AvisoDemo';
import { configurarGuardadoArchivos } from '../services/reciboPdf';
import App from '../App';
import '../index.css';

// Las llamadas a /api las responde la demostración dentro del navegador
instalarServidorDemo();

// En la página publicada, los PDF se guardan con la confirmación del visor
(window as any).claude
  ?.use?.('downloads')
  .then((descargas: any) => {
    if (descargas) {
      configurarGuardadoArchivos(async (blob, nombre) => {
        await descargas.save({ filename: nombre, data: blob });
      });
    }
  })
  .catch(() => undefined);

createRoot(document.getElementById('root')!).render(
  <>
    <App />
    <AvisoDemo />
  </>
);
