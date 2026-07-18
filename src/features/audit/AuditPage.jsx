import { useEffect, useState } from 'react';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';

export default function AuditPage() {
  const { can } = useAuth();
  const [rows, setRows] = useState([]);
  const [action, setAction] = useState('');
  const [error, setError] = useState('');

  if (!can('audit:read')) return <p className="error">No audit access</p>;

  const load = () => {
    const q = action ? `?action=${encodeURIComponent(action)}` : '';
    api(`/audit-logs${q}`)
      .then((r) => setRows(r.data))
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <PageShell
      breadcrumbs={[{ to: '/', label: 'Modules' }, { label: 'Audit log' }]}
      title="Audit log"
      description="Activity history for agreements, assets, and administration."
      toolbar={
        <>
          <input
            style={{ flex: 1, minWidth: 200 }}
            placeholder="Filter by action code"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
          <button className="btn secondary" type="button" onClick={load}>
            Search
          </button>
        </>
      }
    >
      {error && <p className="error">{error}</p>}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a._id}>
                <td>{new Date(a.at).toLocaleString()}</td>
                <td>{a.actorEmail || a.actorType}</td>
                <td>
                  <code className="mono-sm">{a.action}</code>
                </td>
                <td>
                  {a.entityType || '-'} {a.entityId ? String(a.entityId).slice(-6) : ''}
                </td>
                <td>{a.result}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
