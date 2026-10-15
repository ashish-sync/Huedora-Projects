import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  duplicateCommercialDocument,
  recordCommercialPayment,
  updateCommercialLifecycleStatus,
} from './builder/builderPersistence.js';
import {
  COMMERCIAL_STAGE_FILTERS,
  commercialStatusFilterOptions,
  displayCommercialStage,
  isAutoPaymentStatusType,
  isIssuedStage,
  isManualLifecycleStatusType,
  netReceivableFromPreGst,
  normalizeCommercialStage,
  paymentStatusPillClass,
  resolveCommercialDisplayStatus,
  COMMERCIAL_STATUS_BY_TYPE,
} from './commercialPaymentStatus.js';

function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

/** Official number exists only after approval (Issued). Never fall back to internal docKey. */
function displayDocumentNumber(row) {
  const stage = normalizeCommercialStage(row?.status);
  if (stage === 'Draft' || stage === 'Submitted') return '—';
  return row?.documentNumber || '—';
}

function displayProjectServicePeriod(row) {
  const value = String(row?.servicePeriod || row?.projectName || '').trim();
  return value || '—';
}

function canRecordPayment(row) {
  return isIssuedStage(row?.status) && isAutoPaymentStatusType(row?.documentType);
}

function canEditLifecycleStatus(row) {
  return isIssuedStage(row?.status) && isManualLifecycleStatusType(row?.documentType);
}

const MENU_WIDTH = 200;
const MENU_GAP = 4;

function FinanceDocActionsMenu({
  row,
  canWrite,
  admin,
  busy,
  onEdit,
  onPrint,
  onDuplicate,
  onPayment,
  onUpdateStatus,
  onDelete,
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const showPayment = canWrite && canRecordPayment(row);
  const showStatus = canWrite && canEditLifecycleStatus(row);
  const showDuplicate = canWrite;
  const showDelete = admin;

  const placeMenu = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const panelHeight = panelRef.current?.offsetHeight || 220;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < panelHeight + MENU_GAP && rect.top > spaceBelow;
    const top = openUp
      ? Math.max(8, rect.top - panelHeight - MENU_GAP)
      : Math.min(window.innerHeight - panelHeight - 8, rect.bottom + MENU_GAP);
    const left = Math.min(
      window.innerWidth - MENU_WIDTH - 8,
      Math.max(8, rect.right - MENU_WIDTH),
    );
    setCoords({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    placeMenu();
    const raf = window.requestAnimationFrame(() => placeMenu());
    const onReposition = () => placeMenu();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, placeMenu, showPayment, showStatus, showDuplicate, showDelete]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      const t = event.target;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function run(action) {
    setOpen(false);
    action?.();
  }

  const menu = open
    ? createPortal(
        <div
          ref={panelRef}
          className="finance-docs-actions-panel finance-docs-actions-panel--portal"
          role="menu"
          aria-label="Document actions"
          style={{ top: coords.top, left: coords.left, width: MENU_WIDTH }}
        >
          <button type="button" role="menuitem" onClick={() => run(onEdit)}>
            Edit Document
          </button>
          <button type="button" role="menuitem" onClick={() => run(onPrint)}>
            Print Document
          </button>
          {showDuplicate ? (
            <button type="button" role="menuitem" onClick={() => run(onDuplicate)}>
              Create Duplicate
            </button>
          ) : null}
          {showPayment ? (
            <button type="button" role="menuitem" onClick={() => run(onPayment)}>
              Update Payment
            </button>
          ) : null}
          {showStatus ? (
            <button type="button" role="menuitem" onClick={() => run(onUpdateStatus)}>
              Update Status
            </button>
          ) : null}
          {showDelete ? (
            <button
              type="button"
              role="menuitem"
              className="finance-docs-actions-danger"
              onClick={() => run(onDelete)}
            >
              Delete
            </button>
          ) : null}
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="finance-docs-actions-menu">
      <button
        ref={triggerRef}
        type="button"
        className="finance-docs-actions-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Document actions"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {menu}
    </div>
  );
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
  const [duplicateBusyId, setDuplicateBusyId] = useState('');
  const [statusBusyId, setStatusBusyId] = useState('');

  const [payRow, setPayRow] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState('');
  const [payMsg, setPayMsg] = useState('');

  const [statusRow, setStatusRow] = useState(null);
  const [statusValue, setStatusValue] = useState('');
  const [statusError, setStatusError] = useState('');

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
      const display = resolveCommercialDisplayStatus(updated);
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

  async function handleDuplicate(row) {
    if (!canWrite || !row?._id) return;
    setDuplicateBusyId(row._id);
    setError('');
    setPayMsg('');
    try {
      const created = await duplicateCommercialDocument(row._id);
      setPayMsg('Document duplicated as a new draft.');
      await load();
      navigate(buildEditPath(created.documentType || row.documentType, created._id));
    } catch (e) {
      setError(e.message || 'Failed to duplicate document');
    } finally {
      setDuplicateBusyId('');
    }
  }

  function openStatusUpdate(row) {
    if (!canEditLifecycleStatus(row)) return;
    setStatusError('');
    setPayMsg('');
    setStatusRow(row);
    setStatusValue(resolveCommercialDisplayStatus(row) || '');
  }

  function closeStatusUpdate() {
    if (statusBusyId) return;
    setStatusRow(null);
    setStatusValue('');
    setStatusError('');
  }

  async function submitStatusUpdate() {
    if (!statusRow || !statusValue) return;
    setStatusBusyId(statusRow._id);
    setStatusError('');
    setPayMsg('');
    try {
      await updateCommercialLifecycleStatus(statusRow._id, statusValue);
      setPayMsg('Status updated.');
      setStatusRow(null);
      setStatusValue('');
      await load();
    } catch (e) {
      setStatusError(e.message || 'Failed to update status');
    } finally {
      setStatusBusyId('');
    }
  }

  const payNetReceivable = payRow ? netReceivableFromPreGst(payRow.subtotal) : null;
  const payDisplayStatus = payRow ? resolveCommercialDisplayStatus(payRow) : '';
  const statusFilterOptions = commercialStatusFilterOptions(documentType);
  const statusModalOptions = statusRow
    ? COMMERCIAL_STATUS_BY_TYPE[statusRow.documentType]?.options || []
    : [];

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
          placeholder="Search recipient, number, project…"
          aria-label="Search documents"
        />
        <AdaptiveSelect
          value={documentType}
          onChange={(e) => {
            setDocumentType(e.target.value);
            setPaymentStatus('');
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
          {COMMERCIAL_STAGE_FILTERS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
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
          {statusFilterOptions.map((label) => (
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
              <th className="finance-docs-col-period" title="Project / Service Period">
                Reference
              </th>
              <th className="finance-docs-col-date">Date</th>
              <th className="num finance-docs-col-amount">Amount</th>
              <th className="num finance-docs-col-net" title="Net Receivable">
                Net
              </th>
              <th className="finance-docs-col-stage">Stage</th>
              <th className="finance-docs-col-status">Status</th>
              <th className="finance-docs-col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listLoading ? (
              <tr>
                <td colSpan={10} className="muted">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="muted">
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
                const netReceivable = netReceivableFromPreGst(row.subtotal);
                const stageLabel = displayCommercialStage(row.status);
                const stageSlug = normalizeCommercialStage(row.status).toLowerCase();
                const statusDisplay = resolveCommercialDisplayStatus(row);
                const rowBusy =
                  deleteBusyId === row._id ||
                  duplicateBusyId === row._id ||
                  statusBusyId === row._id;
                return (
                  <tr key={row._id}>
                    <td
                      className="mono-sm finance-docs-col-number"
                      title={displayDocumentNumber(row)}
                    >
                      {displayDocumentNumber(row)}
                    </td>
                    <td
                      className="finance-docs-col-type"
                      title={docTypeLabel(row.documentType)}
                    >
                      {docTypeLabel(row.documentType)}
                    </td>
                    <td
                      className="finance-docs-col-recipient"
                      title={row.recipientName || '—'}
                    >
                      {row.recipientName || '—'}
                    </td>
                    <td
                      className="finance-docs-col-period"
                      title={displayProjectServicePeriod(row)}
                    >
                      {displayProjectServicePeriod(row)}
                    </td>
                    <td className="finance-docs-col-date">{formatDate(row.documentDate)}</td>
                    <td className="num finance-docs-col-amount" title={`₹ ${formatMoney(row.grandTotal)}`}>
                      ₹ {formatMoney(row.grandTotal)}
                    </td>
                    <td
                      className="num finance-docs-col-net"
                      title={netReceivable == null ? '—' : `₹ ${formatMoney(netReceivable)}`}
                    >
                      {netReceivable == null ? '—' : `₹ ${formatMoney(netReceivable)}`}
                    </td>
                    <td className="finance-docs-col-stage" title={stageLabel}>
                      <span className={`status-pill status-pill--${stageSlug}`}>
                        {stageLabel}
                      </span>
                    </td>
                    <td className="finance-docs-col-status" title={statusDisplay || '—'}>
                      {statusDisplay ? (
                        <span className={paymentStatusPillClass(statusDisplay)}>{statusDisplay}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="finance-docs-col-actions">
                      <FinanceDocActionsMenu
                        row={row}
                        canWrite={canWrite}
                        admin={admin}
                        busy={rowBusy}
                        onEdit={() => navigate(buildEditPath(row.documentType, row._id))}
                        onPrint={() =>
                          navigate(`${buildEditPath(row.documentType, row._id)}?print=1`)
                        }
                        onDuplicate={() => handleDuplicate(row)}
                        onPayment={() => openPayment(row)}
                        onUpdateStatus={() => openStatusUpdate(row)}
                        onDelete={() => handleDelete(row)}
                      />
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
                Tax Invoice / Bill of Supply Status is Unpaid under 30D (≤30 days from approval) or
                Unpaid over 30D. Debit Note unpaid Status is Pending Collection.
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

      {statusRow ? (
        <div className="modal-overlay" role="presentation" onClick={closeStatusUpdate}>
          <div
            className="modal-card finance-payment-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Update status"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-title">Update Status</h3>
            <p className="muted finance-payment-modal-meta">
              {docTypeLabel(statusRow.documentType)} · {displayDocumentNumber(statusRow)}
            </p>
            <div className="field">
              <label>Status *</label>
              <AdaptiveSelect
                value={statusValue}
                onChange={(e) => setStatusValue(e.target.value)}
                aria-label="Document status"
                disabled={Boolean(statusBusyId)}
              >
                {statusModalOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </AdaptiveSelect>
              <p className="field-hint muted">
                Status is independent of Stage. Changing Status will not change Stage.
              </p>
            </div>
            {statusError ? <FeedbackBanner variant="error">{statusError}</FeedbackBanner> : null}
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                disabled={Boolean(statusBusyId)}
                onClick={closeStatusUpdate}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={Boolean(statusBusyId) || !statusValue}
                onClick={submitStatusUpdate}
              >
                {statusBusyId ? 'Saving…' : 'Save status'}
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
