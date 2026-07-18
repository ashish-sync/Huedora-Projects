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
    can('*');

  const description = useMemo(() => {
    if (scope === 'inventory') {
      return 'Products.';
    }
    if (scope === 'movement' || scope === 'logistics') {
      return 'Suppliers & vendors, and expense categories.';
    }
    if (scope === 'document') {
      return 'Contact Directory, document templates, and signatures.';
    }
    return 'Enterprise reference data used across Asset One, Movement One, and Document One.';
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
