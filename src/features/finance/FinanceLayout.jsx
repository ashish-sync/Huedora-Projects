import { Outlet, useLocation } from 'react-router-dom';
import { MODULE, NAV } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';
import ModuleSubNav from '../../components/ui/ModuleSubNav.jsx';

const EDITOR_ROUTES = ['/finance/build', '/finance/build/proforma', '/finance/build/purchase-order', '/finance/build/credit-note'];

const NAV_ITEMS = [
  { to: '/finance', end: true, label: NAV.OVERVIEW },
  { to: '/finance/camp-payouts', end: true, label: NAV.CAMP_PAYOUTS },
  { to: '/finance/build', end: true, label: 'Invoice Builder' },
  { to: '/finance/master', end: true, label: NAV.ORG_MASTER },
];

const EDITOR_ROUTE = /^\/finance\/build(\/[\w-]+)?$/;

export default function FinanceLayout() {
  const { pathname } = useLocation();
  const isEditor = EDITOR_ROUTE.test(pathname);
  const { can } = useAuth();
  const canWrite = can('finance:write') || can('*');
  const allowed = can('finance:read') || canWrite;

  const navItems = NAV_ITEMS.filter((item) => {
    if (canWrite) return true;
    return !EDITOR_ROUTES.includes(item.to);
  });

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
        description="Create and manage commercial documents."
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
