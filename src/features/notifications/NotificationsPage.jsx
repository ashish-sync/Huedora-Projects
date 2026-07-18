import { useEffect, useState } from 'react';
import { api } from '../../shared/api.js';
import PageShell, { EmptyState } from '../../components/ui/PageShell.jsx';

export default function NotificationsPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  const load = () =>
    api('/notifications')
      .then((r) => setRows(r.data))
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const unread = rows.filter((n) => !n.readAt).length;

  return (
    <PageShell
      breadcrumbs={[{ to: '/', label: 'Modules' }, { label: 'Notifications' }]}
      title="Notifications"
      description="Alerts for agreements, movements, verification callbacks, and system events."
      actions={
        <button
          className="btn secondary"
          type="button"
          onClick={() => api('/notifications/read-all', { method: 'POST', body: {} }).then(load)}
        >
          Mark all read
        </button>
      }
      kpis={[
        { label: 'Total', value: rows.length },
        { label: 'Unread', value: unread },
      ]}
    >
      {error && <p className="error">{error}</p>}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map((n) => (
          <div
            key={n._id}
            style={{
              paddingBottom: 12,
              borderBottom: '1px solid var(--line)',
              opacity: n.readAt ? 0.65 : 1,
            }}
          >
            <strong>{n.title}</strong>
            <div className="muted">{n.body}</div>
            <div className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
              {n.type} · {new Date(n.createdAt).toLocaleString()}
            </div>
          </div>
        ))}
        {!rows.length && (
          <EmptyState title="No notifications" description="New alerts will appear here." />
        )}
      </div>
    </PageShell>
  );
}
