import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../shared/api.js';
import { useAuth } from '../shared/auth.jsx';
import { useTheme } from '../shared/theme.jsx';
import {
  emitNotificationsChanged,
  NOTIFICATIONS_CHANGED_EVENT,
  playNotificationSound,
} from '../shared/notificationSound.js';

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

const POLL_MS = 30000;

export default function Layout({ children }) {
  const { user, logout, can } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const isHome = pathname === '/';
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef(null);
  const knownUnreadIdsRef = useRef(null);
  const canSeeNotifications = can('notifications:read') || can('dashboards:read') || can('*');

  const refreshUnread = useCallback(async () => {
    if (!canSeeNotifications) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await api('/notifications?unread=true');
      const unread = (res.data || []).filter((n) => !n.readAt);
      const ids = new Set(unread.map((n) => String(n._id)));
      const prev = knownUnreadIdsRef.current;
      if (prev) {
        let hasNew = false;
        for (const id of ids) {
          if (!prev.has(id)) {
            hasNew = true;
            break;
          }
        }
        if (hasNew) playNotificationSound();
      }
      knownUnreadIdsRef.current = ids;
      setUnreadCount(unread.length);
    } catch {
      // Keep last known count on transient errors
    }
  }, [canSeeNotifications]);

  useEffect(() => {
    setMenuOpen(false);
    setConfirmLogout(false);
  }, [pathname]);

  useEffect(() => {
    if (!canSeeNotifications) return undefined;
    refreshUnread();
    const timer = window.setInterval(refreshUnread, POLL_MS);
    const onFocus = () => refreshUnread();
    const onChanged = () => refreshUnread();
    window.addEventListener('focus', onFocus);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    };
  }, [canSeeNotifications, refreshUnread, pathname]);

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

  const unreadLabel =
    unreadCount > 99 ? '99+' : unreadCount > 0 ? String(unreadCount) : '';

  return (
    <div className={`app-shell${isHome ? ' app-shell--home' : ''}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-header">
        <Link to="/" className="brand" aria-label="TYLO One home">
          <strong className="brand-wordmark">
            TYLO <span>One</span>
          </strong>
        </Link>
        <div className="header-actions">
          <button
            type="button"
            className="header-theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5Z" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          {canSeeNotifications && (
            <Link
              to="/notifications"
              className={`header-bell${pathname.startsWith('/notifications') ? ' is-active' : ''}${
                unreadCount ? ' has-unread' : ''
              }`}
              aria-label={
                unreadCount
                  ? `Notifications, ${unreadCount} unread`
                  : 'Notifications'
              }
              title={unreadCount ? `${unreadCount} unread` : 'Notifications'}
              onClick={() => emitNotificationsChanged()}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                <path
                  d="M6.5 10.5a5.5 5.5 0 0 1 11 0c0 4.2 1.5 5.5 1.5 5.5H5s1.5-1.3 1.5-5.5Z"
                  strokeLinejoin="round"
                />
                <path d="M10 17.75a2 2 0 0 0 4 0" strokeLinecap="round" />
              </svg>
              {unreadLabel ? (
                <span className="header-bell-badge" aria-hidden="true">
                  {unreadLabel}
                </span>
              ) : null}
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
            <p>Are you sure you want to log out?</p>
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
