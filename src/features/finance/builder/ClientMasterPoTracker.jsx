import { useEffect, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { api } from '../../../shared/api.js';
import ModalShell from '../../../components/ui/ModalShell.jsx';
import {
  formatPoInr,
  invoiceAmountAgainstPo,
  isPoSelectableForBilling,
  MIN_PO_REMAINING_TO_BILL,
  projectPoUtilization,
  utilizationTone,
} from './poUtilization.js';

function toQuery(params = {}) {
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
  const qs = new URLSearchParams(cleaned).toString();
  return qs ? `?${qs}` : '';
}

function Field({ label, children, title }) {
  return (
    <label className="ib-field" title={title}>
      <span className="ib-field-label">{label}</span>
      {children}
    </label>
  );
}

function optionLabel(po) {
  const number = po.poNumber || 'Untitled PO';
  return `${number} · ${formatPoInr(po.totalValue)}`;
}

function docTypeLabel(type) {
  switch (type) {
    case 'client_invoice':
      return 'Tax Invoice';
    case 'bill_of_supply':
      return 'Bill of Supply';
    case 'credit_note':
      return 'Credit Note';
    case 'debit_note':
      return 'Debit Note';
    default:
      return type || 'Document';
  }
}

function formatDocDate(value) {
  const raw = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '—';
  const [y, m, d] = raw.split('-');
  return `${d}/${m}/${y}`;
}

const minRemainingLabel = `₹${MIN_PO_REMAINING_TO_BILL.toLocaleString('en-IN')}`;

/**
 * PO / WO No. picker from Client Master purchase orders, with live utilization.
 * POs with remaining balance below ₹1,500 are hidden from the picker.
 */
export default function ClientMasterPoTracker({
  clientMasterId = '',
  selectedPoId = '',
  poReference = '',
  poDate = '',
  excludeDocId = '',
  totals = null,
  disabled = false,
  onSelectPo,
  onPoReferenceChange,
  onPoDateChange,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [billedOpen, setBilledOpen] = useState(false);

  useEffect(() => {
    if (!clientMasterId) {
      setData(null);
      setError('');
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    const params = { clientMasterId };
    if (excludeDocId) params.excludeDocId = excludeDocId;
    api(`/finance/po-utilization${toQuery(params)}`)
      .then((res) => {
        if (cancelled) return;
        setData(res?.data || null);
        setError('');
      })
      .catch((err) => {
        if (!cancelled) {
          setData(null);
          setError(err?.message || 'Could not load Client Master POs');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientMasterId, excludeDocId]);

  useEffect(() => {
    setBilledOpen(false);
  }, [selectedPoId]);

  const orders = Array.isArray(data?.purchaseOrders) ? data.purchaseOrders : [];
  const selectableOrders = useMemo(
    () =>
      orders.filter((po) =>
        isPoSelectableForBilling(po, { selectedPoId, minRemaining: MIN_PO_REMAINING_TO_BILL })
      ),
    [orders, selectedPoId]
  );
  const hasMasterPos = orders.length > 0;
  const hasSelectablePos = selectableOrders.length > 0;
  const selected = useMemo(
    () => orders.find((row) => String(row.id) === String(selectedPoId)) || null,
    [orders, selectedPoId]
  );

  // Keep invoice PO / WO Date locked to Client Master PO Issue Date
  useEffect(() => {
    if (!selected) return;
    const issue = selected.poIssueDate ? String(selected.poIssueDate).slice(0, 10) : '';
    if (issue !== (poDate || '')) onPoDateChange?.(issue);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only when selected PO or stored date drifts
  }, [selected?.id, selected?.poIssueDate, poDate]);

  const thisAmount = invoiceAmountAgainstPo(totals);
  const projection = projectPoUtilization(selected, thisAmount);
  const tone = projection
    ? utilizationTone(projection.utilizationPct, projection.remainingAfter)
    : 'ok';
  const billedDocs = Array.isArray(selected?.relatedDocs) ? selected.relatedDocs : [];
  const utilizationPct = Number(selected?.utilizationPct);
  const displayUtil = Number.isFinite(utilizationPct)
    ? utilizationPct
    : projection
      ? Math.round(
          (projection.totalValue > 0
            ? (projection.billedAmount / projection.totalValue) * 10000
            : projection.billedAmount > 0
              ? 10000
              : 0) / 100
        )
      : 0;

  if (!clientMasterId) return null;

  return (
    <div className="ib-po-block">
      <div className="ib-po-block-fields">
        {hasMasterPos && (hasSelectablePos || selected) ? (
          <Field
            label="PO / WO No."
            title={`Only POs with remaining balance ≥ ${minRemainingLabel} are listed`}
          >
            <select
              className="ib-input ib-po-select"
              value={selectedPoId || ''}
              disabled={disabled || loading}
              aria-label="PO / WO No. from Client Master"
              onChange={(e) => {
                const id = e.target.value;
                if (!id) {
                  onSelectPo?.(null);
                  return;
                }
                const row = selectableOrders.find((po) => String(po.id) === id) || null;
                onSelectPo?.(row);
              }}
            >
              <option value="">{loading ? 'Loading POs…' : 'Select PO / WO'}</option>
              {selectableOrders.map((po) => (
                <option
                  key={po.id}
                  value={po.id}
                  title={`Remaining ${formatPoInr(po.remainingBalance)}`}
                >
                  {optionLabel(po)}
                </option>
              ))}
            </select>
          </Field>
        ) : hasMasterPos ? (
          <Field
            label="PO / WO No."
            title={`No Client Master POs with remaining balance ≥ ${minRemainingLabel}`}
          >
            <input
              className="ib-input"
              value=""
              disabled
              placeholder={`No PO with ≥ ${minRemainingLabel} remaining`}
            />
          </Field>
        ) : (
          <Field
            label="PO / WO No."
            title={
              data?.campTerms && data.campTerms !== 'po_based'
                ? 'This Client Master is not PO Based — enter manually if needed'
                : 'No POs on Client Master — add under Camp Terms → PO Based'
            }
          >
            <input
              className="ib-input"
              value={poReference || ''}
              disabled={disabled}
              onChange={(e) => onPoReferenceChange?.(e.target.value)}
              placeholder={
                loading
                  ? 'Loading…'
                  : data?.campTerms && data.campTerms !== 'po_based'
                    ? 'Enter PO / WO No. (optional)'
                    : 'No Client Master POs — enter manually'
              }
            />
          </Field>
        )}

        <Field
          label="PO / WO Date"
          title={selected ? 'Taken from Client Master PO Issue Date' : undefined}
        >
          <input
            type="date"
            className="ib-input"
            value={
              selected?.poIssueDate ? String(selected.poIssueDate).slice(0, 10) : poDate || ''
            }
            disabled={disabled || Boolean(selected)}
            readOnly={Boolean(selected)}
            onChange={(e) => {
              if (selected) return;
              onPoDateChange?.(e.target.value);
            }}
          />
        </Field>
      </div>

      {hasMasterPos && (projection || (!hasSelectablePos && !selected) || error) ? (
        <div className={`ib-po-tracker${projection?.exceeds ? ' is-over' : ''}`}>
          <div className="ib-po-tracker-head">
            <span className="ib-po-tracker-title">PO Details</span>
            <div className="ib-po-tracker-head-end">
              {loading ? <span className="ib-po-tracker-meta">Updating…</span> : null}
              {selected?.poNumber ? (
                <span className="ib-po-tracker-po">{selected.poNumber}</span>
              ) : null}
            </div>
          </div>

          {!selected && !hasSelectablePos ? (
            <p className="ib-po-tracker-empty">
              All Client Master POs have less than {minRemainingLabel} remaining — none are available
              to bill.
            </p>
          ) : null}

          {projection ? (
            <div className={`ib-po-tracker-metrics tone-${tone}`} aria-live="polite">
              <div className="ib-po-tracker-kpis">
                <div className="ib-po-tracker-kpi">
                  <div className="ib-po-tracker-kpi-label">
                    <span>Billed</span>
                    <button
                      type="button"
                      className="ib-po-tracker-eye"
                      aria-label="View billed summary"
                      title="View billed summary"
                      onClick={() => setBilledOpen(true)}
                    >
                      <Eye size={14} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </div>
                  <strong>{formatPoInr(projection.billedAmount)}</strong>
                </div>
                <div className="ib-po-tracker-kpi">
                  <span>PO Balance</span>
                  <strong className="ib-po-tracker-kpi-remain">
                    {formatPoInr(projection.remainingBalance)}
                  </strong>
                </div>
                <div className="ib-po-tracker-kpi">
                  <span>Utilization</span>
                  <strong className="ib-po-tracker-kpi-util">{displayUtil.toFixed(1)}%</strong>
                </div>
              </div>

              {displayUtil > 0 ? (
                <div className="ib-po-tracker-bar-wrap" aria-hidden="true">
                  <div
                    className="ib-po-tracker-bar"
                    style={{ width: `${Math.min(100, Math.max(0, displayUtil))}%` }}
                  />
                </div>
              ) : null}

              {projection.exceeds ? (
                <p className="ib-po-tracker-alert">
                  Amount exceeds remaining PO balance by{' '}
                  {formatPoInr(Math.abs(projection.remainingAfter))}. Reduce lines or pick another
                  PO before submit.
                </p>
              ) : (
                <div className="ib-po-tracker-footer">
                  <span>Remaining After This Bill</span>
                  <strong>≈ {formatPoInr(Math.max(0, projection.remainingAfter))}</strong>
                </div>
              )}
            </div>
          ) : null}

          {error ? <p className="ib-po-tracker-error">{error}</p> : null}
        </div>
      ) : null}

      {!hasMasterPos && error ? <p className="ib-po-tracker-error">{error}</p> : null}
      {!hasMasterPos && !error && !loading ? (
        <p className="ib-po-tracker-empty">
          {data?.campTerms && data.campTerms !== 'po_based'
            ? 'This Client Master is not PO Based. Enter PO / WO manually if needed.'
            : 'No purchase orders on this Client Master. Add them under Camp Terms → PO Based.'}
        </p>
      ) : null}

      <ModalShell
        open={billedOpen}
        onClose={() => setBilledOpen(false)}
        titleId="ib-po-billed-title"
        panelClassName="modal-card ib-po-billed-modal"
      >
        <div className="ib-po-billed-summary">
          <div className="ib-po-billed-head">
            <h2 id="ib-po-billed-title" className="ib-po-billed-title">
              Billed · {selected?.poNumber || 'PO'}
            </h2>
            <button
              type="button"
              className="ib-icon-btn"
              onClick={() => setBilledOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <p className="ib-po-billed-total">
            Total billed{' '}
            <strong>{formatPoInr(projection?.billedAmount ?? selected?.billedAmount)}</strong>
          </p>
          {billedDocs.length ? (
            <table className="ib-po-billed-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="is-num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {billedDocs.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <span className="ib-po-billed-doc-type">{docTypeLabel(doc.documentType)}</span>
                      <span className="ib-po-billed-doc-no">{doc.documentNumber || '—'}</span>
                    </td>
                    <td>{formatDocDate(doc.documentDate)}</td>
                    <td>{doc.status || '—'}</td>
                    <td className="is-num">{formatPoInr(doc.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="ib-po-tracker-empty">No documents billed against this PO yet.</p>
          )}
        </div>
      </ModalShell>
    </div>
  );
}
