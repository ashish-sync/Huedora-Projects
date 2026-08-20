import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, downloadExcel } from '../../shared/api.js';
import { formatDateTime } from '../../shared/dateFormat.js';
import { MODULE } from '../../shared/labels.js';
import PageShell, { EmptyState } from '../../components/ui/PageShell.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import MasterFilterShell from '../../components/masters/MasterFilterShell.jsx';
import MasterSearchField from '../../components/masters/MasterSearchField.jsx';
import { emitNotificationsChanged } from '../../shared/notificationSound.js';
import {
  categoryLabel,
  notificationEntityPath,
  priorityClass,
  priorityLabel,
} from './notificationLinks.js';
import './notifications.css';

const PAGE_SIZE = 25;

export default function NotificationsPage() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: PAGE_SIZE, total: 0, pages: 0 });
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [priority, setPriority] = useState('');
  const [module, setModule] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [q, setQ] = useState('');
  const [expandedId, setExpandedId] = useState('');

  const load = useCallback(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    if (unreadOnly) params.set('unread', 'true');
    if (priority) params.set('priority', priority);
    if (module) params.set('module', module);
    if (showArchived) params.set('archive', '1');
    if (q.trim()) params.set('q', q.trim());
    return api(`/notifications?${params}`)
      .then((r) => {
        setRows(r.data || []);
        setMeta(r.meta || { page, limit: PAGE_SIZE, total: (r.data || []).length, pages: 1 });
        emitNotificationsChanged();
      })
      .catch((e) => setError(e.message));
  }, [unreadOnly, priority, module, showArchived, q, page]);

  useEffect(() => {
    setPage(1);
  }, [unreadOnly, priority, module, showArchived, q]);

  useEffect(() => {
    load();
  }, [load]);

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
      title="Notification Center"
      description="Latest alerts first — by severity, module, and read state. Routine camp saves stay in Audit Trail."
      actions={
        <button className="btn secondary" type="button" onClick={markAllRead} disabled={!unread}>
          Mark all read
        </button>
      }
      kpis={[
        { label: 'On page', value: rows.length },
        { label: 'Unread (page)', value: unread },
        { label: 'Total', value: meta.total ?? rows.length },
      ]}
    >
      {error && <p className="error">{error}</p>}

      <MasterFilterShell>
        <MasterSearchField
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, body, type…"
          aria-label="Search notifications"
        />
        <AdaptiveSelect
          value={unreadOnly ? 'unread' : 'all'}
          onChange={(e) => setUnreadOnly(e.target.value === 'unread')}
          aria-label="Filter by read state"
        >
          <option value="all">All</option>
          <option value="unread">Unread only</option>
        </AdaptiveSelect>
        <AdaptiveSelect
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          aria-label="Filter by severity"
        >
          <option value="">All severities</option>
          <option value="informational">Informational</option>
          <option value="important">Important</option>
          <option value="critical">Critical</option>
        </AdaptiveSelect>
        <AdaptiveSelect
          value={module}
          onChange={(e) => setModule(e.target.value)}
          aria-label="Filter by module"
        >
          <option value="">All modules</option>
          <option value="camp">Camp</option>
          <option value="finance">Finance</option>
          <option value="assets">Assets / Requests</option>
          <option value="documents">Documents</option>
          <option value="masters">Masters</option>
          <option value="system">System</option>
        </AdaptiveSelect>
        <AdaptiveSelect
          value={showArchived ? 'archived' : 'active'}
          onChange={(e) => setShowArchived(e.target.value === 'archived')}
          aria-label="Filter by archive"
        >
          <option value="active">Active</option>
          <option value="archived">Archived (7+ days)</option>
        </AdaptiveSelect>
      </MasterFilterShell>

      <div className="card nc-list">
        {rows.map((n) => {
          const href = notificationEntityPath(n);
          const changes = Array.isArray(n.changes) ? n.changes : [];
          const open = expandedId === n._id;
          return (
            <div
              key={n._id}
              className={`nc-row notification-row${n.readAt ? '' : ' is-unread'}`}
            >
              <button
                type="button"
                className="nc-row-main"
                onClick={() => {
                  markRead(n);
                  setExpandedId(open ? '' : n._id);
                }}
              >
                <div className="nc-row-head">
                  {!n.readAt ? (
                    <span className="header-bell-badge notification-unread-dot" aria-hidden="true" />
                  ) : null}
                  <span className={priorityClass(n.priority)}>{priorityLabel(n.priority)}</span>
                  <span className="nc-category">{categoryLabel(n)}</span>
                  <strong className="nc-title">{n.title}</strong>
                  {n.groupCount > 1 ? (
                    <span className="nc-group-count">{n.groupCount} updates</span>
                  ) : null}
                </div>
                {n.body ? <div className="muted nc-body">{n.body}</div> : null}
                <div className="muted nc-meta">
                  {n.readAt ? 'Read' : 'Unread'} · {n.module || 'system'} · {n.type}
                  {n.actorEmail ? ` · ${n.actorEmail}` : ''}
                  {' · '}
                  {formatDateTime(n.groupedAt || n.createdAt)}
                </div>
              </button>

              {open && changes.length ? (
                <ul className="nc-changes">
                  {changes.map((c) => (
                    <li key={`${c.field}-${c.to}`}>
                      <span className="nc-change-label">{c.label || c.field}</span>
                      <span className="nc-change-values">
                        <span className="nc-from">{c.from == null || c.from === '' ? '—' : c.from}</span>
                        <span aria-hidden="true"> → </span>
                        <span className="nc-to">{c.to == null || c.to === '' ? '—' : c.to}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="nc-row-actions">
                {href ? (
                  <Link
                    to={href}
                    className="btn secondary btn-compact"
                    onClick={() => markRead(n)}
                  >
                    Open
                  </Link>
                ) : null}
                {n.type === 'IMPORT_ERRORS' && (n.meta?.downloadPath || n._id) ? (
                  <button
                    type="button"
                    className="btn secondary btn-compact"
                    disabled={downloadingId === n._id}
                    onClick={() => downloadReport(n)}
                  >
                    {downloadingId === n._id
                      ? 'Downloading…'
                      : `Download error report${n.meta?.errorRows ? ` (${n.meta.errorRows})` : ''}`}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
        {!rows.length && (
          <EmptyState title="No notifications" description="New alerts will appear here." />
        )}
      </div>

      {(meta.pages || 0) > 1 ? (
        <div className="nc-pagination">
          <button
            type="button"
            className="btn secondary btn-compact"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Newer
          </button>
          <span className="muted">
            Page {meta.page || page} of {meta.pages}
          </span>
          <button
            type="button"
            className="btn secondary btn-compact"
            disabled={page >= (meta.pages || 1)}
            onClick={() => setPage((p) => p + 1)}
          >
            Older
          </button>
        </div>
      ) : null}
    </PageShell>
  );
}
