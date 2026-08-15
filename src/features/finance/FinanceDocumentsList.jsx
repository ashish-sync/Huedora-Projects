import { useCallback, useEffect, useState } from 'react';
import FeedbackBanner from '../../components/ui/FeedbackBanner.jsx';
import { Link, useNavigate } from 'react-router-dom';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import MasterFilterShell from '../../components/masters/MasterFilterShell.jsx';
import MasterSearchField from '../../components/masters/MasterSearchField.jsx';
import { api } from '../../shared/api.js';
import { useDebouncedValue } from '../../shared/useDebouncedValue.js';
import { formatDate } from '../../shared/dateFormat.js';
import { useAuth } from '../../shared/auth.jsx';
import { FILTER } from '../../shared/labels.js';
import { COMMERCIAL_DOC_TYPES, docTypeLabel } from './commercialDocumentConfig.js';
import {
  buildEditPath,
  deleteCommercialDocument,
  isEditableStatus,
  recordCommercialPayment,
} from './builder/builderPersistence.js';
import {
  COMMERCIAL_PAYMENT_STATUS_FILTERS,
  netReceivableFromPreGst,
  paymentStatusPillClass,
  resolveCommercialPaymentDisplayStatus,
} from './commercialPaymentStatus.js';

function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

/** Official number exists only after approval (Issued). Never fall back to internal docKey. */
function displayDocumentNumber(row) {
  if (['Draft', 'Submitted', 'Uploaded'].includes(row?.status)) return '—';
  return row?.documentNumber || '—';
}

function canRecordPayment(row) {
  return ['Issued', 'Approved'].includes(row?.status);
}

export default function FinanceDocumentsList({ embedded = false, showCreateLink = true }) {
  const navigate = useNavigate();
  const { can, isAdmin } = useAuth();
  const admin = Boolean(isAdmin?.());
  const canWrite = can('finance:write') || can('*');

  const [rows, setRows] = useState([]);
  const [listMeta, setListMeta] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [error, setError] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState('');

  const [payRow, setPayRow] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState('');
  const [payMsg, setPayMsg] = useState('');

  const load = useCallback(async () => {
    setListLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (debouncedQ.trim()) params.set('q', debouncedQ.trim());
      if (status) params.set('status', status);
      if (paymentStatus) params.set('paymentStatus', paymentStatus);
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
  }, [page, limit, debouncedQ, status, paymentStatus, documentType]);

  useEffect(() => {
    load();
  }, [load]);

  function openPayment(row) {
    setPayError('');
    setPayMsg('');
    setPayRow(row);
    const netReceivable = netReceivableFromPreGst(row.subtotal);
    const existing = Number(row.paidAmount);
    setPayAmount(
      Number.isFinite(existing) && existing > 0
        ? String(existing)
        : netReceivable != null
          ? String(netReceivable)
          : '',
    );
  }

  function closePayment() {
    if (payBusy) return;
    setPayRow(null);
    setPayAmount('');
    setPayError('');
  }

  async function submitPayment() {
    if (!payRow) return;
    setPayBusy(true);
    setPayError('');
    setPayMsg('');
    try {
      const updated = await recordCommercialPayment(payRow._id, payAmount);
      const display = resolveCommercialPaymentDisplayStatus(updated);
      setPayMsg(
        display === 'Paid'
          ? 'Marked Paid.'
          : display === 'Partially Paid'
            ? 'Marked Partially Paid.'
            : 'Payment saved.',
      );
      setPayRow(null);
      setPayAmount('');
      await load();
    } catch (e) {
      setPayError(e.message || 'Failed to record payment');
    } finally {
      setPayBusy(false);
    }
  }

  async function handleDelete(row) {
    if (!admin || !row?._id) return;
    const label = displayDocumentNumber(row);
    const confirmMsg =
      label && label !== '—'
        ? `Delete ${label}? Its invoice number will be released for reuse.`
        : 'Delete this billing document?';
    if (!window.confirm(confirmMsg)) return;
    setDeleteBusyId(row._id);
    setError('');
    try {
      await deleteCommercialDocument(row._id);
      setPayMsg('Document deleted.');
      await load();
    } catch (e) {
      setError(e.message || 'Failed to delete document');
    } finally {
      setDeleteBusyId('');
    }
  }

  const payNetReceivable = payRow ? netReceivableFromPreGst(payRow.subtotal) : null;
  const payDisplayStatus = payRow ? resolveCommercialPaymentDisplayStatus(payRow) : '';

  const content = (
    <>
      <div className={`finance-docs-head${embedded ? ' finance-docs-head--embedded' : ''}`}>
        <h3 className="finance-docs-title">Saved documents</h3>
        {showCreateLink && canWrite ? (
          <Link to="/finance-one/billing" className="btn secondary btn-compact">
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
        <AdaptiveSelect
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by stage"
        >
          <option value="">All stages</option>
          <option value="Draft">Draft</option>
          <option value="Submitted">Submitted</option>
          <option value="Approved">Approved</option>
          <option value="Issued">Issued</option>
          <option value="Cancelled">Cancelled</option>
        </AdaptiveSelect>
        <AdaptiveSelect
          value={paymentStatus}
          onChange={(e) => {
            setPaymentStatus(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {COMMERCIAL_PAYMENT_STATUS_FILTERS.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </AdaptiveSelect>
      </MasterFilterShell>

      {error ? <FeedbackBanner variant="error">{error}</FeedbackBanner> : null}
      {payMsg ? <FeedbackBanner variant="success">{payMsg}</FeedbackBanner> : null}

      <div className="table-wrap finance-docs-table-wrap">
        <table className="data-table finance-docs-table">
          <thead>
            <tr>
              <th className="finance-docs-col-number">Number</th>
              <th className="finance-docs-col-type">Type</th>
              <th className="finance-docs-col-recipient">Recipient</th>
              <th className="finance-docs-col-date">Date</th>
              <th className="num finance-docs-col-amount">Amount</th>
              <th className="num finance-docs-col-net">Net Receivable</th>
              <th className="finance-docs-col-stage">Stage</th>
              <th className="finance-docs-col-status">Status</th>
              <th className="finance-docs-col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listLoading ? (
              <tr>
                <td colSpan={9} className="muted">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="muted">
                  No saved documents yet.
                  {showCreateLink && canWrite ? (
                    <>
                      {' '}
                      Open <strong>Billing Center</strong> to create a new document.
                    </>
                  ) : null}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const editable = isEditableStatus(row.status, { isAdmin: admin });
                const netReceivable = netReceivableFromPreGst(row.subtotal);
                const paymentDisplay = resolveCommercialPaymentDisplayStatus(row);
                return (
                  <tr key={row._id}>
                    <td className="mono-sm finance-docs-col-number">{displayDocumentNumber(row)}</td>
                    <td className="finance-docs-col-type">{docTypeLabel(row.documentType)}</td>
                    <td className="finance-docs-col-recipient">{row.recipientName || '—'}</td>
                    <td className="finance-docs-col-date">{formatDate(row.documentDate)}</td>
                    <td className="num finance-docs-col-amount">₹ {formatMoney(row.grandTotal)}</td>
                    <td className="num finance-docs-col-net">
                      {netReceivable == null ? '—' : `₹ ${formatMoney(netReceivable)}`}
                    </td>
                    <td className="finance-docs-col-stage">
                      <span className={`status-pill status-pill--${String(row.status || '').toLowerCase()}`}>
                        {row.status || '—'}
                      </span>
                    </td>
                    <td className="finance-docs-col-status">
                      {paymentDisplay ? (
                        <span className={paymentStatusPillClass(paymentDisplay)}>{paymentDisplay}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="finance-docs-col-actions">
                      <div className="finance-docs-row-actions">
                        <Link to={buildEditPath(row.documentType, row._id)}>
                          {editable ? 'Edit' : 'View'}
                        </Link>
                        <button
                          type="button"
                          onClick={() => navigate(`${buildEditPath(row.documentType, row._id)}?print=1`)}
                        >
                          Print
                        </button>
                        {canWrite && canRecordPayment(row) ? (
                          <button type="button" onClick={() => openPayment(row)}>
                            Payment
                          </button>
                        ) : null}
                        {admin ? (
                          <button
                            type="button"
                            className="danger-text"
                            disabled={deleteBusyId === row._id}
                            onClick={() => handleDelete(row)}
                          >
                            {deleteBusyId === row._id ? 'Deleting…' : 'Delete'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
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

      {payRow ? (
        <div className="modal-overlay" role="presentation" onClick={closePayment}>
          <div
            className="modal-card finance-payment-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Record payment"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-title">Record payment</h3>
            <p className="muted finance-payment-modal-meta">
              {docTypeLabel(payRow.documentType)} · {displayDocumentNumber(payRow)}
            </p>
            {payDisplayStatus ? (
              <p className="finance-payment-modal-status">
                <span className={paymentStatusPillClass(payDisplayStatus)}>{payDisplayStatus}</span>
              </p>
            ) : null}
            <div className="field">
              <label>Net Receivable</label>
              <input
                readOnly
                value={payNetReceivable == null ? '—' : `₹ ${formatMoney(payNetReceivable)}`}
              />
            </div>
            <div className="field">
              <label>Payment amount *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                autoFocus
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                disabled={payBusy}
              />
              <p className="field-hint muted">
                Same as Net Receivable → Paid. Any other amount → Partially Paid. While unpaid,
                Status ages from approval: Sent (0–10) → Due (11–30) → Overdue (31–45) → MSME Breach
                (46+).
              </p>
            </div>
            {payError ? <FeedbackBanner variant="error">{payError}</FeedbackBanner> : null}
            <div className="modal-actions">
              <button type="button" className="btn secondary" disabled={payBusy} onClick={closePayment}>
                Cancel
              </button>
              <button type="button" className="btn primary" disabled={payBusy} onClick={submitPayment}>
                {payBusy ? 'Saving…' : 'Save payment'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  if (embedded) {
    return <div className="finance-docs-embedded">{content}</div>;
  }

  return <section className="card">{content}</section>;
}
