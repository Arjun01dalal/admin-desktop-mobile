import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { installRendererErrorMonitor } from '@/utils/errorMonitor';
import '@/styles/tailwind.css';
import '@/styles/global.css';

installRendererErrorMonitor();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
