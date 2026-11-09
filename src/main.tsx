import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './serviceWorkerRegistration';

// Initialize offline PWA service worker
registerServiceWorker();

createRoot(document.getElementById('root')!).render(<App />);
