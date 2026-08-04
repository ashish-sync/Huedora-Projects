import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { MODULE, MODULE_BLURB, NAV } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';
import ModuleSubNav from '../../components/ui/ModuleSubNav.jsx';
import { canManageOrganisationMaster } from './builder/commercialApproval.js';
import { FINANCE_BUILDER_EDITOR_ROUTE } from './financeBuilderRoutes.js';

const NAV_ITEMS = [
  { to: '/finance-one/billing', end: false, label: NAV.BILLING_CENTER },
  { to: '/finance-one/vendor-bills', end: false, label: NAV.VENDOR_BILLS },
  { to: '/finance-one/payouts', end: true, label: NAV.PAYOUT_QUEUE },
];

const ORG_MASTER_NAV = { to: '/finance-one/organisation', end: true, label: NAV.ORG_MASTER };

export default function FinanceLayout() {
  const { pathname } = useLocation();
  const isEditor = FINANCE_BUILDER_EDITOR_ROUTE.test(pathname);
  const { can, user } = useAuth();
  const canWrite = can('finance:write') || can('*');
  const allowed = can('finance:read') || canWrite;
  const canOrgMaster = canManageOrganisationMaster(user);

  const navItems = canOrgMaster ? [...NAV_ITEMS, ORG_MASTER_NAV] : NAV_ITEMS;

  if (!allowed) {
    return (
      <PageShell
        breadcrumbs={[{ to: '/', label: MODULE.HOME }, { label: MODULE.FINANCE }]}
        title={MODULE.FINANCE}
      >
        <p className="muted">You do not have access to {MODULE.FINANCE}.</p>
      </PageShell>
    );
  }

  if (pathname.startsWith('/finance-one/organisation') && !canOrgMaster) {
    return <Navigate to="/finance-one/billing" replace />;
  }

  if (isEditor && !canWrite) {
    return <Navigate to="/finance-one/billing" replace />;
  }

  if (isEditor) {
    return (
      <div className="finance-shell finance-shell--editor">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="finance-shell logistics-shell">
      <PageShell
        breadcrumbs={[{ to: '/', label: MODULE.HOME }, { label: MODULE.FINANCE }]}
        title={MODULE.FINANCE}
        description={MODULE_BLURB.FINANCE}
      >
        <ModuleSubNav
          ariaLabel={`${MODULE.FINANCE} sections`}
          items={navItems}
        />
        <Outlet />
      </PageShell>
    </div>
  );
}