import { useMemo, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { CampManageHeaderActions } from './components/CampManageHeaderActions.jsx';
import { CampWorkingStageSelect } from './components/CampWorkingStageSelect.jsx';
import { CampWorkingStageProvider, useCampWorkingStage } from './CampWorkingStageContext.jsx';
import { useCampOpsAuth } from './useCampOpsAuth.js';
import PageShell, { Breadcrumbs } from '../../components/ui/PageShell.jsx';
import ModuleSubNav from '../../components/ui/ModuleSubNav.jsx';
import { MODULE, MODULE_BLURB, NAV } from '../../shared/labels.js';
import { useSuppressBrowserAutofill } from '../../shared/suppressBrowserAutofill.js';
import './campOps.css';
import './campOps.theme.css';

const pageTitles = {
  '/camp-one/manage': { title: NAV.CAMP_MANAGE, subtitle: 'Review, approve, execute, and manage camps' },
  '/camp-one/communications/paste': { title: NAV.CAMP_CREATE, subtitle: 'Paste camp details, extract fields, and create camps' },
  '/camp-one/communications/email': { title: NAV.CAMP_CREATE, subtitle: 'Review inbox, extract camps, and manage email rules' },
  '/camp-one/communications/upload': { title: NAV.CAMP_CREATE, subtitle: 'Upload CSV, map columns, and import camps' },
  '/camp-one/communications/download': { title: NAV.CAMP_CREATE, subtitle: 'Download camp exports and sample import templates' },
};

function getPageMeta(pathname) {
  if (pathname.endsWith('/edit')) {
    return { title: 'Edit Camp', subtitle: 'Correct camp details and save until execution' };
  }
  if (pathname === '/camp-one/manage/new') {
    return { title: 'Create Camp', subtitle: 'Add a new camp manually' };
  }
  return pageTitles[pathname] || { title: MODULE.CAMP_MANAGEMENT, subtitle: MODULE_BLURB.CAMP_MANAGEMENT };
}

function isCampsListRoute(pathname) {
  return pathname === '/camp-one/manage';
}

function isCreateCampsRoute(pathname) {
  return pathname.startsWith('/camp-one/communications');
}

function CampOpsLayoutBody({
  breadcrumbs,
  meta,
  isCampsList,
  showCampToolbar,
  showStageSelect,
  navItems,
  showSubtitle,
}) {
  const { workingStage } = useCampWorkingStage();
  const campRootRef = useRef(null);
  useSuppressBrowserAutofill(campRootRef);
  const isRequestStage = workingStage === 'request';
  // Camps are only added at Request; other stages are progression views.
  const showRequestToolbar = showCampToolbar && isRequestStage;

  return (
    <div ref={campRootRef} className="camp-ops-root logistics-shell" data-suppress-autofill="true">
      <PageShell hideChrome className="camp-ops-page-shell">
        <header className="camp-ops-strip">
          <div className="camp-ops-strip__main">
            <Breadcrumbs items={breadcrumbs} />
            <div className="camp-ops-strip__headline">
              <div className="camp-ops-strip__title-block">
                <div className="camp-ops-strip__title-row">
                  <h2 className="topbar-title">{meta.title}</h2>
                  {navItems.length > 0 && (
                    <ModuleSubNav
                      variant="segmented"
                      ariaLabel={`${MODULE.CAMP_MANAGEMENT} sections`}
                      items={navItems}
                    />
                  )}
                </div>
                {showSubtitle && (
                  <p className="muted topbar-desc camp-ops-strip__desc">{meta.subtitle}</p>
                )}
              </div>
              {(showStageSelect || showRequestToolbar) && (
                <div className="camp-ops-strip__actions">
                  <div className="camp-ops-header-actions">
                    {showRequestToolbar ? <CampManageHeaderActions /> : null}
                    {showStageSelect ? <CampWorkingStageSelect compact /> : null}
                  </div>
                </div>
              )}
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
  const showCampToolbar = isCampsList;
  const showStageSelect = !isCreateCampsRoute(pathname);

  const allowed =
    hasPermission('camps:read')
    || hasPermission('camps:create')
    || hasPermission('camps:approve')
    || hasPermission('camps:request');

  const breadcrumbs = useMemo(() => {
    const items = [
      { to: '/', label: MODULE.HOME },
      pathname === '/camp-one/manage'
        ? { label: MODULE.CAMP_MANAGEMENT }
        : { to: '/camp-one/manage', label: MODULE.CAMP_MANAGEMENT },
    ];
    if (pathname !== '/camp-one/manage' && meta.title) {
      items.push({ label: meta.title });
    }
    return items;
  }, [pathname, meta.title]);

  const navItems = useMemo(() => {
    const items = [
      {
        to: '/camp-one/communications',
        end: false,
        label: NAV.CAMP_CREATE,
        show: hasPermission('communications:read'),
      },
      { to: '/camp-one/manage', end: false, label: NAV.CAMP_MANAGE, show: hasPermission('camps:read') },
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
        showCampToolbar={showCampToolbar}
        showStageSelect={showStageSelect}
        navItems={navItems}
        showSubtitle={!isCampsList && Boolean(meta.subtitle)}
      />
    </CampWorkingStageProvider>
  );
}
