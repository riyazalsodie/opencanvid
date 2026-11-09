import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// Eliminate Edge / Browser context menu & default shortcuts
if (typeof window !== 'undefined') {
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  window.addEventListener('keydown', (e) => {
    // Prevent accidental reload or inspect in native app
    if (
      (e.ctrlKey && (e.key === 'r' || e.key === 'u' || e.key === 'p')) ||
      e.key === 'F5' ||
      e.key === 'F12'
    ) {
      e.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
