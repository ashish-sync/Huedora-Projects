import { useCallback, useEffect, useState } from 'react';
import FeedbackBanner from '../../components/ui/FeedbackBanner.jsx';
import { Link } from 'react-router-dom';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import MasterFilterShell from '../../components/masters/MasterFilterShell.jsx';
import MasterSearchField from '../../components/masters/MasterSearchField.jsx';
import { api, apiFetch } from '../../shared/api.js';
import { formatDate } from '../../shared/dateFormat.js';
import { useAuth } from '../../shared/auth.jsx';
import { FILTER } from '../../shared/labels.js';
import { COMMERCIAL_DOC_TYPES, docTypeLabel } from './commercialDocumentConfig.js';
import { buildEditPath, deleteCommercialDocument } from './builder/builderPersistence.js';

function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function pdfPathForRow(row) {
  const cfg = COMMERCIAL_DOC_TYPES.find((t) => t.key === row.documentType);
  return cfg ? cfg.pdfPath(row._id) : null;
}

async function downloadPdf(row) {
  const path = pdfPathForRow(row);
  if (!path) return;
  const res = await apiFetch(`${path}?download=1`);
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(row.documentNumber || row.docKey || 'document').replace(/[^\w.-]+/g, '_')}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FinanceDocumentsList({ embedded = false, showCreateLink = true }) {
  const { can } = useAuth();
  const canWrite = can('finance:write') || can('*');

  const [rows, setRows] = useState([]);
  const [listMeta, setListMeta] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [error, setError] = useState('');
  const [listLoading, setListLoading] = useState(false);

  const load = useCallback(async () => {
    setListLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q.trim()) params.set('q', q.trim());
      if (status) params.set('status', status);
      if (documentType) params.set('documentType', documentType);
      const res = await api(`/finance/commercial-documents?${params}`);
      setRows(res.data || []);
      setListMeta(res.meta || { page, limit, total: 0, pages: 0 });
    } catch (e) {
      setError(e.message);
      setRows([]);
    } finally {
      setListLoading(false);
    }
  }, [page, limit, q, status, documentType]);

  useEffect(() => {
    load();
  }, [load]);

  const content = (
    <>
      <div className={`finance-docs-head${embedded ? ' finance-docs-head--embedded' : ''}`}>
        <h3 className="finance-docs-title">Saved documents</h3>
        {showCreateLink && canWrite ? (
          <Link to="/finance/build" className="btn secondary btn-compact">
            + New document
          </Link>
        ) : null}
      </div>

      <MasterFilterShell>
        <MasterSearchField
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search recipient, number…"
          aria-label="Search documents"
        />
        <AdaptiveSelect
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by status"
        >
          <option value="">{FILTER.ALL_STATUSES}</option>
          <option value="Draft">Draft</option>
          <option value="Submitted">Submitted</option>
          <option value="Approved">Approved</option>
          <option value="Issued">Issued</option>
          <option value="Cancelled">Cancelled</option>
        </AdaptiveSelect>
        <AdaptiveSelect
          value={documentType}
          onChange={(e) => {
            setDocumentType(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by type"
        >
          <option value="">{FILTER.ALL_TYPES}</option>
          {COMMERCIAL_DOC_TYPES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </AdaptiveSelect>
      </MasterFilterShell>

      {error ? <FeedbackBanner variant="error">{error}</FeedbackBanner> : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Type</th>
              <th>Recipient</th>
              <th>Date</th>
              <th className="num">Amount</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {listLoading ? (
              <tr>
                <td colSpan={7} className="muted">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  No saved documents yet.
                  {showCreateLink && canWrite ? (
                    <>
                      {' '}
                      Open <strong>Invoice Builder</strong> to create a new document.
                    </>
                  ) : null}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row._id}>
                  <td className="mono-sm">{row.documentNumber || row.docKey || '—'}</td>
                  <td>{docTypeLabel(row.documentType)}</td>
                  <td>{row.recipientName || '—'}</td>
                  <td>{formatDate(row.documentDate)}</td>
                  <td className="num">₹ {formatMoney(row.grandTotal)}</td>
                  <td>
                    <span className={`status-pill status-pill--${String(row.status || '').toLowerCase()}`}>
                      {row.status || '—'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {canWrite && ['Draft', 'Uploaded', 'Submitted', 'Approved'].includes(row.status) ? (
                        <Link className="btn-link" to={buildEditPath(row.documentType, row._id)}>
                          {row.status === 'Draft' || row.status === 'Uploaded' ? 'Edit' : 'Open'}
                        </Link>
                      ) : (
                        <Link className="btn-link" to={buildEditPath(row.documentType, row._id)}>
                          View
                        </Link>
                      )}
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => downloadPdf(row).catch((e) => setError(e.message))}
                      >
                        PDF
                      </button>
                      {canWrite && ['Draft', 'Uploaded', 'Cancelled'].includes(row.status) ? (
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => {
                            if (!window.confirm('Delete this document?')) return;
                            deleteCommercialDocument(row._id)
                              .then(() => load())
                              .catch((e) => setError(e.message));
                          }}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PaginationBar
        page={listMeta.page}
        pages={listMeta.pages}
        total={listMeta.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={(n) => {
          setLimit(n);
          setPage(1);
        }}
      />
    </>
  );

  if (embedded) {
    return <div className="finance-docs-embedded">{content}</div>;
  }

  return <section className="card">{content}</section>;
}
