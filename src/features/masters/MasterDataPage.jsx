import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MODULE } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';
import LogisticsMasterPage from '../logistics/LogisticsMasterPage.jsx';

export default function MasterDataPage() {
  const { can } = useAuth();
  const [params] = useSearchParams();
  const scope = params.get('scope') || 'all';
  const entity = params.get('entity') || '';

  const allowed =
    can('logistics:master') ||
    can('logistics:write') ||
    can('agreements:write') ||
    can('agreements:read') ||
    can('camps:read') ||
    can('camps:request') ||
    can('camps:approve') ||
    can('*');

  const description = useMemo(() => {
    if (scope === 'inventory') {
      return 'Products — shared catalog for assets, inventory, and movements.';
    }
    if (scope === 'movement' || scope === 'logistics') {
      return 'Expense Master — categories and sub-categories for Finance One Requests.';
    }
    if (scope === 'document') {
      return 'Contact Directory, Document Templates, Signatures, and Picklist approvals.';
    }
    if (scope === 'camp') {
      return 'Client Master and PIN Geography for Camp One.';
    }
    return 'Shared enterprise reference data for Asset One, Movement One, Document One, Finance One, and Camp One.';
  }, [scope]);

  if (!allowed) {
    return (
      <PageShell
        breadcrumbs={[{ to: '/', label: MODULE.HOME }, { label: MODULE.MASTER_DATA }]}
        title={MODULE.MASTER_DATA}
      >
        <p className="muted">You do not have access to {MODULE.MASTER_DATA}.</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      breadcrumbs={[{ to: '/', label: MODULE.HOME }, { label: MODULE.MASTER_DATA }]}
      title={MODULE.MASTER_DATA}
      description={description}
    >
      <LogisticsMasterPage
        scope={scope}
        title="Reference data"
        initialEntity={entity}
      />
    </PageShell>
  );
}
