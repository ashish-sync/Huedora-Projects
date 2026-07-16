import { Link } from 'react-router-dom';
import { MODULE, MODULE_BLURB } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';

const MODULES = [
  {
    to: '/assets',
    title: MODULE.ASSET_INVENTORY,
    blurb: MODULE_BLURB.ASSET_INVENTORY,
    canShow: (can) =>
      can('assets:read') ||
      can('assets:write') ||
      can('devices:write') ||
      can('masters:read') ||
      can('*'),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M4.5 8.25 12 4l7.5 4.25v7.5L12 20l-7.5-4.25v-7.5Z" />
        <path d="M12 12v8M4.5 8.25 12 12.5l7.5-4.25" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: '/agreements',
    title: MODULE.DOCUMENT_HUB,
    blurb: MODULE_BLURB.DOCUMENT_HUB,
    canShow: (can) => can('agreements:read') || can('agreements:write') || can('*'),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M7 3.75h7.5L19 8.25v12A1.75 1.75 0 0 1 17.25 22h-10.5A1.75 1.75 0 0 1 5 20.25v-14.5A1.75 1.75 0 0 1 6.75 4" />
        <path d="M14.5 3.75V8h4.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8.5 12.5h7M8.5 16h5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/verifications',
    title: MODULE.ASSET_VERIFICATION,
    blurb: MODULE_BLURB.ASSET_VERIFICATION,
    canShow: (can) => can('verifications:read') || can('verifications:write') || can('*'),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M9.25 12.75 11 14.5l3.75-3.75" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 3.5 5 6.75v5.4c0 3.9 2.95 7.5 7 8.6 4.05-1.1 7-4.7 7-8.6v-5.4L12 3.5Z" />
      </svg>
    ),
  },
  {
    to: '/camps',
    title: MODULE.CAMP_MANAGEMENT,
    blurb: MODULE_BLURB.CAMP_MANAGEMENT,
    canShow: (can) =>
      can('camps:read') || can('camps:request') || can('camps:approve') || can('*'),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M4 20V9.5L12 4l8 5.5V20" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 20v-6h6v6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 11h.01M15 11h.01" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/asset-requests',
    title: MODULE.ASSET_REQUESTS,
    blurb: MODULE_BLURB.ASSET_REQUESTS,
    canShow: (can) =>
      can('asset-requests:read') ||
      can('asset-requests:request') ||
      can('asset-requests:approve') ||
      can('movements:read') ||
      can('movements:request') ||
      can('movements:approve') ||
      can('repairs:read') ||
      can('repairs:write') ||
      can('*'),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M8 7h8M8 12h5M8 17h8" strokeLinecap="round" />
        <path d="M5 4.75h14A1.25 1.25 0 0 1 20.25 6v12A1.25 1.25 0 0 1 19 19.25H5A1.25 1.25 0 0 1 3.75 18V6A1.25 1.25 0 0 1 5 4.75Z" />
      </svg>
    ),
  },
  {
    to: '/logistics',
    title: MODULE.INVENTORY_LOGISTICS,
    blurb: MODULE_BLURB.INVENTORY_LOGISTICS,
    canShow: (can) =>
      can('logistics:read') ||
      can('logistics:write') ||
      can('logistics:master') ||
      can('*'),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z" strokeLinejoin="round" />
        <path d="M12 12v9M3.5 7.5 12 12l8.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7.5 9.75 12 12.2l4.5-2.45" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function DashboardPage() {
  const { can, user } = useAuth();
  const modules = MODULES.filter((m) => m.canShow(can));
  const canSeeDashboard = can('dashboards:read') || can('*');
  const firstName = String(user?.fullName || '')
    .trim()
    .split(/\s+/)[0];

  return (
    <div className="dhub-home">
      <div className="dhub-home-atmosphere" aria-hidden="true" />

      <header className="dhub-home-hero">
        <div className="dhub-home-hero-copy">
          <p className="dhub-home-kicker">DHub Monitor</p>
          <h1 id="dhub-modules-heading" className="dhub-home-prompt">
            {firstName ? `Welcome back, ${firstName}.` : 'Welcome back.'}
          </h1>
          <p className="dhub-home-lead">
            Choose a workspace — registry, documents, verification, camps, requests, or logistics.
          </p>
        </div>

        {canSeeDashboard && (
          <div className="dhub-home-dash-action">
            <Link className="btn dhub-home-dash-btn" to="/dashboard">
              {MODULE.DASHBOARD}
              <span aria-hidden="true"> →</span>
            </Link>
            <p className="dhub-home-dash-hint">Inventory &amp; verification tracking</p>
          </div>
        )}
      </header>

      <section className="dhub-home-modules" aria-labelledby="dhub-modules-heading">
        <div className="dhub-home-section-head">
          <h2 className="dhub-home-section-title">Workspaces</h2>
          <p className="muted dhub-home-section-note">
            {modules.length
              ? `${modules.length} available for your role`
              : 'No modules available for your role'}
          </p>
        </div>

        {!modules.length ? (
          <p className="dhub-home-empty muted">Ask an administrator to assign module access.</p>
        ) : (
          <div className="dhub-home-grid dhub-home-grid--modules">
            {modules.map((m, i) => (
              <Link
                key={m.to}
                to={m.to}
                className="dhub-home-card tone-primary"
                style={{ '--i': i }}
              >
                <div className="dhub-home-card-top">
                  <span className="dhub-home-card-icon">{m.icon}</span>
                </div>
                <div className="dhub-home-card-body">
                  <h2>{m.title}</h2>
                  <p>{m.blurb}</p>
                </div>
                <span className="dhub-home-card-cta">
                  Enter
                  <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
