import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App.jsx';
import { AuthProvider } from './shared/auth.jsx';
import ServerGate from './components/ServerGate.jsx';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ServerGate>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ServerGate>
    </BrowserRouter>
  </React.StrictMode>
);
