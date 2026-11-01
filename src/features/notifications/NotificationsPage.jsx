import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, downloadExcel } from '../../shared/api.js';
import { formatDateTime } from '../../shared/dateFormat.js';
import { MODULE } from '../../shared/labels.js';
import PageShell, { EmptyState } from '../../components/ui/PageShell.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import { emitNotificationsChanged } from '../../shared/notificationSound.js';
import {
  categoryLabel,
  isApprovalRequestNotification,
  notificationEntityPath,
  priorityClass,
} from './notificationLinks.js';
import {
  decisionLabel,
  inboxDecisionFor,
} from './notificationDecision.js';
import { notificationImportanceLabel, notificationModuleLabel } from '../dashboards/opsReviewCatalog.js';
import { OpsReviewSlot } from '../dashboards/OpsReviewHeader.jsx';
import './notifications.css';

const PAGE_SIZE = 25;

const INBOX_TABS = [
  { id: 'approvals', label: 'My Approvals', category: 'approvals' },
  { id: 'reviews', label: 'My Reviews', category: 'reviews' },
  { id: 'team', label: 'My Team Activity', category: 'team' },
  { id: 'all', label: 'All', category: '' },
];

function inboxTabFromUrl(searchParams) {
  const raw = String(searchParams.get('inbox') || searchParams.get('tab') || '').toLowerCase();
  if (raw === 'updates') return 'team';
  return INBOX_TABS.some((t) => t.id === raw) ? raw : 'approvals';
}

export default function NotificationsPage({ embedded = false } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = inboxTabFromUrl(searchParams);
  const fyiFromUrl = searchParams.get('fyi') === '1' || searchParams.get('informational') === '1';
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: PAGE_SIZE, total: 0, pages: 0 });
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState('');
  const [inboxTab, setInboxTab] = useState(initialTab);
  const [unreadOnly, setUnreadOnly] = useState(true);
  const [priority, setPriority] = useState('');
  const [module, setModule] = useState('');
  const [showInformational, setShowInformational] = useState(
    initialTab === 'updates' && fyiFromUrl
  );
  const [q, setQ] = useState('');
  const [expandedId, setExpandedId] = useState('');
  const [busyId, setBusyId] = useState('');

  const activeTab = INBOX_TABS.find((t) => t.id === inboxTab) || INBOX_TABS[0];

  const load = useCallback(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    if (unreadOnly) params.set('unread', 'true');
    if (priority) params.set('priority', priority);
    if (module) params.set('module', module);
    if (q.trim()) params.set('q', q.trim());
    if (activeTab.category) params.set('category', activeTab.category);
    // Updates hide low-signal FYI (informational) unless opted in.
    if (activeTab.category === 'updates' && showInformational) {
      params.set('informational', '1');
    }
    return api(`/notifications?${params}`)
      .then((r) => {
        setRows(r.data || []);
        setMeta(r.meta || { page, limit: PAGE_SIZE, total: (r.data || []).length, pages: 1 });
        emitNotificationsChanged();
      })
      .catch((e) => setError(e.message));
  }, [unreadOnly, priority, module, showInformational, q, page, activeTab.category]);

  useEffect(() => {
    const next = inboxTabFromUrl(searchParams);
    if (next !== inboxTab) {
      setInboxTab(next);
    }
    const wantFyi = searchParams.get('fyi') === '1' || searchParams.get('informational') === '1';
    if (next === 'team' || inboxTab === 'team') {
      setShowInformational(wantFyi);
    }
  }, [searchParams, inboxTab]);

  const selectInboxTab = (tabId) => {
    setInboxTab(tabId);
    const next = new URLSearchParams(searchParams);
    next.delete('fyi');
    next.delete('informational');
    if (embedded) {
      next.delete('tab');
      if (tabId === 'approvals') next.delete('inbox');
      else next.set('inbox', tabId);
      setSearchParams(next, { replace: true });
      return;
    }
    next.delete('inbox');
    if (tabId === 'approvals') next.delete('tab');
    else next.set('tab', tabId);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    setPage(1);
  }, [unreadOnly, priority, module, showInformational, q, inboxTab]);

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
      const body = activeTab.category ? { category: activeTab.category } : {};
      await api('/notifications/read-all', { method: 'POST', body });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const decide = async (n, decision) => {
    const action = inboxDecisionFor(n);
    if (!action) return;
    const path = decision === 'approve' ? action.approvePath : action.rejectPath;
    if (!path) return;
    setBusyId(`${n._id}:${decision}`);
    setError('');
    try {
      let reason = '';
      if (decision !== 'approve') {
        reason = window.prompt(`${action.rejectLabel || 'Refuse'} reason (optional)`) || '';
      }
      await api(path, {
        method: 'POST',
        body: decision === 'approve' ? {} : { reason, rejectionReason: reason, remarks: reason },
      });
      try {
        await api(`/notifications/${n._id}/actioned`, {
          method: 'POST',
          body: { decision },
        });
      } catch {
        /* Domain action already succeeded; inbox stamp is best-effort. */
      }
      setRows((prev) =>
        prev.map((row) => (
          row._id === n._id
            ? {
                ...row,
                readAt: row.readAt || new Date().toISOString(),
                meta: { ...(row.meta || {}), decision },
              }
            : row
        ))
      );
      emitNotificationsChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId('');
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

  const emptyCopy =
    inboxTab === 'approvals'
      ? {
          title: 'No approval requests',
          description: 'Items that need your approval will appear here.',
        }
      : inboxTab === 'reviews'
        ? {
            title: 'No reviews',
            description: 'Exceptions that need your attention will appear here.',
          }
        : inboxTab === 'team'
        ? {
            title: 'No team activity',
            description: 'Updates from your direct reports will appear here.',
          }
        : {
            title: 'No notifications',
            description: 'New alerts will appear here.',
          };

  const filtersDirty = Boolean(q || priority || module || !unreadOnly || showInformational);

  const clearFilters = () => {
    setQ('');
    setUnreadOnly(true);
    setPriority('');
    setModule('');
    setShowInformational(false);
    const next = new URLSearchParams(searchParams);
    next.delete('fyi');
    next.delete('informational');
    setSearchParams(next, { replace: true });
  };

  const inboxFilters = (
    <>
      <label className="ops-review-header__filter nc-inbox-filter--search">
        <span>Search</span>
        <input
          className="ops-filter-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Message or person"
          aria-label="Search updates"
        />
      </label>
      <label className="ops-review-header__filter">
        <span>Waiting</span>
        <AdaptiveSelect
          value={unreadOnly ? 'unread' : 'all'}
          onChange={(e) => setUnreadOnly(e.target.value === 'unread')}
          aria-label="Filter by read state"
        >
          <option value="unread">Waiting for you</option>
          <option value="all">Seen and waiting</option>
        </AdaptiveSelect>
      </label>
      <label className="ops-review-header__filter">
        <span>Importance</span>
        <AdaptiveSelect
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          aria-label="Filter by importance"
        >
          <option value="">All importance</option>
          <option value="informational">For your information</option>
          <option value="important">Important</option>
          <option value="critical">Needs attention now</option>
        </AdaptiveSelect>
      </label>
      <label className="ops-review-header__filter">
        <span>{embedded ? 'Source' : 'Module'}</span>
        <AdaptiveSelect
          value={module}
          onChange={(e) => setModule(e.target.value)}
          aria-label="Filter by module"
        >
          <option value="">All modules</option>
          <option value="camp">Camp One</option>
          <option value="finance">Finance One</option>
          <option value="assets">Asset One / Requests</option>
          <option value="documents">Document One</option>
          <option value="masters">Master One</option>
          <option value="system">Tylo One</option>
        </AdaptiveSelect>
      </label>
      <div className="nc-inbox-filter-actions">
        <button
          className="btn secondary"
          type="button"
          onClick={clearFilters}
          disabled={!filtersDirty}
        >
          Clear
        </button>
      </div>
    </>
  );

  const inboxTabs = (
    <div className="nc-tabs" role="tablist" aria-label="Notification inbox">
      {INBOX_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={inboxTab === tab.id}
          className={`nc-tab${inboxTab === tab.id ? ' is-active' : ''}`}
          onClick={() => selectInboxTab(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  return (
    <PageShell
      className={embedded ? '' : 'nc-inbox-page'}
      bare={embedded}
      breadcrumbs={embedded ? [] : [{ to: '/', label: MODULE.HOME }, { label: MODULE.INBOX }]}
      title={embedded ? '' : MODULE.INBOX}
      description={
        embedded
          ? ''
          : 'Approvals need a decision. Updates tell you what changed. Everyday notices stay hidden unless you ask for them.'
      }
      actions={
        <button
          className="btn secondary"
          type="button"
          onClick={markAllRead}
          disabled={(meta.total || 0) === 0 && rows.length === 0}
        >
          {inboxTab === 'approvals'
            ? 'Mark approvals seen'
            : inboxTab === 'reviews'
              ? 'Mark reviews seen'
              : inboxTab === 'team'
                ? 'Mark team activity seen'
                : 'Mark all seen'}
        </button>
      }
    >
      {embedded ? (
        <OpsReviewSlot totalLabel="Total updates" totalValue={meta.total ?? rows.length}>
          {inboxFilters}
        </OpsReviewSlot>
      ) : (
        <div className="ops-review-header nc-inbox-header">
          <div className="ops-review-header__meta nc-inbox-meta">
            <div className="nc-inbox-totals">
              <div className="ops-review-header__total">
                <span className="ops-review-header__total-label">Waiting</span>
                <strong className="ops-review-header__total-value">{unread}</strong>
              </div>
              <div className="ops-review-header__total">
                <span className="ops-review-header__total-label">In this view</span>
                <strong className="ops-review-header__total-value">{meta.total ?? rows.length}</strong>
              </div>
            </div>
            <form
              className="ops-review-header__filters"
              aria-label="Inbox filters"
              onSubmit={(e) => e.preventDefault()}
            >
              {inboxFilters}
            </form>
          </div>
          {inboxTabs}
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {embedded ? inboxTabs : null}

      <div className="card card--flush nc-list">
        {rows.map((n) => {
          const href = notificationEntityPath(n);
          const changes = Array.isArray(n.changes) ? n.changes : [];
          const open = expandedId === n._id;
          const isApproval = isApprovalRequestNotification(n);
          const decision = inboxDecisionFor(n);
          const settled = decisionLabel(n.meta?.decision);
          return (
            <article
              key={n._id}
              className={`nc-card${n.readAt ? '' : ' is-unread'}${
                isApproval ? ' nc-card--approval' : ''
              }`}
            >
              <div className="nc-card__main">
                <button
                  type="button"
                  className="nc-card__content"
                  onClick={() => {
                    markRead(n);
                    setExpandedId(open ? '' : n._id);
                  }}
                >
                  <div className="nc-card__chips">
                    {!n.readAt ? (
                      <span className="nc-card__unread" aria-hidden="true" />
                    ) : null}
                    <span className={priorityClass(n.priority)}>{notificationImportanceLabel(n.priority)}</span>
                    <span className={`nc-category${isApproval ? ' nc-category--approval' : ''}`}>
                      {categoryLabel(n)}
                    </span>
                    {n.groupCount > 1 ? (
                      <span className="nc-group-count">{n.groupCount} updates</span>
                    ) : null}
                    {settled ? (
                      <span className="nc-card__settled">{settled}</span>
                    ) : null}
                  </div>
                  <h3 className="nc-card__title">{n.title}</h3>
                  {n.body ? <p className="nc-card__body">{n.body}</p> : null}
                  <p className="nc-card__meta">
                    <span>{n.readAt ? 'Seen' : 'Waiting'}</span>
                    <span>{notificationModuleLabel(n.module)}</span>
                    {n.actorEmail ? <span>{n.actorEmail}</span> : null}
                    <span>{formatDateTime(n.groupedAt || n.createdAt)}</span>
                  </p>
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
              </div>

              <div className="nc-card__actions">
                {decision ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-compact"
                      disabled={Boolean(busyId)}
                      onClick={() => decide(n, 'approve')}
                    >
                      {busyId === `${n._id}:approve` ? 'Approving…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      className="btn secondary btn-compact"
                      disabled={Boolean(busyId)}
                      onClick={() => decide(n, 'refuse')}
                    >
                      {busyId === `${n._id}:refuse`
                        ? 'Working…'
                        : (decision.rejectLabel || 'Refuse')}
                    </button>
                  </>
                ) : null}
                {href ? (
                  <Link
                    to={href}
                    className="btn secondary btn-compact"
                    onClick={() => markRead(n)}
                  >
                    {isApproval && decision ? 'Open' : isApproval ? 'Review' : 'Open'}
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
            </article>
          );
        })}
        {!rows.length && (
          <EmptyState title={emptyCopy.title} description={emptyCopy.description} />
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
