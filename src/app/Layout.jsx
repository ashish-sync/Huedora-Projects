import { useCallback, useEffect, useRef, useState } from 'react';
import BrandLogo from '../components/BrandLogo.jsx';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../shared/api.js';
import { useAuth } from '../shared/auth.jsx';
import { useTheme } from '../shared/theme.jsx';
import { MODULE } from '../shared/labels.js';
import {
  emitNotificationsChanged,
  NOTIFICATIONS_CHANGED_EVENT,
  playNotificationSound,
} from '../shared/notificationSound.js';
import AppErrorBoundary from '../components/AppErrorBoundary.jsx';
import ModalShell from '../components/ui/ModalShell.jsx';
import { formatDateTime } from '../shared/dateFormat.js';
import { priorityClass, priorityLabel } from '../features/notifications/notificationLinks.js';
import '../features/notifications/notifications.css';

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
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const menuRef = useRef(null);
  const bellRef = useRef(null);
  const knownUnreadIdsRef = useRef(null);
  const lastUnreadPollRef = useRef(0);
  const unreadAbortRef = useRef(null);
  const canSeeNotifications = can('notifications:read') || can('dashboards:read') || can('*');

  const refreshUnread = useCallback(async ({ force = false } = {}) => {
    if (!canSeeNotifications) {
      setUnreadCount(0);
      return;
    }
    if (typeof document !== 'undefined' && document.hidden && !force) return;
    const now = Date.now();
    if (!force && now - lastUnreadPollRef.current < 5000) return;
    lastUnreadPollRef.current = now;

    unreadAbortRef.current?.abort();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    unreadAbortRef.current = controller;

    try {
      const res = await api('/notifications/unread-count', {
        ...(controller ? { signal: controller.signal } : {}),
      });
      const count = Number(res.data?.count) || 0;
      const ids = new Set((res.data?.sampleIds || []).map(String));
      const prev = knownUnreadIdsRef.current;
      if (prev && ids.size) {
        let hasNew = false;
        for (const id of ids) {
          if (!prev.has(id)) {
            hasNew = true;
            break;
          }
        }
        if (hasNew) playNotificationSound();
      }
      knownUnreadIdsRef.current = ids.size ? ids : knownUnreadIdsRef.current;
      setUnreadCount((prevCount) => (prevCount === count ? prevCount : count));
    } catch (err) {
      if (err?.name === 'AbortError') return;
      // Keep last known count on transient errors
    }
  }, [canSeeNotifications]);

  useEffect(() => {
    setMenuOpen(false);
    setBellOpen(false);
    setConfirmLogout(false);
  }, [pathname]);

  const loadPreview = useCallback(async () => {
    if (!canSeeNotifications) return;
    try {
      const res = await api('/notifications?unread=true&limit=8&page=1');
      setPreviewRows((res.data || []).slice(0, 8));
    } catch {
      setPreviewRows([]);
    }
  }, [canSeeNotifications]);

  useEffect(() => {
    if (!bellOpen) return undefined;
    loadPreview();
    const onDoc = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setBellOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [bellOpen, loadPreview]);

  useEffect(() => {
    if (!canSeeNotifications) return undefined;
    refreshUnread({ force: true });
    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      refreshUnread({ force: true });
    }, POLL_MS);
    const onFocus = () => refreshUnread({ force: false });
    const onVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) refreshUnread({ force: true });
    };
    const onChanged = () => refreshUnread({ force: true });
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
      unreadAbortRef.current?.abort();
    };
  }, [canSeeNotifications, refreshUnread]);

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

  const confirmAndLogout = async () => {
    if (logoutBusy) return;
    setLogoutBusy(true);
    setConfirmLogout(false);
    try {
      await logout();
    } finally {
      setLogoutBusy(false);
    }
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
          <BrandLogo size={36} />
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
            <div className="header-bell-wrap" ref={bellRef}>
              <button
                type="button"
                className={`header-bell${pathname.startsWith('/notifications') || bellOpen ? ' is-active' : ''}${
                  unreadCount ? ' has-unread' : ''
                }`}
                aria-label={
                  unreadCount
                    ? `Notifications, ${unreadCount} unread`
                    : 'Notifications'
                }
                aria-expanded={bellOpen}
                aria-haspopup="dialog"
                title={unreadCount ? `${unreadCount} unread` : 'Notifications'}
                onClick={() => {
                  setBellOpen((v) => !v);
                  emitNotificationsChanged();
                }}
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
              </button>
              {bellOpen ? (
                <div className="header-notif-panel" role="dialog" aria-label="Recent notifications">
                  <div className="header-notif-panel-head">
                    <span>Notifications</span>
                    <span className="muted">{unreadCount} unread</span>
                  </div>
                  {previewRows.length ? (
                    previewRows.map((n) => (
                      <Link
                        key={n._id}
                        to="/notifications"
                        className={`header-notif-item${n.readAt ? '' : ' is-unread'}`}
                        onClick={() => setBellOpen(false)}
                      >
                        <span className={priorityClass(n.priority)}>{priorityLabel(n.priority)}</span>
                        <span className="header-notif-item-title">{n.title}</span>
                        <div className="header-notif-item-meta">
                          {formatDateTime(n.groupedAt || n.createdAt)}
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="header-notif-empty">No unread notifications</div>
                  )}
                  <Link
                    to="/notifications"
                    className="header-notif-footer"
                    onClick={() => setBellOpen(false)}
                  >
                    View all
                  </Link>
                </div>
              ) : null}
            </div>
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
                  {user?.designation ? <span className="header-profile-designation">{user.designation}</span> : null}
                  <span>{user?.email}</span>
                  {user?.reportingManager?.fullName ? (
                    <span className="header-profile-manager">
                      Reports to {user.reportingManager.fullName}
                    </span>
                  ) : null}
                </div>
                {(can('users:write') || can('*')) && (
                  <Link
                    to="/access-control"
                    role="menuitem"
                    className="header-profile-link"
                    onClick={() => setMenuOpen(false)}
                  >
                    {MODULE.ROLES_PERMISSIONS}
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
        <AppErrorBoundary title="This page failed to render" detail="The rest of TYLO One is still available — try again or open another module.">
          {children}
        </AppErrorBoundary>
      </main>

      {confirmLogout ? (
        <ModalShell
          onClose={() => setConfirmLogout(false)}
          titleId="logout-confirm-title"
          overlayClassName="confirm-backdrop"
          panelClassName="confirm-dialog card"
          closeOnOverlayClick={!logoutBusy}
        >
          <h3 id="logout-confirm-title">Log out?</h3>
          <p>Are you sure you want to log out?</p>
          <div className="confirm-actions">
            <button type="button" className="btn secondary" onClick={() => setConfirmLogout(false)}>
              Cancel
            </button>
            <button type="button" className="btn" onClick={confirmAndLogout} disabled={logoutBusy}>
              {logoutBusy ? 'Logging out…' : 'Log out'}
            </button>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
