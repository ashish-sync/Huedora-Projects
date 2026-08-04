import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import './assetInventory.css';
import { MODULE, MODULE_BLURB, NAV } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';
import ModuleSubNav from '../../components/ui/ModuleSubNav.jsx';

const NAV_ITEMS = [
  { to: '/asset-one', end: true, label: NAV.ASSETS_OVERVIEW },
];

export default function AssetInventoryLayout() {
  const { can } = useAuth();
  const [pageActions, setPageActions] = useState(null);
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
        description={MODULE_BLURB.ASSET_INVENTORY}
        actions={pageActions}
      >
        <ModuleSubNav
          className="asset-one-nav"
          ariaLabel={`${MODULE.ASSET_INVENTORY} sections`}
          items={NAV_ITEMS}
        />
        <Outlet context={{ setPageActions }} />
      </PageShell>
    </div>
  );
}
