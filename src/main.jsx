import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App.jsx';
import { AuthProvider } from './shared/auth.jsx';
import { ThemeProvider } from './shared/theme.jsx';
import ServerGate from './components/ServerGate.jsx';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ServerGate>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ServerGate>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
