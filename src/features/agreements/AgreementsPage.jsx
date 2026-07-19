import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, downloadExcel } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import { MODULE } from '../../shared/labels.js';
import PageShell, { EmptyState } from '../../components/ui/PageShell.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';

const STATUS_META = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  SENT: { label: 'Pending signature', tone: 'info' },
  PARTIALLY_SIGNED: { label: 'Partially signed', tone: 'warn' },
  COMPLETED: { label: 'Completed', tone: 'ok' },
  ACTIVE: { label: 'Active', tone: 'ok' },
  DECLINED: { label: 'Declined', tone: 'danger' },
  TERMINATED: { label: 'Terminated', tone: 'neutral' },
};

export default function AgreementsPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [error, setError] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [listMeta, setListMeta] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [listLoading, setListLoading] = useState(false);

  useEffect(() => {
    setStatus(searchParams.get('status') || '');
  }, [searchParams]);

  const setFilter = (next) => {
    const value = next || '';
    setStatus(value);
    setPage(1);
    if (value) setSearchParams({ status: value });
    else setSearchParams({});
  };

  const load = () => {
    setListLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    Promise.all([api(`/agreements?${params}`), api('/agreements/stats')])
      .then(([list, st]) => {
        setRows(list.data);
        setListMeta(list.meta || { page, limit, total: 0, pages: 0 });
        setStats(st.data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setListLoading(false));
  };

  const downloadMaster = async () => {
    setError('');
    setExportBusy(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (status) params.set('status', status);
      const qs = params.toString();
      await downloadExcel(`/agreements/export${qs ? `?${qs}` : ''}`, 'Agreements.xlsx');
    } catch (err) {
      setError(err.message);
    } finally {
      setExportBusy(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page, limit]);

  const pipeline = useMemo(
    () => [
      { key: 'DRAFT', label: 'Drafts', value: stats?.DRAFT || 0 },
      {
        key: 'SENT,PARTIALLY_SIGNED',
        label: 'Pending signature',
        value: (stats?.SENT || 0) + (stats?.PARTIALLY_SIGNED || 0),
      },
      { key: 'TERMINATED', label: 'Terminated', value: stats?.TERMINATED || 0 },
      { key: 'ACTIVE', label: 'Active', value: stats?.ACTIVE || 0 },
    ],
    [stats]
  );

  const filteredEmpty = !rows.length && (!!status || !!q.trim());

  return (
    <PageShell
      breadcrumbs={[{ to: '/', label: MODULE.HOME }]}
      title={MODULE.DOCUMENT_HUB}
      actions={
        <>
          <button
            className="btn secondary"
            type="button"
            disabled={exportBusy}
            onClick={downloadMaster}
          >
            {exportBusy ? 'Downloading…' : 'Download Excel'}
          </button>
          {can('agreements:write') ? (
            <button className="btn" type="button" onClick={() => navigate('/agreements/new')}>
              New agreement
            </button>
          ) : null}
        </>
      }
      kpis={pipeline.map((p) => ({
        key: p.key,
        label: p.label,
        value: p.value,
        active: status === p.key,
        onClick: () => setFilter(status === p.key ? '' : p.key),
      }))}
      toolbar={
        <div className="filter-bar agreements-filters">
          <input
            className="esign-search"
            placeholder="Search title, party, agreement #"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            aria-label="Search agreements"
          />
          <AdaptiveSelect
            className="filter-select"
            value={status}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Drafts</option>
            <option value="SENT,PARTIALLY_SIGNED">Pending signature</option>
            <option value="TERMINATED">Terminated</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="DECLINED">Declined</option>
          </AdaptiveSelect>
          <button className="btn secondary" type="button" onClick={load}>
            Search
          </button>
          {status && (
            <button type="button" className="filter-chip" onClick={() => setFilter('')}>
              Clear
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
      }
    >
      {error && <p className="error">{error}</p>}

      <div className="card card--flush table-wrap esign-table">
        <table>
          <thead>
            <tr>
              <th>Document</th>
              <th>Type</th>
              <th>Counterparty</th>
              <th>Signers</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const meta = STATUS_META[a.status] || { label: a.status, tone: 'neutral' };
              const done = (a.signers || []).filter(
                (s) => s.status === 'SIGNED' || s.status === 'ACKNOWLEDGED'
              ).length;
              const total = (a.signers || []).length;
              return (
                <tr key={a._id} className="esign-row" onClick={() => navigate(`/agreements/${a._id}`)}>
                  <td>
                    <div className="esign-doc-title">{a.title || 'Untitled'}</div>
                    <div className="muted mono-sm">{a.agreementNumber}</div>
                  </td>
                  <td>{a.type === 'TEMPORARY_OWNERSHIP' ? 'Temporary ownership' : 'Lease'}</td>
                  <td>
                    <div>{a.partyName}</div>
                    <div className="muted mono-sm">{a.partyEmail || '-'}</div>
                  </td>
                  <td>{total ? `${done}/${total}` : '-'}</td>
                  <td>
                    <span className={`badge tone-${meta.tone}`}>{meta.label}</span>
                  </td>
                  <td className="muted">{a.updatedAt ? new Date(a.updatedAt).toLocaleString() : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <PaginationBar
          page={listMeta.page || page}
          limit={limit}
          total={listMeta.total || 0}
          pages={listMeta.pages || 0}
          loading={listLoading}
          onPageChange={setPage}
          onLimitChange={(n) => {
            setLimit(n);
            setPage(1);
          }}
        />
        {!rows.length && (
          <EmptyState
            title={filteredEmpty ? 'No matching documents' : 'No documents yet'}
            description={
              filteredEmpty
                ? 'Try another pipeline tab or clear the filter.'
                : 'Create a lease or temporary-ownership agreement and send it for signature.'
            }
            action={
              filteredEmpty ? (
                <button className="btn secondary" type="button" onClick={() => setFilter('')}>
                  Clear filter
                </button>
              ) : (
                can('agreements:write') && (
                  <button className="btn" type="button" onClick={() => navigate('/agreements/new')}>
                    New agreement
                  </button>
                )
              )
            }
          />
        )}
      </div>
    </PageShell>
  );
}
