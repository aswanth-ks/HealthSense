import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { PwaProvider } from './context/PwaContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <PwaProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </PwaProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Fade out the splash screen once the app has rendered.
requestAnimationFrame(() => {
  const splash = document.getElementById('splash');
  if (!splash) return;
  setTimeout(() => { splash.classList.add('hide'); setTimeout(() => splash.remove(), 400); }, 350);
});

// Service worker: production only (in dev it would cache Vite's modules and get in the way).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
