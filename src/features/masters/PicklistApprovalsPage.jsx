import { useEffect, useState } from 'react';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import { formatDateTime } from '../../shared/dateFormat.js';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';

export default function PicklistApprovalsPage({ embedded = false } = {}) {
  const { can } = useAuth();
  const canApprove =
    can('logistics:master') || can('logistics:write') || can('agreements:write') || can('*');

  const [rows, setRows] = useState([]);
  const [registry, setRegistry] = useState([]);
  const [status, setStatus] = useState('PENDING');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [loading, setLoading] = useState(false);

  const load = () => {
    if (!canApprove) return;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.set('status', status);
    return api(`/picklists/suggestions?${params}`)
      .then((r) => {
        setRows(r.data || []);
        setMeta(r.meta || { page, limit, total: 0, pages: 0 });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api('/picklists/registry')
      .then((r) => setRegistry(r.data || []))
      .catch(() => setRegistry([]));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, status]);

  const labelFor = (key) => registry.find((r) => r.key === key)?.label || key;

  const act = async (id, action) => {
    setBusyId(id);
    setError('');
    setMsg('');
    try {
      let reason = '';
      if (action === 'reject') {
        reason = window.prompt('Rejection reason (optional)') || '';
      }
      await api(`/picklists/suggestions/${id}/${action}`, {
        method: 'POST',
        body: action === 'reject' ? { reason } : {},
      });
      setMsg(action === 'approve' ? 'Value approved and added to dropdown.' : 'Suggestion rejected.');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId('');
    }
  };

  if (!canApprove) {
    return <p className="muted">You do not have permission to approve dropdown values.</p>;
  }

  return (
    <div className={embedded ? '' : 'card'}>
      {!embedded && <h3 style={{ marginTop: 0 }}>Picklist approvals</h3>}
      <p className="muted" style={{ marginTop: 0 }}>
        Custom values entered via “Other” appear here. Approve to add them to the shared dropdown.
      </p>

      {(error || msg) && (
        <div className={`am-banner ${error ? 'is-error' : 'is-info'}`} role="status">
          {error || msg}
        </div>
      )}

      <div className="toolbar" style={{ marginBottom: 12, gap: 8, display: 'flex', flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0, minWidth: 160 }}>
          <label>Status</label>
          <AdaptiveSelect
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="">All</option>
          </AdaptiveSelect>
        </div>
        <button className="btn secondary" type="button" onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>

      <div className="card card--flush table-wrap">
        <table>
          <thead>
            <tr>
              <th>Dropdown</th>
              <th>Value</th>
              <th>Status</th>
              <th>Source</th>
              <th>Requested</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}>
                <td>{labelFor(r.picklistKey)}</td>
                <td>
                  <strong>{r.value}</strong>
                </td>
                <td>
                  <span className="badge tone-neutral">{r.status}</span>
                </td>
                <td className="muted">{r.source || '-'}</td>
                <td className="muted mono-sm">
                  {r.createdAt ? formatDateTime(r.createdAt) : '-'}
                </td>
                <td>
                  {r.status === 'PENDING' && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-compact"
                        type="button"
                        disabled={busyId === r._id}
                        onClick={() => act(r._id, 'approve')}
                      >
                        Approve
                      </button>
                      <button
                        className="btn secondary btn-compact"
                        type="button"
                        disabled={busyId === r._id}
                        onClick={() => act(r._id, 'reject')}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {r.status === 'REJECTED' && r.rejectReason ? (
                    <span className="muted mono-sm">{r.rejectReason}</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationBar
          page={meta.page || page}
          limit={limit}
          total={meta.total || 0}
          pages={meta.pages || 0}
          loading={loading}
          onPageChange={setPage}
          onLimitChange={(n) => {
            setLimit(n);
            setPage(1);
          }}
        />
        {!rows.length && !loading && (
          <p className="muted" style={{ padding: '1rem' }}>
            No suggestions{status ? ` with status ${status}` : ''}.
          </p>
        )}
      </div>
    </div>
  );
}
