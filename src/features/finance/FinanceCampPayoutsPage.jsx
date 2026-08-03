import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageAlerts } from '../../components/ui/FeedbackBanner.jsx';
import { Link } from 'react-router-dom';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import MasterFilterShell from '../../components/masters/MasterFilterShell.jsx';
import MasterSearchField from '../../components/masters/MasterSearchField.jsx';
import { api, downloadExcel } from '../../shared/api.js';
import { MODULE, ACTION, FILTER } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import './finance-commercial.css';
import {
  FINANCE_PAYMENT_STATUSES,
  financePaymentStatusLabel,
  paymentSubmitStatusLabel,
  computeLifecycleDerived,
} from '../camps/constants/campLifecycle.js';

function emptyDraft() {
  return {
    financePaymentStatus: 'under_review',
    paidAmount: '',
    transactionId: '',
    paymentRemark: '',
  };
}

export default function FinanceCampPayoutsPage() {
  const { can } = useAuth();
  const canWrite = can('finance:write') || can('*');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState(emptyDraft());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [rowExportBusy, setRowExportBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (q.trim()) params.set('q', q.trim());
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api(`/finance/camp-payouts?${params}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Could not load camp payouts');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(
    () => rows.find((r) => String(r._id) === String(selectedId)) || null,
    [rows, selectedId]
  );

  useEffect(() => {
    if (!selected) {
      setDraft(emptyDraft());
      return;
    }
    setDraft({
      financePaymentStatus: selected.financePaymentStatus || 'under_review',
      paidAmount: selected.paidAmount ?? '',
      transactionId: selected.transactionId || '',
      paymentRemark: selected.paymentRemark || '',
    });
  }, [selected]);

  const derivedBalance = useMemo(() => {
    if (!selected) return '';
    const d = computeLifecycleDerived({
      ...selected,
      paidAmount: Number(draft.paidAmount) || 0,
    });
    return d.balance;
  }, [selected, draft.paidAmount]);

  async function savePayout() {
    if (!selected || !canWrite) return;
    setError('');
    setMsg('');
    if (draft.financePaymentStatus === 'paid') {
      const amount = Number(draft.paidAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        setError('Enter a valid paid amount greater than zero.');
        return;
      }
      if (!String(draft.transactionId || '').trim()) {
        setError('UTR / Transaction ID is required when status is Paid.');
        return;
      }
    }
    setBusy(true);
    try {
      const body = {
        financePaymentStatus: draft.financePaymentStatus,
        paidAmount: draft.paidAmount,
        transactionId: draft.transactionId,
        paymentRemark: draft.paymentRemark,
      };
      const { data: updated } = await api(`/finance/camp-payouts/${selected._id}`, {
        method: 'PATCH',
        body,
      });
      setRows((prev) => prev.map((r) => (String(r._id) === String(updated._id) ? updated : r)));
      setMsg('Payment details saved.');
    } catch (err) {
      setError(err.message || 'Failed to save payment');
    } finally {
      setBusy(false);
    }
  }

  const showPaidFields = draft.financePaymentStatus === 'paid';

  async function downloadAllPayouts() {
    setExportBusy(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (statusFilter) params.set('status', statusFilter);
      const qs = params.toString();
      const path = qs ? `/finance/camp-payouts/export?${qs}` : '/finance/camp-payouts/export';
      await downloadExcel(path, 'Camp_Finance_Payouts.xlsx');
    } catch (err) {
      setError(err.message || 'Failed to download camp payouts');
    } finally {
      setExportBusy(false);
    }
  }

  async function downloadSelectedPayout() {
    if (!selected) return;
    setRowExportBusy(true);
    setError('');
    try {
      const campId = String(selected.campId || selected._id).replace(/[^\w.-]+/g, '_');
      await downloadExcel(
        `/finance/camp-payouts/${selected._id}/export`,
        `Camp_Finance_${campId}.xlsx`,
      );
    } catch (err) {
      setError(err.message || 'Failed to download camp payout');
    } finally {
      setRowExportBusy(false);
    }
  }

  return (
    <div className="finance-hub">
      <section className="finance-hub-panel card finance-camp-payouts">
        <div className="finance-camp-payouts-toolbar">
          <div className="finance-docs-head finance-docs-head--embedded">
            <h3 className="finance-docs-title">Camp payouts</h3>
            <Link to="/camps/manage" className="btn secondary btn-compact">
              Open {MODULE.CAMP_MANAGEMENT}
            </Link>
          </div>

          <MasterFilterShell
            className="finance-camp-payouts-filters"
            actions={
              <>
                <button type="button" className="btn secondary btn-compact" onClick={load} disabled={loading}>
                  {loading ? 'Loading…' : 'Refresh'}
                </button>
                <button
                  type="button"
                  className="btn secondary btn-compact"
                  onClick={downloadAllPayouts}
                  disabled={exportBusy || loading}
                >
                  {exportBusy ? ACTION.DOWNLOADING : ACTION.DOWNLOAD_EXCEL}
                </button>
              </>
            }
          >
            <MasterSearchField
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search camp ID, client, HCW, UTR…"
              aria-label="Search camp payouts"
            />
            <AdaptiveSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Payout status"
            >
              <option value="">{FILTER.ALL_STATUSES}</option>
              {FINANCE_PAYMENT_STATUSES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </AdaptiveSelect>
          </MasterFilterShell>
        </div>

        <PageAlerts
          items={[
            error && { variant: 'error', message: error },
            msg && { variant: 'success', message: msg },
          ].filter(Boolean)}
        />

        <div className="finance-camp-payouts-layout">
          <aside className="finance-camp-payouts-list" aria-label="Payout queue">
            <p className="finance-camp-payouts-section-label">Queue</p>
            {loading && !rows.length ? <p className="muted finance-camp-payouts-empty">Loading…</p> : null}
            {!loading && !rows.length ? (
              <p className="muted finance-camp-payouts-empty">No camp payouts submitted yet.</p>
            ) : (
              <ul className="finance-camp-payouts-items">
                {rows.map((row) => (
                  <li key={row._id}>
                    <button
                      type="button"
                      className={`finance-camp-payout-item${String(selectedId) === String(row._id) ? ' is-active' : ''}`}
                      onClick={() => setSelectedId(row._id)}
                    >
                      <strong>{row.campId || row._id}</strong>
                      <span>{row.clientName}</span>
                      <span className="muted">
                        {row.campDate} · ₹{row.totalPayout ?? 0} ·{' '}
                        {financePaymentStatusLabel(row.financePaymentStatus)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <section
            className={`finance-camp-payouts-detail${selected ? '' : ' finance-camp-payouts-detail--empty'}`}
            aria-label="Payout details"
          >
            {!selected ? (
              <p className="muted finance-camp-payouts-empty">Select a camp payout to process payment.</p>
            ) : (
            <>
              <h3>{selected.campId || 'Camp payout'}</h3>
              <dl className="finance-camp-payout-meta">
                <div>
                  <dt>Client</dt>
                  <dd>{selected.clientName || '—'}</dd>
                </div>
                <div>
                  <dt>Camp date</dt>
                  <dd>{selected.campDate || '—'}</dd>
                </div>
                <div>
                  <dt>HCW</dt>
                  <dd>{selected.hcwName || '—'}</dd>
                </div>
                <div>
                  <dt>Total payout</dt>
                  <dd>₹{selected.totalPayout ?? 0}</dd>
                </div>
                <div>
                  <dt>Camp check</dt>
                  <dd>{paymentSubmitStatusLabel(selected.paymentSubmitStatus)}</dd>
                </div>
                <div>
                  <dt>Submitted</dt>
                  <dd>
                    {selected.submittedToFinanceAt
                      ? new Date(selected.submittedToFinanceAt).toLocaleString()
                      : '—'}
                  </dd>
                </div>
              </dl>

              <div className="finance-camp-payout-download">
                <button
                  type="button"
                  className="btn secondary btn-compact"
                  disabled={rowExportBusy}
                  onClick={downloadSelectedPayout}
                >
                  {rowExportBusy ? ACTION.DOWNLOADING : ACTION.DOWNLOAD_EXCEL}
                </button>
              </div>

              {canWrite ? (
                <div className="form-grid finance-camp-payout-form">
                  <label>
                    Status
                    <select
                      value={draft.financePaymentStatus}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, financePaymentStatus: e.target.value }))
                      }
                    >
                      {FINANCE_PAYMENT_STATUSES.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {showPaidFields && (
                    <>
                      <label>
                        Paid Amount
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.paidAmount}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, paidAmount: e.target.value }))
                          }
                          required
                        />
                      </label>
                      <label>
                        Transaction ID / UTR
                        <input
                          value={draft.transactionId}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, transactionId: e.target.value }))
                          }
                          required
                        />
                      </label>
                      <label>
                        Balance (Auto)
                        <input value={derivedBalance} readOnly className="input-readonly" />
                      </label>
                      <label className="full">
                        Payment Remark
                        <textarea
                          rows={2}
                          value={draft.paymentRemark}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, paymentRemark: e.target.value }))
                          }
                        />
                      </label>
                    </>
                  )}

                  <div className="full">
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={savePayout}
                    >
                      {busy ? 'Saving…' : 'Save payment'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="muted">You have read-only access to camp payouts.</p>
              )}
            </>
          )}
          </section>
        </div>
      </section>
    </div>
  );
}
