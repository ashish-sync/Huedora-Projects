import { useParams } from 'react-router-dom';
import PageShell from '../../components/ui/PageShell.jsx';
import { MODULE } from '../../shared/labels.js';
import ClientMasterFormPage from './ClientMasterFormPage.jsx';
import { clientMasterListPath } from './clientMasterPaths.js';
import './campOps.css';
import './campOps.theme.css';

export default function ClientMasterFormRoute() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const title = isEdit ? 'Edit Client Master' : 'New Client Master';
  const description = isEdit
    ? 'Update client program and camp configuration'
    : 'Add client program and camp configuration';

  return (
    <div className="camp-ops-root">
      <PageShell
        breadcrumbs={[
          { to: '/', label: MODULE.HOME },
          { to: clientMasterListPath(), label: MODULE.MASTER_DATA },
          { to: clientMasterListPath(), label: MODULE.CLIENT_MASTER },
          { label: isEdit ? 'Edit' : 'New' },
        ]}
        title={title}
        description={description}
      >
        <ClientMasterFormPage />
      </PageShell>
    </div>
  );
}
