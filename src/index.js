import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

import reportWebVitals from './reportWebVitals';
import WaterLevelApp from './wasserwaage.js';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <WaterLevelApp />
  </React.StrictMode>
);

reportWebVitals();


// PWA Service Worker registrieren
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((reg) => {
        console.log('Service Worker registriert', reg);
      })
      .catch((err) => {
        console.log('Service Worker Fehler', err);
      });
  });
}