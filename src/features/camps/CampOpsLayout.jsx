import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { CampManageHeaderActions } from './components/CampManageHeaderActions.jsx';
import { ChartsEyeToggle } from './components/DashboardWidgets.jsx';
import { useCampOpsAuth } from './useCampOpsAuth.js';
import PageShell from '../../components/ui/PageShell.jsx';
import { MODULE, MODULE_BLURB, NAV } from '../../shared/labels.js';
import './campOps.css';
import './campOps.theme.css';

const pageTitles = {
  '/camps': { title: 'Dashboard', subtitle: 'Camp operations overview' },
  '/camps/manage': { title: 'Camps', subtitle: 'Review, approve, execute and manage camps' },
  '/camps/import': { title: 'Excel Import', subtitle: 'Upload, map headers, preview and import camps' },
  '/camps/chargesheet': { title: NAV.CHARGESHEET, subtitle: 'Prepare and reconcile camp chargesheets' },
  '/camps/payout': { title: NAV.PAYOUT, subtitle: 'Track camp payouts and settlement status' },
  '/camps/communications/paste': { title: 'Manual Paste', subtitle: 'Paste camp details, extract fields, and create camps' },
  '/camps/communications/email': { title: 'Manual Paste', subtitle: 'Review inbox, extract camps, and manage email rules' },
};

function getPageMeta(pathname) {
  if (pathname.endsWith('/edit')) {
    return { title: 'Edit Camp', subtitle: 'Correct camp details and save until execution' };
  }
  if (pathname === '/camps/manage/new') {
    return { title: 'Create Camp', subtitle: 'Add a new camp manually' };
  }
  return pageTitles[pathname] || { title: MODULE.CAMP_MANAGEMENT, subtitle: MODULE_BLURB.CAMP_MANAGEMENT };
}

function isCampsListRoute(pathname) {
  return pathname === '/camps/manage';
}

export default function CampOpsLayout() {
  const { hasPermission } = useCampOpsAuth();
  const { pathname } = useLocation();
  const meta = getPageMeta(pathname);
  const [showCharts, setShowCharts] = useState(false);
  const isDashboard = pathname === '/camps';
  const isCampsList = isCampsListRoute(pathname);

  const allowed =
    hasPermission('camps:read')
    || hasPermission('camps:create')
    || hasPermission('camps:approve')
    || hasPermission('camps:request');

  useEffect(() => {
    if (!isDashboard) setShowCharts(false);
  }, [isDashboard]);

  const breadcrumbs = useMemo(() => {
    const items = [
      { to: '/', label: MODULE.HOME },
      pathname === '/camps'
        ? { label: MODULE.CAMP_MANAGEMENT }
        : { to: '/camps', label: MODULE.CAMP_MANAGEMENT },
    ];
    if (pathname !== '/camps' && meta.title) {
      items.push({ label: meta.title });
    }
    return items;
  }, [pathname, meta.title]);

  const navItems = useMemo(() => {
    const items = [
      { to: '/camps', end: true, label: 'Dashboard', show: true },
      { to: '/camps/manage', end: false, label: 'Camps', show: hasPermission('camps:read') },
      {
        to: '/camps/chargesheet',
        end: false,
        label: NAV.CHARGESHEET,
        show: hasPermission('camps:read'),
      },
      {
        to: '/camps/payout',
        end: false,
        label: NAV.PAYOUT,
        show: hasPermission('camps:read'),
      },
      {
        to: '/camps/communications',
        end: false,
        label: 'Manual Paste',
        show: hasPermission('communications:read'),
      },
    ];
    return items.filter((item) => item.show);
  }, [hasPermission]);

  if (!allowed) {
    return (
      <div className="camp-ops-root">
        <PageShell
          breadcrumbs={[{ to: '/', label: MODULE.HOME }, { label: MODULE.CAMP_MANAGEMENT }]}
          title={MODULE.CAMP_MANAGEMENT}
        >
          <p className="muted">You do not have access to {MODULE.CAMP_MANAGEMENT}.</p>
          <Link to="/" className="btn secondary">Back to Home</Link>
        </PageShell>
      </div>
    );
  }

  const actions = isDashboard ? (
    <ChartsEyeToggle
      showCharts={showCharts}
      onToggle={() => setShowCharts((value) => !value)}
    />
  ) : isCampsList ? (
    <CampManageHeaderActions />
  ) : null;

  return (
    <div className="camp-ops-root logistics-shell">
      <PageShell
        breadcrumbs={breadcrumbs}
        title={meta.title}
        description={meta.subtitle || MODULE_BLURB.CAMP_MANAGEMENT}
        actions={actions}
      >
        <nav className="logistics-nav" aria-label={`${MODULE.CAMP_MANAGEMENT} sections`}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `logistics-nav-link${isActive ? ' is-active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="camp-ops-page-content">
          <Outlet context={{ showCharts }} />
        </div>
      </PageShell>
    </div>
  );
}
