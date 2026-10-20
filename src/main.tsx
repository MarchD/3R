import React from 'react';
import ReactDOM from 'react-dom/client';
import { StaticWorkbench } from './app/StaticWorkbench';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './i18n/LanguageContext';
import 'leaflet/dist/leaflet.css';
import './styles.css';

ReactDOM.createRoot(document.getElementById('attachment-root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <ToastProvider>
          <StaticWorkbench />
        </ToastProvider>
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
