import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../shared/api.js';
import {
  formatPoInr,
  invoiceAmountAgainstPo,
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

/**
 * Select a Client Master PO and show live utilization while building
 * Tax Invoice / Bill of Supply.
 */
export default function ClientMasterPoTracker({
  clientMasterId = '',
  selectedPoId = '',
  excludeDocId = '',
  totals = null,
  disabled = false,
  onSelectPo,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
          setError(err?.message || 'Could not load PO utilization');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientMasterId, excludeDocId]);

  const orders = Array.isArray(data?.purchaseOrders) ? data.purchaseOrders : [];
  const selected = useMemo(
    () => orders.find((row) => String(row.id) === String(selectedPoId)) || null,
    [orders, selectedPoId]
  );
  const thisAmount = invoiceAmountAgainstPo(totals);
  const projection = projectPoUtilization(selected, thisAmount);
  const tone = projection
    ? utilizationTone(projection.utilizationPct, projection.remainingAfter)
    : 'ok';

  if (!clientMasterId) return null;

  return (
    <div className={`ib-po-tracker${projection?.exceeds ? ' is-over' : ''}`}>
      <div className="ib-po-tracker-head">
        <span className="ib-po-tracker-title">PO tracking</span>
        {loading ? <span className="ib-po-tracker-meta">Updating…</span> : null}
      </div>

      {orders.length ? (
        <label className="ib-field">
          <span className="ib-field-label">Client Master PO</span>
          <select
            className="ib-input"
            value={selectedPoId || ''}
            disabled={disabled || loading}
            onChange={(e) => {
              const id = e.target.value;
              const row = orders.find((po) => String(po.id) === id) || null;
              onSelectPo?.(row);
            }}
          >
            <option value="">Select PO (required for balance control)</option>
            {orders.map((po) => (
              <option key={po.id} value={po.id}>
                {po.poNumber || 'Untitled PO'} · {formatPoInr(po.totalValue)} · rem{' '}
                {formatPoInr(po.remainingBalance)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="ib-po-tracker-empty">
          {loading
            ? 'Loading POs…'
            : data?.campTerms && data.campTerms !== 'po_based'
              ? 'This Client Master is not PO Based — enter PO / WO manually if needed.'
              : 'No purchase orders on this Client Master. Add them under Camp Terms → PO Based.'}
        </p>
      )}

      {projection ? (
        <div className={`ib-po-tracker-metrics tone-${tone}`} aria-live="polite">
          <div>
            <span>PO value</span>
            <strong>{formatPoInr(projection.totalValue)}</strong>
          </div>
          <div>
            <span>Already billed</span>
            <strong>{formatPoInr(projection.billedAmount)}</strong>
          </div>
          <div>
            <span>Remaining</span>
            <strong>{formatPoInr(projection.remainingBalance)}</strong>
          </div>
          <div>
            <span>Utilization</span>
            <strong>{projection.utilizationPct.toFixed(1)}%</strong>
          </div>
          <div className="ib-po-tracker-this">
            <span>This document</span>
            <strong>{formatPoInr(projection.thisAmount)}</strong>
          </div>
          <div className="ib-po-tracker-bar-wrap" aria-hidden="true">
            <div
              className="ib-po-tracker-bar"
              style={{ width: `${Math.min(100, projection.utilizationPct)}%` }}
            />
          </div>
          {projection.exceeds ? (
            <p className="ib-po-tracker-alert">
              Amount exceeds remaining PO balance by{' '}
              {formatPoInr(Math.abs(projection.remainingAfter))}. Reduce lines or pick another PO
              before submit.
            </p>
          ) : (
            <p className="ib-po-tracker-hint">
              After this document, remaining ≈ {formatPoInr(Math.max(0, projection.remainingAfter))}
            </p>
          )}
        </div>
      ) : null}

      {error ? <p className="ib-po-tracker-error">{error}</p> : null}
    </div>
  );
}
