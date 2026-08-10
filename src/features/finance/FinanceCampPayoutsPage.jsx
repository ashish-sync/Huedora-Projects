import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageAlerts } from '../../components/ui/FeedbackBanner.jsx';
import { Link } from 'react-router-dom';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import MasterFilterShell from '../../components/masters/MasterFilterShell.jsx';
import MasterSearchField from '../../components/masters/MasterSearchField.jsx';
import { api, downloadExcel } from '../../shared/api.js';
import { useDebouncedValue } from '../../shared/useDebouncedValue.js';
import { MODULE, ACTION, FILTER, NAV } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import './finance-commercial.css';
import {
  FINANCE_PAYMENT_STATUSES,
  computeLifecycleDerived,
} from '../camps/constants/campLifecycle.js';
import {
  PAYOUT_PIVOT_DIMENSIONS,
  buildPayoutPivotGroups,
  formatInr,
} from './campPayoutPivot.js';

function emptyDraft() {
  return {
    financePaymentStatus: 'paid',
    paidAmount: '',
    transactionId: '',
    paymentRemark: '',
  };
}

function rowId(row) {
  return String(row?._id || '');
}

export default function FinanceCampPayoutsPage() {
  const { can } = useAuth();
  const canWrite = can('finance:write') || can('*');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [statusFilter, setStatusFilter] = useState('');
  const [groupBy, setGroupBy] = useState('client');
  const [thenBy, setThenBy] = useState('');
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [focusId, setFocusId] = useState('');
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
      if (debouncedQ.trim()) params.set('q', debouncedQ.trim());
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api(`/finance/camp-payouts?${params}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Could not load camp payouts');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setCollapsed(new Set());
  }, [groupBy, thenBy]);

  const pivot = useMemo(
    () => buildPayoutPivotGroups(rows, groupBy, thenBy),
    [rows, groupBy, thenBy],
  );

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.has(rowId(row))),
    [rows, selectedIds],
  );

  const focusRow = useMemo(
    () => rows.find((row) => rowId(row) === String(focusId)) || null,
    [rows, focusId],
  );

  const payTargetRows = selectedRows.length ? selectedRows : (focusRow ? [focusRow] : []);
  const payMode = selectedRows.length > 1 ? 'bulk' : 'single';

  useEffect(() => {
    if (!payTargetRows.length) {
      setDraft(emptyDraft());
      return;
    }
    if (payMode === 'bulk') {
      const unpaidTotal = payTargetRows
        .filter((row) => row.financePaymentStatus !== 'paid')
        .reduce((sum, row) => sum + (Number(row.totalPayout) || 0), 0);
      setDraft({
        financePaymentStatus: 'paid',
        paidAmount: String(Math.round(unpaidTotal * 100) / 100 || ''),
        transactionId: '',
        paymentRemark: '',
      });
      return;
    }
    const row = payTargetRows[0];
    setDraft({
      financePaymentStatus: row.financePaymentStatus || 'under_review',
      paidAmount: row.paidAmount ?? row.totalPayout ?? '',
      transactionId: row.transactionId || '',
      paymentRemark: row.paymentRemark || '',
    });
  }, [payMode, focusId, selectedIds, rows]);

  const derivedBalance = useMemo(() => {
    if (payMode !== 'single' || !payTargetRows[0]) return '';
    const d = computeLifecycleDerived({
      ...payTargetRows[0],
      paidAmount: Number(draft.paidAmount) || 0,
    });
    return d.balance;
  }, [payMode, payTargetRows, draft.paidAmount]);

  function toggleCollapsed(groupId) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function toggleRowSelected(id, checked) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(String(id));
      else next.delete(String(id));
      return next;
    });
  }

  function selectRows(list, checked) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const row of list) {
        const id = rowId(row);
        if (!id) continue;
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function savePayout() {
    if (!canWrite || !payTargetRows.length) return;
    setError('');
    setMsg('');

    if (draft.financePaymentStatus === 'paid') {
      if (!String(draft.transactionId || '').trim()) {
        setError('UTR / Transaction ID is required when status is Payment Completed.');
        return;
      }
      if (payMode === 'single') {
        const amount = Number(draft.paidAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
          setError('Enter a valid paid amount greater than zero.');
          return;
        }
      }
    }

    setBusy(true);
    try {
      if (payMode === 'bulk') {
        const { data: updated, message } = await api('/finance/camp-payouts/bulk', {
          method: 'POST',
          body: {
            ids: payTargetRows.map((row) => row._id),
            financePaymentStatus: draft.financePaymentStatus,
            transactionId: draft.transactionId,
            paymentRemark: draft.paymentRemark,
          },
        });
        const byId = new Map((updated || []).map((row) => [rowId(row), row]));
        setRows((prev) => prev.map((row) => byId.get(rowId(row)) || row));
        setMsg(message || `Updated ${payTargetRows.length} camp payouts.`);
        clearSelection();
      } else {
        const selected = payTargetRows[0];
        const { data: updated } = await api(`/finance/camp-payouts/${selected._id}`, {
          method: 'PATCH',
          body: {
            financePaymentStatus: draft.financePaymentStatus,
            paidAmount: draft.paidAmount,
            transactionId: draft.transactionId,
            paymentRemark: draft.paymentRemark,
          },
        });
        setRows((prev) => prev.map((r) => (rowId(r) === rowId(updated) ? updated : r)));
        setMsg('Payment details saved.');
      }
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
    if (!focusRow) return;
    setRowExportBusy(true);
    setError('');
    try {
      const campId = String(focusRow.campId || focusRow._id).replace(/[^\w.-]+/g, '_');
      await downloadExcel(
        `/finance/camp-payouts/${focusRow._id}/export`,
        `Camp_Finance_${campId}.xlsx`,
      );
    } catch (err) {
      setError(err.message || 'Failed to download camp payout');
    } finally {
      setRowExportBusy(false);
    }
  }

  function openPayeeDoc(url, label) {
    const href = String(url || '').trim();
    if (!href) {
      setError(`${label} is not uploaded in Contact Directory`);
      return;
    }
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  function beginPay(row) {
    const id = rowId(row);
    setSelectedIds(new Set());
    setFocusId(id);
    setError('');
    setMsg('');
  }

  function renderCampRow(row) {
    const id = rowId(row);
    const checked = selectedIds.has(id);
    const isFocus = String(focusId) === id;
    const isPaid = String(row.financePaymentStatus || '') === 'paid';
    return (
      <tr
        key={id}
        className={`finance-payout-pivot-row${isFocus ? ' is-focus' : ''}${checked ? ' is-selected' : ''}`}
        onClick={() => setFocusId(id)}
      >
        <td className="finance-payout-col-check" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => toggleRowSelected(id, e.target.checked)}
            aria-label={`Select ${row.campId || row.payeeName || row.hcwName || id}`}
          />
        </td>
        <td>{row.clientName || '—'}</td>
        <td>{row.campaignName || '—'}</td>
        <td className="finance-payout-col-amount" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={`finance-payout-amount-btn${isPaid ? ' is-paid' : ''}`}
            onClick={() => beginPay(row)}
            title={isPaid ? 'View payment details' : 'Pay amount'}
          >
            {formatInr(row.totalPayout)}
          </button>
        </td>
        <td>{row.payeeName || row.hcwName || '—'}</td>
        <td className="finance-payout-col-date">{row.campDate || '—'}</td>
        <td>{row.expenseCategory || 'Healthcare Operations'}</td>
        <td>{row.expenseSubCategory || 'Camp Operations & Home Visits'}</td>
      </tr>
    );
  }

  function renderGroupRows(group, depth = 0) {
    const isCollapsed = collapsed.has(group.id);
    const allSelected = group.rows.length > 0
      && group.rows.every((row) => selectedIds.has(rowId(row)));
    const someSelected = group.rows.some((row) => selectedIds.has(rowId(row)));

    const header = (
      <tr key={`${group.id}-head`} className={`finance-payout-pivot-group-row depth-${depth}`}>
        <td className="finance-payout-col-check">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = !allSelected && someSelected;
            }}
            onChange={(e) => selectRows(group.rows, e.target.checked)}
            aria-label={`Select group ${group.label}`}
          />
        </td>
        <td colSpan={7}>
          <div className="finance-payout-pivot-group-head">
            <button
              type="button"
              className="finance-payout-pivot-toggle"
              onClick={() => toggleCollapsed(group.id)}
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
            >
              <span className={`finance-payout-chevron${isCollapsed ? '' : ' is-open'}`} aria-hidden="true" />
            </button>
            <div className="finance-payout-pivot-group-title">
              <strong>{group.label}</strong>
              <div className="finance-payout-pivot-group-meta">
                <span>{group.campCount} item{group.campCount === 1 ? '' : 's'}</span>
                <span>{group.unpaidCount} unpaid</span>
                <span>{formatInr(group.totalPayout)}</span>
                {group.unpaidCount ? <span className="is-warn">{formatInr(group.unpaidPayout)} due</span> : null}
              </div>
            </div>
            {canWrite && group.unpaidCount > 0 ? (
              <button
                type="button"
                className="btn secondary btn-compact"
                onClick={() => {
                  selectRows(group.rows.filter((r) => r.financePaymentStatus !== 'paid'), true);
                  setFocusId('');
                }}
              >
                Select unpaid
              </button>
            ) : null}
          </div>
        </td>
      </tr>
    );

    if (isCollapsed) return [header];

    if (group.children?.length) {
      return [header, ...group.children.flatMap((child) => renderGroupRows(child, depth + 1))];
    }

    return [header, ...group.rows.map((row) => renderCampRow(row))];
  }

  const secondaryOptions = PAYOUT_PIVOT_DIMENSIONS.filter((dim) => dim.id !== groupBy);

  return (
    <div className="finance-hub">
      <section className="finance-hub-panel card finance-camp-payouts">
        <div className="finance-camp-payouts-toolbar">
          <div className="finance-docs-head finance-docs-head--embedded">
            <h3 className="finance-docs-title">{NAV.PAYOUT_QUEUE}</h3>
            <Link to="/camp-one/manage" className="btn secondary btn-compact">
              Open {MODULE.CAMP_MANAGEMENT}
            </Link>
          </div>

          <MasterFilterShell
            className="finance-camp-payouts-filters finance-camp-payouts-filters--pivot"
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
              placeholder="Search client, payee, method, UTR…"
              aria-label="Search payout queue"
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
            <AdaptiveSelect
              value={groupBy}
              onChange={(e) => {
                setGroupBy(e.target.value);
                if (e.target.value === thenBy) setThenBy('');
              }}
              aria-label="Group by"
            >
              {PAYOUT_PIVOT_DIMENSIONS.map((dim) => (
                <option key={dim.id} value={dim.id}>
                  {dim.label}
                </option>
              ))}
            </AdaptiveSelect>
            <AdaptiveSelect
              value={thenBy}
              onChange={(e) => setThenBy(e.target.value)}
              aria-label="Then by"
            >
              <option value="">No second group</option>
              {secondaryOptions.map((dim) => (
                <option key={dim.id} value={dim.id}>
                  {dim.label}
                </option>
              ))}
            </AdaptiveSelect>
          </MasterFilterShell>

          <div className="finance-payout-pivot-summary" role="group" aria-label="Queue totals">
            <div className="finance-payout-metric">
              <span className="finance-payout-metric-label">Items</span>
              <strong>{pivot.totals.campCount}</strong>
            </div>
            <div className="finance-payout-metric">
              <span className="finance-payout-metric-label">Unpaid</span>
              <strong>{pivot.totals.unpaidCount}</strong>
            </div>
            <div className="finance-payout-metric">
              <span className="finance-payout-metric-label">Total</span>
              <strong>{formatInr(pivot.totals.totalPayout)}</strong>
            </div>
            <div className="finance-payout-metric is-warn">
              <span className="finance-payout-metric-label">Due</span>
              <strong>{formatInr(pivot.totals.unpaidPayout)}</strong>
            </div>
            {selectedIds.size ? (
              <div className="finance-payout-metric is-selected">
                <span className="finance-payout-metric-label">Selected</span>
                <strong>
                  {selectedIds.size} · {formatInr(
                    selectedRows.reduce((sum, row) => sum + (Number(row.totalPayout) || 0), 0),
                  )}
                </strong>
                <button type="button" className="btn secondary btn-compact" onClick={clearSelection}>
                  Clear
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <PageAlerts
          items={[
            error && { variant: 'error', message: error },
            msg && { variant: 'success', message: msg },
          ].filter(Boolean)}
        />

        <div className="finance-camp-payouts-layout finance-camp-payouts-layout--pivot">
          <section className="finance-camp-payouts-list finance-payout-pivot-table-wrap" aria-label="Payout pivot queue">
            {loading && !rows.length ? <p className="muted finance-camp-payouts-empty">Loading…</p> : null}
            {!loading && !rows.length ? (
              <p className="muted finance-camp-payouts-empty">No payouts in the queue yet.</p>
            ) : (
              <table className="finance-payout-pivot-table">
                <thead>
                  <tr>
                    <th className="finance-payout-col-check" aria-label="Select" />
                    <th>Client</th>
                    <th>Method</th>
                    <th className="finance-payout-col-amount">Amount</th>
                    <th>Payee Name</th>
                    <th>Expense date / Camp Date</th>
                    <th>Expense Category</th>
                    <th>Expense Sub-Category</th>
                  </tr>
                </thead>
                <tbody>
                  {pivot.groups.flatMap((group) => renderGroupRows(group))}
                </tbody>
              </table>
            )}
          </section>

          <section
            className={`finance-camp-payouts-detail${payTargetRows.length ? '' : ' finance-camp-payouts-detail--empty'}`}
            aria-label="Payout details"
          >
            {!payTargetRows.length ? (
              <div className="finance-payout-empty-panel">
                <p className="finance-payout-empty-title">Select an amount to pay</p>
                <p className="muted">
                  Click an Amount in the queue to open bank details and settle the payout.
                </p>
              </div>
            ) : (
              <>
                <div className="finance-payout-detail-head">
                  <p className="finance-camp-payouts-section-label">
                    {payMode === 'bulk' ? 'Bulk payment' : 'Payment'}
                  </p>
                  <h3>
                    {payMode === 'bulk'
                      ? `${payTargetRows.length} selected`
                      : (payTargetRows[0].payeeName || payTargetRows[0].hcwName || payTargetRows[0].campId || 'Payout')}
                  </h3>
                </div>

                {payMode === 'single' ? (
                  <>
                    <dl className="finance-camp-payout-meta">
                      <div>
                        <dt>Bank Name</dt>
                        <dd>{payTargetRows[0].bankName || '—'}</dd>
                      </div>
                      <div>
                        <dt>Account Number</dt>
                        <dd>{payTargetRows[0].accountNumber || '—'}</dd>
                      </div>
                      <div>
                        <dt>IFSC Code</dt>
                        <dd>{payTargetRows[0].ifscCode || '—'}</dd>
                      </div>
                    </dl>
                    <div className="finance-payout-doc-actions">
                      <button
                        type="button"
                        className="btn secondary btn-compact"
                        disabled={!payTargetRows[0].panCardCopyUrl}
                        onClick={() => openPayeeDoc(payTargetRows[0].panCardCopyUrl, 'PAN Card')}
                      >
                        View PAN Card
                      </button>
                      <button
                        type="button"
                        className="btn secondary btn-compact"
                        disabled={!payTargetRows[0].passbookCopyUrl}
                        onClick={() => openPayeeDoc(payTargetRows[0].passbookCopyUrl, 'Bank Account Proof')}
                      >
                        View Bank Account Proof
                      </button>
                    </div>
                  </>
                ) : (
                  <dl className="finance-camp-payout-meta">
                    <div>
                      <dt>Items</dt>
                      <dd>{payTargetRows.length}</dd>
                    </div>
                    <div>
                      <dt>Combined amount</dt>
                      <dd>
                        {formatInr(
                          payTargetRows.reduce((sum, row) => sum + (Number(row.totalPayout) || 0), 0),
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Unpaid in selection</dt>
                      <dd>
                        {payTargetRows.filter((row) => row.financePaymentStatus !== 'paid').length}
                      </dd>
                    </div>
                  </dl>
                )}

                {payMode === 'single' && focusRow ? (
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
                ) : null}

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
                        {payMode === 'single' ? (
                          <label>
                            Paid Amount
                            <input
                              type="text"
                              inputMode="decimal"
                              value={draft.paidAmount}
                              onChange={(e) =>
                                setDraft((d) => ({ ...d, paidAmount: e.target.value }))
                              }
                              required
                            />
                          </label>
                        ) : (
                          <label>
                            Combined payout (reference)
                            <input
                              value={draft.paidAmount}
                              readOnly
                              className="input-readonly"
                            />
                          </label>
                        )}
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
                        {payMode === 'single' ? (
                          <label>
                            Balance (Auto)
                            <input value={derivedBalance} readOnly className="input-readonly" />
                          </label>
                        ) : (
                          <p className="meta-text full">
                            Bulk pay marks each selected camp Payment Completed for its own Total Payout, using the same UTR.
                          </p>
                        )}
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
                        {busy
                          ? 'Saving…'
                          : payMode === 'bulk'
                            ? `Pay ${payTargetRows.length} items`
                            : 'Save payment'}
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
