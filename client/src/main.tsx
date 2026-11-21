import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { applyTheme, useUI } from './store';
import './styles.css';

// Follow the OS when theme is "auto"
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
  if (useUI.getState().theme === 'auto') applyTheme('auto');
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

// Service worker: registered after load, never in dev. Asks to refresh when a new version is waiting.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        const announce = (w: ServiceWorker | null) => w && navigator.serviceWorker.controller && window.dispatchEvent(new CustomEvent('ts-sw-update', { detail: w }));
        if (reg.waiting) announce(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          nw?.addEventListener('statechange', () => nw.state === 'installed' && announce(nw));
        });
        setInterval(() => void reg.update(), 60 * 60 * 1000);
      })
      .catch(() => {});
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
  });
}
