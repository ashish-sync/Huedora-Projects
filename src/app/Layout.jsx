import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../shared/auth.jsx';

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function Layout({ children }) {
  const { user, logout, can } = useAuth();
  const { pathname } = useLocation();
  const isHome = pathname === '/';
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const menuRef = useRef(null);
  const canSeeNotifications = can('notifications:read') || can('dashboards:read') || can('*');

  useEffect(() => {
    setMenuOpen(false);
    setConfirmLogout(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setConfirmLogout(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const requestLogout = () => {
    setMenuOpen(false);
    setConfirmLogout(true);
  };

  const confirmAndLogout = () => {
    setConfirmLogout(false);
    logout();
  };

  return (
    <div className={`app-shell${isHome ? ' app-shell--home' : ''}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-header">
        <Link to="/" className="brand" aria-label="DHub Monitor home">
          <strong>DHub Monitor</strong>
        </Link>
        <div className="header-actions">
          {canSeeNotifications && (
            <Link
              to="/notifications"
              className={`header-bell${pathname.startsWith('/notifications') ? ' is-active' : ''}`}
              aria-label="Notifications"
              title="Notifications"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                <path
                  d="M6.5 10.5a5.5 5.5 0 0 1 11 0c0 4.2 1.5 5.5 1.5 5.5H5s1.5-1.3 1.5-5.5Z"
                  strokeLinejoin="round"
                />
                <path d="M10 17.75a2 2 0 0 0 4 0" strokeLinecap="round" />
              </svg>
            </Link>
          )}
          <div className="header-user" ref={menuRef}>
            <button
              type="button"
              className={`header-profile header-profile--icon${menuOpen ? ' is-open' : ''}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={`Profile menu for ${user?.fullName || user?.email || 'user'}`}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="header-avatar" aria-hidden="true">
                {initials(user?.fullName || user?.email)}
              </span>
            </button>

            {menuOpen && (
              <div className="header-profile-menu" role="menu">
                <div className="header-profile-menu-label">My profile</div>
                <div className="header-profile-menu-user">
                  <strong>{user?.fullName || 'User'}</strong>
                  <span>{user?.email}</span>
                </div>
                {(can('users:write') || can('*')) && (
                  <Link
                    to="/role-permission-master"
                    role="menuitem"
                    className="header-profile-link"
                    onClick={() => setMenuOpen(false)}
                  >
                    Roles &amp; Permissions
                  </Link>
                )}
                <button type="button" role="menuitem" className="header-profile-logout" onClick={requestLogout}>
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" className={`main${isHome ? ' main--home' : ''}`} tabIndex={-1}>
        {children}
      </main>

      {confirmLogout && (
        <div className="confirm-backdrop" role="presentation" onClick={() => setConfirmLogout(false)}>
          <div
            className="confirm-dialog card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="logout-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="logout-confirm-title">Log out?</h3>
            <p>Are you sure you want to logout?</p>
            <div className="confirm-actions">
              <button type="button" className="btn secondary" onClick={() => setConfirmLogout(false)}>
                Cancel
              </button>
              <button type="button" className="btn" onClick={confirmAndLogout}>
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
