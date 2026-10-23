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
import { fetchCommercialOrgList, loadOrgListCache } from './commercialOrgMaster.js';
import {
  buildEditPath,
  correctCommercialDocumentNumber,
  deleteCommercialDocument,
  duplicateCommercialDocument,
  recordCommercialPayment,
  updateCommercialLifecycleStatus,
} from './builder/builderPersistence.js';
import CorrectDocumentNumberModal from './builder/CorrectDocumentNumberModal.jsx';
import {
  APPLICABLE_TDS_RATES,
  COMMERCIAL_STAGE_FILTERS,
  commercialStatusFilterOptions,
  displayCommercialStage,
  expectedReceivedAfterTds,
  isAutoPaymentStatusType,
  isIssuedStage,
  isManualLifecycleStatusType,
  normalizeCommercialStage,
  normalizeTdsRate,
  paymentStatusPillClass,
  resolveCommercialDisplayStatus,
  COMMERCIAL_STATUS_BY_TYPE,
  taxableValueFromDocument,
  tdsAmountFromTaxableValue,
} from './commercialPaymentStatus.js';

function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function displayPaidReceived(row) {
  const num = Number(row?.paidAmount);
  if (!Number.isFinite(num) || num <= 0) return '—';
  return `₹ ${formatMoney(num)}`;
}

/** Official number after approval, or an admin-reserved number on Draft/Submitted. */
function displayDocumentNumber(row) {
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
  onCorrectNumber,
  onDelete,
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const showPayment = canWrite && canRecordPayment(row);
  const showStatus = canWrite && canEditLifecycleStatus(row);
  const showDuplicate = canWrite;
  const showCorrect =
    admin && (isIssuedStage(row?.status) || normalizeCommercialStage(row?.status) === 'Cancelled');
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
  }, [open, placeMenu, showPayment, showStatus, showDuplicate, showCorrect, showDelete]);

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
          {showCorrect ? (
            <button type="button" role="menuitem" onClick={() => run(onCorrectNumber)}>
              Correct number
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
  const [orgList, setOrgList] = useState(() => loadOrgListCache());
  const [orgProfileId, setOrgProfileId] = useState('');
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
  const [payTdsRate, setPayTdsRate] = useState(0);
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState('');
  const [payMsg, setPayMsg] = useState('');

  const [statusRow, setStatusRow] = useState(null);
  const [statusValue, setStatusValue] = useState('');
  const [statusError, setStatusError] = useState('');

  const [correctRow, setCorrectRow] = useState(null);
  const [correctError, setCorrectError] = useState('');
  const [correctBusy, setCorrectBusy] = useState(false);

  const load = useCallback(async () => {
    setListLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (debouncedQ.trim()) params.set('q', debouncedQ.trim());
      if (orgProfileId) params.set('orgProfileId', orgProfileId);
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
  }, [page, limit, debouncedQ, orgProfileId, status, paymentStatus, documentType]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    fetchCommercialOrgList()
      .then((list) => {
        if (!cancelled) setOrgList(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function openPayment(row) {
    setPayError('');
    setPayMsg('');
    setPayRow(row);
    const rate = normalizeTdsRate(row.tdsRate);
    setPayTdsRate(rate);
    const tdsAmount = tdsAmountFromTaxableValue(taxableValueFromDocument(row), rate);
    const expected = expectedReceivedAfterTds(row.grandTotal, tdsAmount);
    const existing = Number(row.paidAmount);
    setPayAmount(
      Number.isFinite(existing) && existing > 0
        ? String(existing)
        : expected > 0
          ? String(expected)
          : '',
    );
  }

  function closePayment() {
    if (payBusy) return;
    setPayRow(null);
    setPayAmount('');
    setPayTdsRate(0);
    setPayError('');
  }

  function changePayTdsRate(nextRate) {
    const rate = normalizeTdsRate(nextRate);
    setPayTdsRate(rate);
    if (!payRow) return;
    const tdsAmount = tdsAmountFromTaxableValue(taxableValueFromDocument(payRow), rate);
    const expected = expectedReceivedAfterTds(payRow.grandTotal, tdsAmount);
    setPayAmount(expected > 0 ? String(expected) : '');
  }

  async function submitPayment() {
    if (!payRow) return;
    setPayBusy(true);
    setPayError('');
    setPayMsg('');
    try {
      const updated = await recordCommercialPayment(payRow._id, payAmount, payTdsRate);
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
      setPayTdsRate(0);
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

  const payInvoiceAmount = payRow ? Number(payRow.grandTotal) : null;
  const payTaxableValue = payRow ? taxableValueFromDocument(payRow) : 0;
  const payTdsAmount = payRow ? tdsAmountFromTaxableValue(payTaxableValue, payTdsRate) : 0;
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
          value={orgProfileId}
          onChange={(e) => {
            setOrgProfileId(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by organisation"
        >
          <option value="">{FILTER.ALL_ORGANISATIONS}</option>
          {orgList.map((org) => {
            const id = String(org._id || org.id || '');
            if (!id) return null;
            return (
              <option key={id} value={id}>
                {org.name || org.legalName || id}
                {org.isDefault ? ' (default)' : ''}
              </option>
            );
          })}
        </AdaptiveSelect>
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
              <th className="num finance-docs-col-paid" title="Received">
                Received
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
                  {orgProfileId
                    ? 'No saved documents for this organisation.'
                    : 'No saved documents yet.'}
                  {!orgProfileId && showCreateLink && canWrite ? (
                    <>
                      {' '}
                      Open <strong>Billing Center</strong> to create a new document.
                    </>
                  ) : null}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const paidReceived = displayPaidReceived(row);
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
                    <td className="num finance-docs-col-paid" title={paidReceived}>
                      {paidReceived}
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
                        onCorrectNumber={() => {
                          setCorrectError('');
                          setCorrectRow(row);
                        }}
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
            <div className="finance-payment-modal-grid">
              <div className="field">
                <label>Amount</label>
                <input
                  readOnly
                  value={
                    payInvoiceAmount == null || !Number.isFinite(payInvoiceAmount)
                      ? '—'
                      : `₹ ${formatMoney(payInvoiceAmount)}`
                  }
                />
              </div>
              <div className="field">
                <label>Applicable TDS</label>
                <AdaptiveSelect
                  value={String(payTdsRate)}
                  onChange={(e) => changePayTdsRate(e.target.value)}
                  aria-label="Applicable TDS"
                  disabled={payBusy}
                >
                  {APPLICABLE_TDS_RATES.map((rate) => (
                    <option key={rate} value={String(rate)}>
                      {rate}%
                    </option>
                  ))}
                </AdaptiveSelect>
              </div>
              <div className="field">
                <label>TDS Amount</label>
                <input readOnly value={`₹ ${formatMoney(payTdsAmount)}`} />
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
              </div>
            </div>
            <p className="finance-payment-modal-note">
              TDS is {payTdsRate}% of Taxable Value
              {payTaxableValue > 0 ? ` (₹ ${formatMoney(payTaxableValue)})` : ''}. Amount − TDS →
              Paid.
            </p>
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

      <CorrectDocumentNumberModal
        open={Boolean(correctRow)}
        row={correctRow}
        documentCode={correctRow?.orgSnapshot?.documentCode}
        busy={correctBusy}
        error={correctError}
        onClose={() => {
          if (correctBusy) return;
          setCorrectRow(null);
          setCorrectError('');
        }}
        onSubmit={async ({ documentNumber, remark }) => {
          if (!correctRow?._id) return;
          setCorrectBusy(true);
          setCorrectError('');
          try {
            await correctCommercialDocumentNumber(correctRow._id, { documentNumber, remark });
            setPayMsg(`Document number updated to ${documentNumber}.`);
            setCorrectRow(null);
            await load();
          } catch (e) {
            setCorrectError(e.message || 'Could not correct document number');
          } finally {
            setCorrectBusy(false);
          }
        }}
      />
    </>
  );

  if (embedded) {
    return <div className="finance-docs-embedded">{content}</div>;
  }

  return <section className="card">{content}</section>;
}
