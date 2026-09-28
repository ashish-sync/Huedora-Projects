import { Outlet } from 'react-router-dom';
import { MODULE, NAV } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';
import ModuleSubNav from '../../components/ui/ModuleSubNav.jsx';

const NAV_ITEMS = [
  { to: '/movement-one', end: true, label: NAV.OVERVIEW },
  { to: '/movement-one/inward', label: NAV.GOODS_RECEIPT },
  { to: '/movement-one/outward', label: NAV.GOODS_ISSUE },
  { to: '/movement-one/usage', label: NAV.CONSUMPTION },
  { to: '/movement-one/output', label: NAV.PRODUCTION_OUTPUT },
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
    <PageShell
      breadcrumbs={[{ to: '/', label: MODULE.HOME }, { label: MODULE.LOGISTICS }]}
      title={MODULE.LOGISTICS}
      description="Stock execution: goods receipt, goods issue, consumption, and production output. Raise and approve Goods Issuance in Request One; fulfill pack / POD / delivery here."
    >
      <ModuleSubNav
        ariaLabel={`${MODULE.LOGISTICS} sections`}
        items={NAV_ITEMS}
      />
      <Outlet />
    </PageShell>
  );
}
