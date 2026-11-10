import { Link } from 'react-router-dom';
import { OPERATIONAL_MODULES, isNavActive } from '../shared/navModules.jsx';
import { MODULE } from '../shared/labels.js';

export default function AppSidebar({
  pathname = '',
  can,
  isCollapsed = false,
  onToggleCollapse,
  onNavigate,
}) {
  const canSeeDashboard = can('dashboards:read') || can('*');
  const canSeeAccess = can('users:write') || can('*');
  const canSeeAudit = can('audit:read') || can('*');

  const visibleModules = OPERATIONAL_MODULES.filter((m) => m.canShow(can));
  const operationModules = visibleModules.filter((m) => m.section !== 'system');
  const systemModules = visibleModules.filter((m) => m.section === 'system');
  const showSystemSection = canSeeAccess || canSeeAudit || systemModules.length > 0;

  return (
    <aside
      className={`app-sidebar${isCollapsed ? ' app-sidebar--collapsed' : ''}`}
      aria-label="Application navigation"
    >
      {/* ── Expand / Collapse Bar on Top ── */}
      <div className="sidebar-top-bar">
        <button
          type="button"
          className="sidebar-toggle-btn"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className="sidebar-toggle-icon" aria-hidden="true">
            {isCollapsed ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            )}
          </span>
          <span className="sidebar-toggle-label">
            {isCollapsed ? 'Expand' : 'Collapse'}
          </span>
        </button>
      </div>

      <div className="sidebar-scroll">
        <nav className="sidebar-nav">
          <div className="sidebar-section">
            <Link
              to="/"
              className={`sidebar-nav-item${isNavActive(pathname, '/') ? ' is-active' : ''}`}
              title="Dashboard Home"
              onClick={onNavigate}
            >
              <span className="sidebar-nav-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1V9.5Z" />
                </svg>
              </span>
              <span className="sidebar-nav-label">Dashboard Home</span>
            </Link>

            {canSeeDashboard && (
              <Link
                to="/dashboard"
                className={`sidebar-nav-item${isNavActive(pathname, '/dashboard') ? ' is-active' : ''}`}
                title="Operations Dashboard"
                onClick={onNavigate}
              >
                <span className="sidebar-nav-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3v18h18" />
                    <path d="m7 14 4-4 4 4 5-6" />
                  </svg>
                </span>
                <span className="sidebar-nav-label">Operations</span>
              </Link>
            )}
          </div>

          {operationModules.length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-section-title">
                <span>Operations</span>
              </div>
              {operationModules.map((m) => {
                const active = isNavActive(pathname, m.to);
                return (
                  <Link
                    key={m.id}
                    to={m.to}
                    className={`sidebar-nav-item ${m.tone || ''}${active ? ' is-active' : ''}`}
                    title={m.title}
                    onClick={onNavigate}
                  >
                    <span className="sidebar-nav-icon" aria-hidden="true">
                      {m.icon}
                    </span>
                    <span className="sidebar-nav-label">{m.title}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {showSystemSection && (
            <div className="sidebar-section">
              <div className="sidebar-section-title">
                <span>System</span>
              </div>
              {systemModules.map((m) => {
                const active = isNavActive(pathname, m.to);
                return (
                  <Link
                    key={m.id}
                    to={m.to}
                    className={`sidebar-nav-item ${m.tone || ''}${active ? ' is-active' : ''}`}
                    title={m.title}
                    onClick={onNavigate}
                  >
                    <span className="sidebar-nav-icon" aria-hidden="true">
                      {m.icon}
                    </span>
                    <span className="sidebar-nav-label">{m.title}</span>
                  </Link>
                );
              })}
              {canSeeAccess && (
                <Link
                  to="/access-control"
                  className={`sidebar-nav-item${isNavActive(pathname, '/access-control') ? ' is-active' : ''}`}
                  title={MODULE.ROLES_PERMISSIONS}
                  onClick={onNavigate}
                >
                  <span className="sidebar-nav-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <span className="sidebar-nav-label">Roles & Access</span>
                </Link>
              )}
              {canSeeAudit && (
                <Link
                  to="/audit"
                  className={`sidebar-nav-item${isNavActive(pathname, '/audit') ? ' is-active' : ''}`}
                  title="Audit Trail"
                  onClick={onNavigate}
                >
                  <span className="sidebar-nav-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </span>
                  <span className="sidebar-nav-label">Audit Trail</span>
                </Link>
              )}
            </div>
          )}
        </nav>
      </div>
    </aside>
  );
}

