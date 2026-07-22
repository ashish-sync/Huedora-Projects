import { NavLink, Outlet } from 'react-router-dom';
import { MODULE, NAV } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';

const NAV_ITEMS = [
  { to: '/logistics', end: true, label: NAV.OVERVIEW },
  { to: '/logistics/inward', label: NAV.GOODS_RECEIPT },
  { to: '/logistics/outward', label: NAV.GOODS_ISSUE },
  { to: '/logistics/usage', label: NAV.CONSUMPTION },
  { to: '/logistics/output', label: NAV.PRODUCTION_OUTPUT },
];

export default function LogisticsLayout() {
  const { can } = useAuth();
  const allowed =
    can('logistics:read') || can('logistics:write') || can('logistics:master') || can('*');

  if (!allowed) {
    return (
      <PageShell
        breadcrumbs={[{ to: '/', label: MODULE.HOME }, { label: MODULE.LOGISTICS }]}
        title={MODULE.LOGISTICS}
      >
        <p className="muted">You do not have access to {MODULE.LOGISTICS}.</p>
      </PageShell>
    );
  }

  return (
    <div className="logistics-shell">
      <PageShell
        breadcrumbs={[{ to: '/', label: MODULE.HOME }, { label: MODULE.LOGISTICS }]}
        title={MODULE.LOGISTICS}
        description="Goods receipt for all product types, plus goods issue, consumption, and production output. Agreements and custody for Medical / Non-Medical Devices are in Asset One."
      >
        <nav className="logistics-nav" aria-label={`${MODULE.LOGISTICS} sections`}>
          {NAV_ITEMS.map((item) => (
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
