// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { DarkModeProvider } from './contexts/DarkModeContext';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <DarkModeProvider>
      <PayPalScriptProvider
        options={{
          clientId: process.env.REACT_APP_PAYPAL_CLIENT_ID,
          currency: "EUR",
          intent: "capture",
        }}
      >
        <App />
      </PayPalScriptProvider>
    </DarkModeProvider>
  </React.StrictMode>
);
reportWebVitals();
serviceWorkerRegistration.register();
