import { NavLink, Outlet } from 'react-router-dom';
import { MODULE, NAV } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';

const NAV_ITEMS = [
  { to: '/finance', end: true, label: NAV.OVERVIEW },
  { to: '/finance/expenses', end: false, label: NAV.EXPENSES },
  { to: '/finance/invoices', end: false, label: NAV.INVOICES },
  { to: '/finance/proforma', end: false, label: NAV.PROFORMA },
  { to: '/finance/purchase-orders', end: false, label: NAV.PURCHASE_ORDERS },
  { to: '/finance/generate-invoice', end: false, label: NAV.GENERATE_INVOICE },
];

export default function FinanceLayout() {
  const { can } = useAuth();
  const canWrite = can('finance:write') || can('*');
  const allowed = can('finance:read') || canWrite;

  const navItems = NAV_ITEMS.filter((item) => {
    if (canWrite) return true;
    return item.to !== '/finance/generate-invoice';
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

  return (
    <div className="finance-shell logistics-shell">
      <PageShell
        breadcrumbs={[{ to: '/', label: MODULE.HOME }, { label: MODULE.FINANCE }]}
        title={MODULE.FINANCE}
        description="Track expenses, vendor invoices, proforma, purchase orders, and client billing."
      >
        <nav className="logistics-nav" aria-label={`${MODULE.FINANCE} sections`}>
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
        <Outlet />
      </PageShell>
    </div>
  );
}
