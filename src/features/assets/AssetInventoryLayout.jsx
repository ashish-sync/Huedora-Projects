import { NavLink, Outlet } from 'react-router-dom';
import { MODULE, NAV } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';

const NAV_ITEMS = [
  { to: '/asset-inventory', end: true, label: NAV.ASSET_REGISTER },
  { to: '/asset-inventory/balance', label: NAV.STOCK_OVERVIEW },
];

export default function AssetInventoryLayout() {
  const { can } = useAuth();
  const allowed =
    can('assets:read') ||
    can('assets:write') ||
    can('devices:write') ||
    can('masters:read') ||
    can('logistics:read') ||
    can('logistics:write') ||
    can('logistics:master') ||
    can('*');

  if (!allowed) {
    return (
      <PageShell
        breadcrumbs={[{ to: '/', label: MODULE.HOME }, { label: MODULE.ASSET_INVENTORY }]}
        title={MODULE.ASSET_INVENTORY}
      >
        <p className="muted">You do not have access to {MODULE.ASSET_INVENTORY}.</p>
      </PageShell>
    );
  }

  return (
    <div className="asset-inventory-shell logistics-shell">
      <PageShell
        breadcrumbs={[{ to: '/', label: MODULE.HOME }, { label: MODULE.ASSET_INVENTORY }]}
        title={MODULE.ASSET_INVENTORY}
        description="Asset register and stock overview. Reference data is maintained in Master One."
      >
        <nav className="logistics-nav" aria-label={`${MODULE.ASSET_INVENTORY} sections`}>
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
