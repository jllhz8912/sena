import { createRoot } from 'react-dom/client';
import { instalarServidorDemo } from './servidorDemo';
import { AvisoDemo } from './AvisoDemo';
import App from '../App';
import '../index.css';

// Las llamadas a /api las responde la demostración dentro del navegador
instalarServidorDemo();

createRoot(document.getElementById('root')!).render(
  <>
    <App />
    <AvisoDemo />
  </>
);
