import { createRoot } from 'react-dom/client';
import App from './App';
import { installRendererErrorMonitor } from '@/utils/errorMonitor';
import { unlockNotificationAudio } from '@/utils/showPushToast';
import '@/styles/tailwind.css';
import '@/styles/global.css';

installRendererErrorMonitor();

// Unlock HTMLAudio after first gesture so push sounds can autoplay later.
const unlockOnce = () => {
  unlockNotificationAudio();
  window.removeEventListener('pointerdown', unlockOnce);
  window.removeEventListener('keydown', unlockOnce);
};
window.addEventListener('pointerdown', unlockOnce, { once: true });
window.addEventListener('keydown', unlockOnce, { once: true });

// Panel pages load authenticated reports in mount effects. React StrictMode
// intentionally remounts components in development, which doubles every API
// request and makes Electron route changes feel slow. Runtime guards and
// TypeScript still protect production; render once here to match packaged app.
createRoot(document.getElementById('root')!).render(<App />);
