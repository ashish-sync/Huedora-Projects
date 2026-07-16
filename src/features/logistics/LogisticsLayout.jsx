import { NavLink, Outlet } from 'react-router-dom';
import { MODULE } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';

const NAV = [
  { to: '/logistics', end: true, label: 'Dashboard' },
  { to: '/logistics/inward', label: 'Inward' },
  { to: '/logistics/outward', label: 'Outward' },
  { to: '/logistics/balance', label: 'Balance Stats' },
  { to: '/logistics/usage', label: 'Usage' },
  { to: '/logistics/output', label: 'Output' },
  { to: '/logistics/master', label: 'Inventory & Vendor Master' },
];

export default function LogisticsLayout() {
  const { can } = useAuth();
  const allowed = can('logistics:read') || can('logistics:write') || can('*');

  if (!allowed) {
    return (
      <PageShell
        breadcrumbs={[{ to: '/', label: 'Modules' }, { label: MODULE.INVENTORY_LOGISTICS }]}
        title={MODULE.INVENTORY_LOGISTICS}
      >
        <p className="muted">You do not have access to Inventory &amp; Logistics.</p>
      </PageShell>
    );
  }

  return (
    <div className="logistics-shell">
      <PageShell
        breadcrumbs={[{ to: '/', label: 'Modules' }, { label: MODULE.INVENTORY_LOGISTICS }]}
        title={MODULE.INVENTORY_LOGISTICS}
        description="Dashboard, inward receipts, outward dispatch, balances, and masters."
      >
        <nav className="logistics-nav" aria-label="Logistics sections">
          {NAV.map((item) => (
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
