import { useMemo } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { CampManageHeaderActions } from './components/CampManageHeaderActions.jsx';
import { CampWorkingStageSelect } from './components/CampWorkingStageSelect.jsx';
import { CampWorkingStageProvider } from './CampWorkingStageContext.jsx';
import { useCampOpsAuth } from './useCampOpsAuth.js';
import PageShell, { Breadcrumbs } from '../../components/ui/PageShell.jsx';
import { MODULE, MODULE_BLURB } from '../../shared/labels.js';
import './campOps.css';
import './campOps.theme.css';

const pageTitles = {
  '/camps/manage': { title: 'Camps', subtitle: 'Review, approve, execute and manage camps' },
  '/camps/import': { title: 'Excel Import', subtitle: 'Upload, map headers, preview and import camps' },
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

function CampOpsLayoutBody({
  breadcrumbs,
  meta,
  isCampsList,
  navItems,
  showSubtitle,
}) {
  return (
    <div className="camp-ops-root logistics-shell">
      <PageShell hideChrome className="camp-ops-page-shell">
        <header className="camp-ops-strip">
          <div className="camp-ops-strip__main">
            <Breadcrumbs items={breadcrumbs} />
            <div className="camp-ops-strip__title-row">
              <h2 className="topbar-title">{meta.title}</h2>
              {navItems.length > 0 && (
                <nav className="camp-ops-inline-nav" aria-label={`${MODULE.CAMP_MANAGEMENT} sections`}>
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) => `camp-ops-inline-nav-link${isActive ? ' is-active' : ''}`}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </nav>
              )}
            </div>
            {showSubtitle && (
              <p className="muted topbar-desc camp-ops-strip__desc">{meta.subtitle}</p>
            )}
          </div>
          <div className="camp-ops-strip__actions">
            <div className="camp-ops-header-actions">
              <CampWorkingStageSelect compact />
              {isCampsList ? <CampManageHeaderActions /> : null}
            </div>
          </div>
        </header>
        <div className="camp-ops-page-content">
          <Outlet />
        </div>
      </PageShell>
    </div>
  );
}

export default function CampOpsLayout() {
  const { hasPermission } = useCampOpsAuth();
  const { pathname } = useLocation();
  const meta = getPageMeta(pathname);
  const isCampsList = isCampsListRoute(pathname);

  const allowed =
    hasPermission('camps:read')
    || hasPermission('camps:create')
    || hasPermission('camps:approve')
    || hasPermission('camps:request');

  const breadcrumbs = useMemo(() => {
    const items = [
      { to: '/', label: MODULE.HOME },
      pathname === '/camps/manage'
        ? { label: MODULE.CAMP_MANAGEMENT }
        : { to: '/camps/manage', label: MODULE.CAMP_MANAGEMENT },
    ];
    if (pathname !== '/camps/manage' && meta.title) {
      items.push({ label: meta.title });
    }
    return items;
  }, [pathname, meta.title]);

  const navItems = useMemo(() => {
    const items = [
      { to: '/camps/manage', end: false, label: 'Camps', show: hasPermission('camps:read') },
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

  return (
    <CampWorkingStageProvider>
      <CampOpsLayoutBody
        breadcrumbs={breadcrumbs}
        meta={meta}
        isCampsList={isCampsList}
        navItems={navItems}
        showSubtitle={!isCampsList && Boolean(meta.subtitle)}
      />
    </CampWorkingStageProvider>
  );
}
