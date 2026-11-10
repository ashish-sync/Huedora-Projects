import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BrandLogo from '../components/BrandLogo.jsx';
import AppSidebar from './AppSidebar.jsx';
import { Link, useLocation } from 'react-router-dom';
import { apiFetch } from '../shared/api.js';
import { useAuth } from '../shared/auth.jsx';
import { useTheme } from '../shared/theme.jsx';
import { MODULE } from '../shared/labels.js';
import {
  NOTIFICATION_POLL_MS,
  shouldSkipNotificationPoll,
} from '../shared/notificationPoll.js';
import {
  emitNotificationsChanged,
  NOTIFICATIONS_CHANGED_EVENT,
  playNotificationSound,
} from '../shared/notificationSound.js';
import AppErrorBoundary from '../components/AppErrorBoundary.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import CalendarReminderWatcher from '../features/calendar/CalendarReminderWatcher.jsx';
import { TIME_ZONE } from '../shared/dateFormat.js';
import '../features/notifications/notifications.css';

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function Layout({ children }) {
  const { user, logout, can } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const isHome = pathname === '/';
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [fyiCount, setFyiCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('tylo:sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const headerDateDisplay = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: TIME_ZONE,
        weekday: 'long',
        month: 'long',
        day: '2-digit',
        year: 'numeric',
      }).format(new Date());
    } catch {
      return 'Monday, November 02, 2026';
    }
  }, []);

  const greetingFirstName = useMemo(() => {
    const full = user?.fullName || user?.name || user?.email || 'Ashish';
    return String(full).trim().split(/\s+/)[0] || 'Ashish';
  }, [user]);

  const toggleSidebarCollapse = useCallback(() => {
    if (mobileNavOpen) {
      setMobileNavOpen(false);
      return;
    }
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('tylo:sidebar-collapsed', String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, [mobileNavOpen]);
  const handleNavModulePick = useCallback(() => {
    setMobileNavOpen(false);
    setSidebarCollapsed(true);
    try {
      localStorage.setItem('tylo:sidebar-collapsed', 'true');
    } catch {
      // ignore storage errors
    }
  }, []);

  const prevPathRef = useRef(pathname);
  const menuRef = useRef(null);
  const bellRef = useRef(null);
  const knownUnreadIdsRef = useRef(null);
  const lastUnreadPollRef = useRef(0);
  const unreadAbortRef = useRef(null);
  const unreadEtagRef = useRef('');
  const canSeeNotifications = can('notifications:read') || can('dashboards:read') || can('*');

  const refreshUnread = useCallback(async ({ force = false } = {}) => {
    if (!canSeeNotifications) {
      setUnreadCount(0);
      setFyiCount(0);
      return;
    }
    const now = Date.now();
    if (
      shouldSkipNotificationPoll({
        now,
        lastPollAt: lastUnreadPollRef.current,
        force,
        documentHidden: typeof document !== 'undefined' ? document.hidden : false,
      })
    ) {
      return;
    }
    lastUnreadPollRef.current = now;

    unreadAbortRef.current?.abort();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    unreadAbortRef.current = controller;

    try {
      const headers = {};
      if (unreadEtagRef.current) headers['If-None-Match'] = unreadEtagRef.current;
      const res = await apiFetch('/notifications/unread-count', {
        headers,
        ...(controller ? { signal: controller.signal } : {}),
      });
      const nextEtag = res.headers.get('ETag') || '';
      if (nextEtag) unreadEtagRef.current = nextEtag;
      if (res.status === 304) return;
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      const data = json?.data || {};
      // Badge = Approvals only so FYI does not inflate the red number.
      const approvals = Number(data.approvals ?? data.count) || 0;
      const fyi = Number(data.fyi ?? data.updates) || 0;
      const ids = new Set((data.sampleIds || []).map(String));
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
      setUnreadCount((prevCount) => (prevCount === approvals ? prevCount : approvals));
      setFyiCount((prevCount) => (prevCount === fyi ? prevCount : fyi));
    } catch (err) {
      if (err?.name === 'AbortError') return;
      // Keep last known count on transient errors
    }
  }, [canSeeNotifications]);

  useEffect(() => {
    setMenuOpen(false);
    setBellOpen(false);
    setConfirmLogout(false);
    setMobileNavOpen(false);
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      setSidebarCollapsed(true);
      try {
        localStorage.setItem('tylo:sidebar-collapsed', 'true');
      } catch {
        // ignore storage errors
      }
    }
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!bellOpen) return undefined;
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
  }, [bellOpen]);

  useEffect(() => {
    if (!canSeeNotifications) return undefined;
    // First paint: bypass min-gap once.
    lastUnreadPollRef.current = 0;
    refreshUnread({ force: true });
    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      refreshUnread({ force: false });
    }, NOTIFICATION_POLL_MS);
    const onFocus = () => refreshUnread({ force: false });
    const onVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) refreshUnread({ force: true });
    };
    const onChanged = () => {
      unreadEtagRef.current = '';
      lastUnreadPollRef.current = 0;
      refreshUnread({ force: true });
    };
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

      {/* ── Persistent Left Sidebar Navigation (Top to Bottom) ── */}
      <div className={`sidebar-drawer-wrap${mobileNavOpen ? ' is-mobile-open' : ''}`}>
        <AppSidebar
          pathname={pathname}
          can={can}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
          onNavigate={handleNavModulePick}
        />
      </div>
      {mobileNavOpen ? (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* ── Main Workspace Column (Header with Logo + Page Content) ── */}
      <div className="app-main-column app-body">
        <header className="app-header">
        <div className="header-brand-group">
          <button
            type="button"
            className="header-sidebar-toggle"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileNavOpen}
            title={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <Link to="/" className="brand" aria-label="TYLO One home">
            <BrandLogo size={36} />
            <strong className="brand-wordmark">
              TYLO <span>One</span>
            </strong>
          </Link>
        </div>
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
                    ? `Notifications, ${unreadCount} pending approval${unreadCount === 1 ? '' : 's'}`
                    : 'Notifications'
                }
                aria-expanded={bellOpen}
                aria-haspopup="dialog"
                title={unreadCount ? `${unreadCount} pending approval${unreadCount === 1 ? '' : 's'}` : 'Notifications'}
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
                <div className="header-notif-panel" role="menu" aria-label="Notification options">
                  <div className="header-notif-panel-head">
                    <span>Updates & approvals</span>
                  </div>
                  <Link
                    to="/notifications?tab=approvals"
                    role="menuitem"
                    className={`header-notif-choice${unreadCount ? ' has-count' : ''}`}
                    onClick={() => setBellOpen(false)}
                  >
                    <span className="header-notif-choice-copy">
                      <strong>Pending approvals</strong>
                      <span className="muted">Items that need your action</span>
                    </span>
                    <span className={`header-notif-choice-count${unreadCount ? ' is-active' : ''}`}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  </Link>
                  <Link
                    to="/notifications?tab=team"
                    role="menuitem"
                    className={`header-notif-choice${fyiCount ? ' has-count' : ''}`}
                    onClick={() => setBellOpen(false)}
                  >
                    <span className="header-notif-choice-copy">
                      <strong>FYI / Notifications</strong>
                      <span className="muted">Status updates and informational alerts</span>
                    </span>
                    <span className={`header-notif-choice-count${fyiCount ? ' is-active' : ''}`}>
                      {fyiCount > 99 ? '99+' : fyiCount}
                    </span>
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
          <AppErrorBoundary title="This page failed to render" detail="The rest of TYLO One is still available. Try refreshing or open another module.">
            {children}
          </AppErrorBoundary>
        </main>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        title="Log out?"
        message="Are you sure you want to log out?"
        confirmLabel={logoutBusy ? 'Logging out…' : 'Log out'}
        confirmVariant="primary"
        loading={logoutBusy}
        onConfirm={confirmAndLogout}
        onCancel={() => setConfirmLogout(false)}
      />

      <CalendarReminderWatcher />
    </div>
  );
}
