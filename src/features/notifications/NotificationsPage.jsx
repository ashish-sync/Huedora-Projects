import { useEffect, useState } from 'react';
import { api, downloadExcel } from '../../shared/api.js';
import { formatDateTime } from '../../shared/dateFormat.js';
import { MODULE } from '../../shared/labels.js';
import PageShell, { EmptyState } from '../../components/ui/PageShell.jsx';
import { emitNotificationsChanged } from '../../shared/notificationSound.js';

export default function NotificationsPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState('');

  const load = () =>
    api('/notifications')
      .then((r) => {
        setRows(r.data);
        emitNotificationsChanged();
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const unread = rows.filter((n) => !n.readAt).length;

  const markRead = async (n) => {
    if (n.readAt) return;
    try {
      await api(`/notifications/${n._id}/read`, { method: 'POST', body: {} });
      setRows((prev) =>
        prev.map((row) =>
          row._id === n._id ? { ...row, readAt: new Date().toISOString() } : row
        )
      );
      emitNotificationsChanged();
    } catch (e) {
      setError(e.message);
    }
  };

  const markAllRead = async () => {
    setError('');
    try {
      await api('/notifications/read-all', { method: 'POST', body: {} });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const downloadReport = async (n) => {
    const path = n.meta?.downloadPath || `/notifications/${n._id}/error-report`;
    const fileName = n.meta?.fileName || 'Import_Errors.xlsx';
    setDownloadingId(n._id);
    setError('');
    try {
      await downloadExcel(path, fileName);
      await markRead(n);
    } catch (e) {
      setError(e.message);
    } finally {
      setDownloadingId('');
    }
  };

  return (
    <PageShell
      breadcrumbs={[{ to: '/', label: MODULE.HOME }, { label: 'Notifications' }]}
      title="Notifications"
      description="Alerts for agreements, movements, verification, imports, and system events."
      actions={
        <button className="btn secondary" type="button" onClick={markAllRead} disabled={!unread}>
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
            className={`notification-row${n.readAt ? '' : ' is-unread'}`}
            role="button"
            tabIndex={0}
            onClick={() => markRead(n)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                markRead(n);
              }
            }}
            style={{
              paddingBottom: 12,
              borderBottom: '1px solid var(--line)',
              opacity: n.readAt ? 0.65 : 1,
              cursor: n.readAt ? 'default' : 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!n.readAt ? <span className="header-bell-badge notification-unread-dot" aria-hidden="true" /> : null}
              <strong>{n.title}</strong>
            </div>
            <div className="muted">{n.body}</div>
            <div className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
              {n.type} · {formatDateTime(n.createdAt)}
            </div>
            {n.type === 'IMPORT_ERRORS' && n.meta?.downloadPath ? (
              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="btn secondary btn-compact"
                  disabled={downloadingId === n._id}
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadReport(n);
                  }}
                >
                  {downloadingId === n._id
                    ? 'Downloading…'
                    : `Download error report${n.meta?.errorRows ? ` (${n.meta.errorRows})` : ''}`}
                </button>
              </div>
            ) : null}
          </div>
        ))}
        {!rows.length && (
          <EmptyState title="No notifications" description="New alerts will appear here." />
        )}
      </div>
    </PageShell>
  );
}
