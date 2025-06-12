// frontend/src/index.js (Updated)
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
    {/* Stagewise toolbar temporarily disabled - will add back once working */}
  </React.StrictMode>
);
