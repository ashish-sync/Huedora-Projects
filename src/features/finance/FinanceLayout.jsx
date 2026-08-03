import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { MODULE, MODULE_BLURB, NAV } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';
import ModuleSubNav from '../../components/ui/ModuleSubNav.jsx';
import { FINANCE_BUILDER_EDITOR_ROUTE } from './financeBuilderRoutes.js';

const NAV_ITEMS = [
  { to: '/finance', end: true, label: NAV.OVERVIEW },
  { to: '/finance/camp-payouts', end: true, label: NAV.CAMP_PAYOUTS },
  { to: '/finance/build', end: true, label: NAV.INVOICE_BUILDER, writeOnly: true },
  { to: '/finance/master', end: true, label: NAV.ORG_MASTER },
];

export default function FinanceLayout() {
  const { pathname } = useLocation();
  const isEditor = FINANCE_BUILDER_EDITOR_ROUTE.test(pathname) || pathname === '/finance/build';
  const { can } = useAuth();
  const canWrite = can('finance:write') || can('*');
  const allowed = can('finance:read') || canWrite;

  const navItems = NAV_ITEMS.filter((item) => (item.writeOnly ? canWrite : true));

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

  if (isEditor && !canWrite) {
    return <Navigate to="/finance" replace />;
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
