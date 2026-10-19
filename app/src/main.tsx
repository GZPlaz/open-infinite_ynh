import 'katex/dist/katex.min.css';
import './styles/app.css';
import './styles/worksheet.css';
import './styles/print.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadSiteConfig } from './state/siteConfig';
import { StoreProvider } from './state/store';

loadSiteConfig().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <StoreProvider>
        <App />
      </StoreProvider>
    </StrictMode>,
  );
});

// Offline support: cache the app shell so it keeps working without a network.
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI)).catch(() => {
      /* offline mode is optional */
    });
  });
}
