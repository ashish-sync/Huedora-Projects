import { NavLink, Outlet } from 'react-router-dom';
import { MODULE, NAV } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';
import { ASSET_REGISTER_PRODUCT_TYPES, productTypeToSlug } from './assetProductTypes.js';

const NAV_ITEMS = [
  { to: '/asset-inventory', end: true, label: NAV.OVERVIEW },
  ...ASSET_REGISTER_PRODUCT_TYPES.map((type) => ({
    to: `/asset-inventory/types/${productTypeToSlug(type)}`,
    end: false,
    label: type,
  })),
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
        description="Agreements and custody for Medical and Non-Medical Devices. Record inward for every product type in Movement One → Goods Receipt."
      >
        <nav className="logistics-nav asset-one-nav" aria-label={`${MODULE.ASSET_INVENTORY} sections`}>
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
