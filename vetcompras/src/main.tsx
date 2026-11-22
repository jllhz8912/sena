import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AlertaCopiaSemanal } from './components/respaldos/AlertaCopiaSemanal';
import './fuentes';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <>
    <App />
    {/* Alerta semanal obligatoria de copia de seguridad: bloquea también la pantalla de inicio */}
    <AlertaCopiaSemanal />
  </>
);
