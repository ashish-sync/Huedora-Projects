import { Link } from 'react-router-dom';
import { MODULE, MODULE_BLURB } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';

/** Shared stroke props for home module marks */
const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '1.7',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

const MODULES = [
  {
    to: '/asset-inventory',
    title: MODULE.ASSET_INVENTORY,
    blurb: MODULE_BLURB.ASSET_INVENTORY,
    tone: 'tone-asset',
    canShow: (can) =>
      can('assets:read') ||
      can('assets:write') ||
      can('devices:write') ||
      can('masters:read') ||
      can('logistics:read') ||
      can('logistics:write') ||
      can('logistics:master') ||
      can('*'),
    icon: (
      <svg {...iconProps}>
        <rect x="4" y="5" width="16" height="14" rx="2.2" />
        <path d="M4 10h16" />
        <path d="M8 14h3M8 16.5h5" />
        <circle cx="16.5" cy="15.25" r="1.6" />
      </svg>
    ),
  },
  {
    to: '/agreements',
    title: MODULE.DOCUMENT_HUB,
    blurb: MODULE_BLURB.DOCUMENT_HUB,
    tone: 'tone-document',
    canShow: (can) => can('agreements:read') || can('agreements:write') || can('*'),
    icon: (
      <svg {...iconProps}>
        <path d="M7 3.5h7l4 4V19.5A1.5 1.5 0 0 1 16.5 21h-9A1.5 1.5 0 0 1 6 19.5v-14A2 2 0 0 1 7 3.5Z" />
        <path d="M14 3.5V8h4.5" />
        <path d="M9 12.2h6M9 15.2h4" />
        <path d="M14.5 18.2 16 19.7l2.8-3" />
      </svg>
    ),
  },
  {
    to: '/verifications',
    title: MODULE.ASSET_VERIFICATION,
    blurb: MODULE_BLURB.ASSET_VERIFICATION,
    tone: 'tone-verify',
    canShow: (can) => can('verifications:read') || can('verifications:write') || can('*'),
    icon: (
      <svg {...iconProps}>
        <path d="M12 3.2 5.2 6.2v5.2c0 4.1 2.9 7.7 6.8 8.8 3.9-1.1 6.8-4.7 6.8-8.8V6.2L12 3.2Z" />
        <path d="M9.2 12.1 11.1 14l3.7-3.8" />
      </svg>
    ),
  },
  {
    to: '/camps',
    title: MODULE.CAMP_MANAGEMENT,
    blurb: MODULE_BLURB.CAMP_MANAGEMENT,
    tone: 'tone-camp',
    canShow: (can) =>
      can('camps:read') || can('camps:request') || can('camps:approve') || can('*'),
    icon: (
      <svg {...iconProps}>
        <path d="M4.5 19.5 12 4.5l7.5 15H4.5Z" />
        <path d="M12 4.5v15" />
        <path d="M8.2 19.5c.7-2.2 2-3.5 3.8-3.5s3.1 1.3 3.8 3.5" />
      </svg>
    ),
  },
  {
    to: '/asset-requests',
    title: MODULE.ASSET_REQUESTS,
    blurb: MODULE_BLURB.ASSET_REQUESTS,
    tone: 'tone-request',
    canShow: (can) =>
      can('asset-requests:read') ||
      can('asset-requests:request') ||
      can('asset-requests:approve') ||
      can('movements:read') ||
      can('movements:request') ||
      can('movements:approve') ||
      can('repairs:read') ||
      can('repairs:write') ||
      can('maintenance:write') ||
      can('*'),
    icon: (
      <svg {...iconProps}>
        <path d="M8 4.5h8a2 2 0 0 1 2 2V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V6.5a2 2 0 0 1 2-2Z" />
        <path d="M9.5 3.5h5v2.2h-5V3.5Z" />
        <path d="M9.5 11h5M9.5 14.5h3.5" />
        <circle cx="16.2" cy="16.8" r="2.4" />
        <path d="M15.4 16.8h1.6M16.2 16v1.6" />
      </svg>
    ),
  },
  {
    to: '/master-data',
    title: MODULE.MASTER_DATA,
    blurb: MODULE_BLURB.MASTER_DATA,
    tone: 'tone-master',
    canShow: (can) =>
      can('logistics:master') ||
      can('logistics:write') ||
      can('agreements:write') ||
      can('*'),
    icon: (
      <svg {...iconProps}>
        <ellipse cx="12" cy="6.5" rx="7" ry="2.6" />
        <path d="M5 6.5v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-4" />
        <path d="M5 10.5v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-4" />
        <path d="M5 14.5v3c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-3" />
      </svg>
    ),
  },
  {
    to: '/logistics',
    title: MODULE.LOGISTICS,
    blurb: MODULE_BLURB.LOGISTICS,
    tone: 'tone-movement',
    canShow: (can) =>
      can('logistics:read') ||
      can('logistics:write') ||
      can('logistics:master') ||
      can('*'),
    icon: (
      <svg {...iconProps}>
        <path d="M3 8.2h12.2" />
        <path d="M12.4 5.2 15.8 8.2 12.4 11.2" />
        <path d="M21 15.8H8.8" />
        <path d="M11.6 12.8 8.2 15.8 11.6 18.8" />
        <rect x="3.2" y="13.6" width="4.2" height="4.4" rx="1" />
        <rect x="16.6" y="6" width="4.2" height="4.4" rx="1" />
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
    <div className="tylo-home">
      <div className="tylo-home-atmosphere" aria-hidden="true" />

      <header className="tylo-home-hero">
        <div className="tylo-home-hero-copy">
          <p className="tylo-home-kicker">TYLO One</p>
          <h1 id="tylo-modules-heading" className="tylo-home-prompt">
            {firstName ? `Welcome back, ${firstName}.` : 'Welcome back.'}
          </h1>
          <p className="tylo-home-lead">
            Open an application area to continue: Asset One, Document One, Verification One,
            Camp One, Request One, Master One, or Movement One.
          </p>
        </div>

        {canSeeDashboard && (
          <div className="tylo-home-dash-action">
            <Link className="btn tylo-home-dash-btn" to="/dashboard">
              {MODULE.DASHBOARD}
              <span aria-hidden="true"> →</span>
            </Link>
            <p className="tylo-home-dash-hint">Review any module by date range</p>
          </div>
        )}
      </header>

      <section className="tylo-home-modules" aria-labelledby="tylo-modules-heading">
        <div className="tylo-home-section-head">
          <h2 className="tylo-home-section-title">Modules</h2>
          <p className="muted tylo-home-section-note">
            {modules.length
              ? `${modules.length} available for your role`
              : 'No modules available for your role'}
          </p>
        </div>

        {!modules.length ? (
          <p className="tylo-home-empty muted">Ask an administrator to grant module access.</p>
        ) : (
          <div className="tylo-home-grid tylo-home-grid--modules">
            {modules.map((m, i) => (
              <Link
                key={m.to}
                to={m.to}
                className={`tylo-home-card ${m.tone || 'tone-primary'}`}
                style={{ '--i': i }}
              >
                <div className="tylo-home-card-top">
                  <span className="tylo-home-card-icon">{m.icon}</span>
                </div>
                <div className="tylo-home-card-body">
                  <h2>{m.title}</h2>
                  <p>{m.blurb}</p>
                </div>
                <span className="tylo-home-card-cta">
                  Open
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
