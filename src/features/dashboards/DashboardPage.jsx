import { Link } from 'react-router-dom';
import { MODULE } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';

/** Onboard → sign → verify */
const LIFECYCLE = [
  {
    to: '/assets',
    title: MODULE.ASSET_INVENTORY,
    blurb: 'Onboard devices — register serials, custody, and status.',
    step: '01',
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
    blurb: 'Get them signed — documents, contacts, and e-signatures.',
    step: '02',
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
    blurb: 'Verify them — Round I / II with photo, GPS, and callbacks.',
    step: '03',
    canShow: (can) => can('verifications:read') || can('verifications:write') || can('*'),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M9.25 12.75 11 14.5l3.75-3.75" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 3.5 5 6.75v5.4c0 3.9 2.95 7.5 7 8.6 4.05-1.1 7-4.7 7-8.6v-5.4L12 3.5Z" />
      </svg>
    ),
  },
];

const OPS = [
  {
    to: '/movements',
    title: 'Movements',
    blurb: 'Request and approve custody transfers.',
    canShow: (can) =>
      can('movements:read') || can('movements:request') || can('movements:approve') || can('*'),
  },
  {
    to: '/repairs',
    title: 'Repairs',
    blurb: 'Track repair and maintenance tickets.',
    canShow: (can) => can('repairs:read') || can('repairs:write') || can('*'),
  },
];

export default function DashboardPage() {
  const { can } = useAuth();
  const lifecycle = LIFECYCLE.filter((m) => m.canShow(can));
  const ops = OPS.filter((m) => m.canShow(can));
  const canSeeDashboard = can('dashboards:read') || can('*');

  return (
    <div className="dhub-home">
      <div className="dhub-home-atmosphere" aria-hidden="true" />

      <header className="dhub-home-hero">
        <h1 id="dhub-modules-heading" className="dhub-home-prompt">
          Pick what you want to do today.
        </h1>
        <p className="dhub-home-path" aria-hidden="true">
          Onboard → Sign → Verify
        </p>
      </header>

      {canSeeDashboard && (
        <section className="dhub-home-dash-callout card" aria-label="Tracking dashboard">
          <div>
            <h2>{MODULE.DASHBOARD}</h2>
            <p className="muted">
              Track Asset Inventory by status (Qty & Value) and Asset Verification
              (Safe / Caution / Danger).
            </p>
          </div>
          <Link className="btn secondary" to="/dashboard">
            View tracking
          </Link>
        </section>
      )}

      <section className="dhub-home-modules" aria-labelledby="dhub-modules-heading">
        {!lifecycle.length && (
          <p className="dhub-home-empty muted">No modules available for your role.</p>
        )}

        <div className="dhub-home-grid dhub-home-grid--path">
          {lifecycle.map((m, i) => (
            <Link
              key={m.to}
              to={m.to}
              className="dhub-home-card tone-primary"
              style={{ '--i': i }}
            >
              <span className="dhub-home-card-index" aria-hidden="true">
                {m.step}
              </span>
              <span className="dhub-home-card-icon">{m.icon}</span>
              <div className="dhub-home-card-body">
                <h2>{m.title}</h2>
                <p>{m.blurb}</p>
              </div>
              <span className="dhub-home-card-cta">
                Open
                <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {ops.length > 0 && (
        <section className="dhub-home-ops" aria-label="Optional operations">
          <h2 className="dhub-home-ops-title">Also available</h2>
          <div className="dhub-home-ops-row">
            {ops.map((m) => (
              <Link key={m.to} to={m.to} className="dhub-home-ops-link">
                <strong>{m.title}</strong>
                <span>{m.blurb}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
