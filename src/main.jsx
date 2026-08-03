import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App.jsx';
import { AuthProvider } from './shared/auth.jsx';
import { ThemeProvider } from './shared/theme.jsx';
import ServerGate from './components/ServerGate.jsx';
import './styles/global.css';
import './styles/foundations/viewport-chrome.css';
import './styles/foundations/typography-base.css';
import './styles/foundations/focus-visible.css';
import './styles/components/button.css';
import './styles/components/badge.css';
import './styles/components/alert.css';
import './styles/components/modal.css';
import './styles/components/forms.css';
import './styles/components/date-input.css';
import './styles/components/module-sub-nav.css';
import './styles/patches/enterprise-polish.css';
import './styles/design-system.css';
import './styles/patches/consistency.css';
import './styles/components/select.css';
import './styles/components/control-inset.css';
import './styles/components/filter-toolbar.css';
import './styles/components/master-list.css';
import { applyFinanceLocalResetIfNeeded } from './features/finance/clearFinanceLocalData.js';

applyFinanceLocalResetIfNeeded();

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
